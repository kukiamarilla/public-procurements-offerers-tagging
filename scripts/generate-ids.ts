#!/usr/bin/env npx ts-node
/**
 * Genera ids.json desde la API DNCP y lo sube al prefix de input del bucket.
 *
 * Uso:
 *   npx ts-node scripts/generate-ids.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const DELAY_MS = 1000;
const RETRY_DELAY_MS = 10000;
const MAX_RETRIES = 3;
const LOCAL_BACKUP_DIR = path.join(process.cwd(), 'data', 'checkpoint');

/** Query params dinámicos para la request */
const QUERY_PARAMS: Record<string, string> = {
  items_per_page: '100',
  'tender.items.classification.id': '72131701',
  'tender.status': 'complete',
};

const BASE_URL = 'https://www.contrataciones.gov.py/datos/api/v3/doc/search/processes';

interface ApiRecord {
  ocid?: string;
  compiledRelease?: {
    ocid?: string;
    tender?: { id?: string };
    awards?: { id?: string }[];
  };
}

interface ApiResponse {
  records?: ApiRecord[];
  pagination?: {
    total_items: number;
    total_pages: number;
    current_page: number;
    items_per_page: number;
    total_in_page: number;
  };
}

interface ExtractedId {
  ocid?: string;
  tenderId: string;
  awardIds: string[];
}

function buildUrl(page: number): string {
  const params = new URLSearchParams({
    ...QUERY_PARAMS,
    page: String(page),
  });
  return `${BASE_URL}?${params}`;
}

function extractFromRecord(record: ApiRecord): ExtractedId | null {
  const cr = record.compiledRelease;
  const tenderId = cr?.tender?.id ?? record.ocid;
  if (!tenderId) return null;

  const awardIds = (cr?.awards ?? [])
    .map((a) => a.id)
    .filter((id): id is string => !!id);

  return {
    ocid: cr?.ocid ?? record.ocid,
    tenderId,
    awardIds,
  };
}

function createS3Client() {
  const accessKeyId = process.env.DO_SPACES_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.DO_SPACES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '';
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Faltan credenciales: DO_SPACES_ACCESS_KEY_ID y DO_SPACES_SECRET_ACCESS_KEY (o AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY)');
  }
  return new S3Client({
    region: process.env.DO_SPACES_REGION ?? 'us-east-1',
    endpoint: process.env.DO_SPACES_ENDPOINT ?? 'https://tor1.digitaloceanspaces.com',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

interface Checkpoint {
  lastPage: number;
  totalPages: number;
}

function objectKey(prefix: string, filename: string): string {
  return prefix.endsWith('/') ? `${prefix}${filename}` : `${prefix}/${filename}`;
}

async function loadCheckpoint(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<Checkpoint | null> {
  const key = objectKey(prefix, 'checkpoint.json');
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = res.Body;
    if (!body) return null;
    const text = await body.transformToString();
    const parsed = JSON.parse(text) as Checkpoint;
    if (typeof parsed.lastPage === 'number' && typeof parsed.totalPages === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveCheckpoint(
  client: S3Client,
  bucket: string,
  prefix: string,
  checkpoint: Checkpoint,
): Promise<void> {
  const key = objectKey(prefix, 'checkpoint.json');
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(checkpoint, null, 2),
        ContentType: 'application/json',
      }),
    );
  } catch (err) {
    console.error(`[S3 ERROR] No se pudo guardar checkpoint: ${key}`, err);
    throw err;
  }
}

async function loadExistingIds(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<ExtractedId[]> {
  const key = objectKey(prefix, 'ids.json');
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = res.Body;
    if (!body) return [];
    const text = await body.transformToString();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveIds(
  client: S3Client,
  bucket: string,
  prefix: string,
  ids: ExtractedId[],
): Promise<void> {
  const key = objectKey(prefix, 'ids.json');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(ids, null, 2),
      ContentType: 'application/json',
    }),
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry<T>(url: string, pageNum: number): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`API error ${res.status}: ${res.statusText}`);
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.log(`  Página ${pageNum}: ${res.status}, reintento ${attempt}/${MAX_RETRIES} en ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw lastErr;
      }
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      console.log(`  Página ${pageNum}: error, reintento ${attempt}/${MAX_RETRIES}...`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr ?? new Error('Max retries exceeded');
}

async function fetchAllIds(
  bucket: string,
  prefix: string,
  client: S3Client,
): Promise<ExtractedId[]> {
  const checkpoint = await loadCheckpoint(client, bucket, prefix);
  let existing = await loadExistingIds(client, bucket, prefix);
  const seenTenderIds = new Set(existing.map((e) => e.tenderId));
  const all = [...existing];

  let startPage = 1;
  let totalPages = 1;

  if (checkpoint) {
    if (checkpoint.lastPage >= checkpoint.totalPages) {
      console.log(`Checkpoint: ya completado (página ${checkpoint.lastPage}/${checkpoint.totalPages})`);
      return all;
    }
    startPage = checkpoint.lastPage + 1;
    totalPages = checkpoint.totalPages;
    console.log(`Checkpoint: resumiendo desde página ${startPage}/${totalPages} (${existing.length} IDs existentes)`);
  }

  for (let page = startPage; page <= totalPages; page++) {
    const url = buildUrl(page);
    const data = await fetchWithRetry<ApiResponse>(url, page);
    const records = data.records ?? [];
    const pagination = data.pagination;

    if (pagination && page === startPage && !checkpoint) {
      totalPages = pagination.total_pages;
    }

    let newCount = 0;
    for (const record of records) {
      const extracted = extractFromRecord(record);
      if (extracted && !seenTenderIds.has(extracted.tenderId)) {
        seenTenderIds.add(extracted.tenderId);
        all.push(extracted);
        newCount++;
      }
    }

    console.log(`  Página ${page}/${totalPages} — +${newCount} nuevos, total: ${all.length}`);

    await saveIds(client, bucket, prefix, all);
    await saveCheckpoint(client, bucket, prefix, { lastPage: page, totalPages });

    if (page < totalPages) {
      await sleep(DELAY_MS);
    }
  }

  return all;
}

async function main() {
  const bucket = process.env.DO_SPACES_BUCKET;
  const prefixInput = process.env.DO_SPACES_PREFIX_INPUT ?? 'tagging/input';

  if (!bucket) {
    console.error('Falta DO_SPACES_BUCKET en .env');
    process.exit(1);
  }

  const client = createS3Client();

  console.log('Generando ids desde DNCP API...');
  console.log('  Base URL:', BASE_URL);
  console.log('  Query params:', QUERY_PARAMS);
  console.log(`  Delay entre requests: ${DELAY_MS}ms`);
  console.log('');

  const ids = await fetchAllIds(bucket, prefixInput, client);
  console.log(`\nTotal: ${ids.length} IDs en s3://${bucket}/${prefixInput}/ids.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
