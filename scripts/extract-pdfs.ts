#!/usr/bin/env npx ts-node
/**
 * Extrae PDFs de licitaciones (Acta de Apertura y Cuadro Comparativo de Ofertas)
 * desde la API DNCP y los sube al bucket.
 *
 * Uso:
 *   npx ts-node scripts/extract-pdfs.ts
 *
 * Flujo:
 * 1. Descarga ids.json desde DO_SPACES_PREFIX_INPUT del bucket
 * 2. Para cada entrada: obtiene tender y primer award de la API DNCP
 * 3. Descarga Acta de Apertura (tender) → {tenderId}-ada.pdf
 * 4. Descarga Cuadro Comparativo de Ofertas (primer award) → {tenderId}-cco.pdf
 * 5. Sube los PDFs a DO_SPACES_PREFIX_PDFS
 * 6. Usa checkpoint para reanudar y muestra progreso
 */

import 'dotenv/config';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const DELAY_MS = 500;
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 3;
const TENDER_API = 'https://www.contrataciones.gov.py/datos/api/v3/doc/tender';
const AWARD_API = 'https://www.contrataciones.gov.py/datos/api/v3/doc/awards';

const ACTA_APERTURA = 'Acta de Apertura';
const CUADRO_COMPARATIVO = 'Cuadro Comparativo de Ofertas';

interface ExtractedId {
  ocid?: string;
  tenderId: string;
  awardIds: string[];
}

interface TenderDoc {
  documentTypeDetails?: string;
  url?: string;
  format?: string;
}

interface TenderResponse {
  tender?: {
    id?: string;
    documents?: TenderDoc[];
  };
}

interface AwardDoc {
  documentTypeDetails?: string;
  url?: string;
}

interface AwardResponse {
  awards?: Array<{
    id?: string;
    documents?: AwardDoc[];
  }>;
}

interface Checkpoint {
  processedTenderIds: string[];
  lastIndex: number;
}

function createS3Client(): S3Client {
  const accessKeyId = process.env.DO_SPACES_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.DO_SPACES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '';
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Faltan credenciales: DO_SPACES_ACCESS_KEY_ID y DO_SPACES_SECRET_ACCESS_KEY');
  }
  return new S3Client({
    region: process.env.DO_SPACES_REGION ?? 'us-east-1',
    endpoint: process.env.DO_SPACES_ENDPOINT ?? 'https://tor1.digitaloceanspaces.com',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

function objectKey(prefix: string, filename: string): string {
  return prefix.endsWith('/') ? `${prefix}${filename}` : `${prefix}/${filename}`;
}

async function getIdsFromBucket(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<ExtractedId[]> {
  const key = objectKey(prefix, 'ids.json');
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) throw new Error(`ids.json vacío o no encontrado en ${key}`);
  const text = await body.transformToString();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('ids.json debe ser un array');
  return parsed as ExtractedId[];
}

async function loadCheckpoint(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<Checkpoint | null> {
  const key = objectKey(prefix, 'extract-pdfs-checkpoint.json');
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = res.Body;
    if (!body) return null;
    const text = await body.transformToString();
    const parsed = JSON.parse(text) as Checkpoint;
    if (Array.isArray(parsed.processedTenderIds) && typeof parsed.lastIndex === 'number') {
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
  const key = objectKey(prefix, 'extract-pdfs-checkpoint.json');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(checkpoint, null, 2),
      ContentType: 'application/json',
    }),
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry<T>(url: string, label: string): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DNCP-Extractor/1.0)',
          Accept: 'application/json',
        },
      });
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`API ${res.status}: ${res.statusText}`);
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.log(`  [${label}] ${res.status}, reintento ${attempt}/${MAX_RETRIES}...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw lastErr;
      }
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      console.log(`  [${label}] error, reintento ${attempt}/${MAX_RETRIES}...`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr ?? new Error('Max retries exceeded');
}

async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DNCP-Extractor/1.0)',
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    const ct = res.headers.get('content-type') ?? '';
    const looksLikePdf = buf.subarray(0, 5).toString() === '%PDF-';
    if (!looksLikePdf && !ct.includes('pdf') && !ct.includes('octet-stream')) return null;
    return buf;
  } catch {
    return null;
  }
}

async function pdfExistsInBucket(
  client: S3Client,
  bucket: string,
  prefix: string,
  filename: string,
): Promise<boolean> {
  const key = objectKey(prefix, filename);
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadPdf(
  client: S3Client,
  bucket: string,
  prefix: string,
  filename: string,
  body: Buffer,
): Promise<void> {
  const key = objectKey(prefix, filename);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/pdf',
    }),
  );
}

function findDocumentByType(docs: { documentTypeDetails?: string; url?: string }[] | undefined, type: string) {
  return docs?.find((d) => d.documentTypeDetails === type && d.url);
}

function renderProgressBar(current: number, total: number, width = 40): string {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${current}/${total} (${pct.toFixed(1)}%)`;
}

async function processOne(
  client: S3Client,
  bucket: string,
  prefixPdfs: string,
  item: ExtractedId,
  index: number,
  total: number,
): Promise<{ ada: boolean; cco: boolean }> {
  const { tenderId, awardIds } = item;
  const result = { ada: false, cco: false };

  try {
    const tenderUrl = `${TENDER_API}/${encodeURIComponent(tenderId)}`;
    const tenderData = await fetchWithRetry<TenderResponse>(tenderUrl, `tender ${tenderId}`);
    const tender = tenderData.tender;
    const documents = tender?.documents ?? [];

    const actaDoc = findDocumentByType(documents, ACTA_APERTURA);
    if (actaDoc?.url) {
      const adaKey = `${tenderId}-ada.pdf`;
      const exists = await pdfExistsInBucket(client, bucket, prefixPdfs, adaKey);
      if (!exists) {
        const pdf = await downloadPdf(actaDoc.url);
        if (pdf) {
          await uploadPdf(client, bucket, prefixPdfs, adaKey, pdf);
          result.ada = true;
        }
      } else {
        result.ada = true;
      }
    }

    const firstAwardId = awardIds[0];
    if (firstAwardId) {
      const awardUrl = `${AWARD_API}/${encodeURIComponent(firstAwardId)}`;
      const awardData = await fetchWithRetry<AwardResponse>(awardUrl, `award ${firstAwardId}`);
      const firstAward = awardData.awards?.[0];
      const awardDocs = firstAward?.documents ?? [];

      const ccoDoc = findDocumentByType(awardDocs, CUADRO_COMPARATIVO);
      if (ccoDoc?.url) {
        const ccoKey = `${tenderId}-cco.pdf`;
        const exists = await pdfExistsInBucket(client, bucket, prefixPdfs, ccoKey);
        if (!exists) {
          const pdf = await downloadPdf(ccoDoc.url);
          if (pdf) {
            await uploadPdf(client, bucket, prefixPdfs, ccoKey, pdf);
            result.cco = true;
          }
        } else {
          result.cco = true;
        }
      }
    }
  } catch (err) {
    console.error(`  [${index + 1}/${total}] Error en ${tenderId}:`, err);
  }

  return result;
}

async function main() {
  const bucket = process.env.DO_SPACES_BUCKET;
  const prefixInput = process.env.DO_SPACES_PREFIX_INPUT ?? 'tagging/input';
  const prefixPdfs = process.env.DO_SPACES_PREFIX_PDFS ?? 'tagging/pdfs';

  if (!bucket) {
    console.error('Falta DO_SPACES_BUCKET en .env');
    process.exit(1);
  }

  const client = createS3Client();

  console.log('Extrayendo PDFs desde DNCP API');
  console.log('  Bucket:', bucket);
  console.log('  Input (ids.json):', prefixInput);
  console.log('  Output (PDFs):', prefixPdfs);
  console.log('');

  const ids = await getIdsFromBucket(client, bucket, prefixInput);
  console.log(`Total IDs en ids.json: ${ids.length}`);

  const checkpoint = await loadCheckpoint(client, bucket, prefixPdfs);
  const processedSet = new Set(checkpoint?.processedTenderIds ?? []);
  const startIndex = checkpoint?.lastIndex ?? 0;

  if (startIndex > 0) {
    console.log(`Checkpoint: resumiendo desde índice ${startIndex} (${processedSet.size} ya procesados)`);
  }
  console.log('');

  let adaCount = 0;
  let ccoCount = 0;

  for (let i = startIndex; i < ids.length; i++) {
    const item = ids[i];
    if (processedSet.has(item.tenderId)) {
      process.stdout.write(`\r${renderProgressBar(i + 1, ids.length)} (omitido)    `);
      continue;
    }

    process.stdout.write(`\r${renderProgressBar(i, ids.length)} — ${item.tenderId.slice(0, 50)}...`);

    const { ada, cco } = await processOne(client, bucket, prefixPdfs, item, i, ids.length);
    if (ada) adaCount++;
    if (cco) ccoCount++;

    processedSet.add(item.tenderId);
    await saveCheckpoint(client, bucket, prefixPdfs, {
      processedTenderIds: Array.from(processedSet),
      lastIndex: i + 1,
    });

    const adaStr = ada ? 'ADA ✓' : 'ADA -';
    const ccoStr = cco ? 'CCO ✓' : 'CCO -';
    process.stdout.write(`\r${renderProgressBar(i + 1, ids.length)} ${adaStr} ${ccoStr}   \n`);

    if (i < ids.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\r${renderProgressBar(ids.length, ids.length)} Completado`);
  console.log('');
  console.log('--- Resumen ---');
  console.log(`  Actas de Apertura subidas: ${adaCount}`);
  console.log(`  Cuadros Comparativos subidos: ${ccoCount}`);
  console.log(`  Total procesados: ${ids.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
