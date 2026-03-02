import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { TaggingTaskRepository, ListTasksInput, TaggingStats } from '../../domain/repositories/tagging-task.repository';
import { TaggingTaskModel } from '../../domain/models/tagging-task.model';
import { TaggingResultModel } from '../../domain/models/tagging-result.model';
import { DoSpacesConfig } from '../../../shared/infrastructure/config/do-spaces.config';

/**
 * Builds full S3 key from prefix and filename.
 */
function key(prefix: string, filename: string): string {
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return `${p}${filename}`;
}

/**
 * Digital Ocean Spaces implementation of the tagging task repository.
 * - Input prefix: JSON files with tender IDs (or list of IDs)
 * - PDFs prefix: PDF files keyed by tender ID
 * - Results prefix: Tagging results as JSON
 */
export class SpacesTaggingRepository implements TaggingTaskRepository {
  private readonly client: S3Client;

  constructor(
    private readonly config: DoSpacesConfig,
    private readonly getSignedUrl?: (key: string, expiresIn?: number) => Promise<string>,
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: false,
    });
  }

  /**
   * Disponibilidad de PDFs y resultados desde listados (evita N HeadObject por tarea).
   */
  private async getPdfAndResultAvailability(): Promise<{
    tenderIdsWithPdf: Set<string>;
    adaTenderIds: Set<string>;
    ccoTenderIds: Set<string>;
    resultTenderIds: Set<string>;
  }> {
    const pdfPrefix = this.config.prefixPdfs.endsWith('/') ? this.config.prefixPdfs : `${this.config.prefixPdfs}/`;
    const resultPrefix = this.config.prefixResults.endsWith('/') ? this.config.prefixResults : `${this.config.prefixResults}/`;

    const tenderIdsWithPdf = new Set<string>();
    const adaTenderIds = new Set<string>();
    const ccoTenderIds = new Set<string>();
    const resultTenderIds = new Set<string>();

    const listAll = async (prefix: string, processKey: (key: string) => void) => {
      let token: string | undefined;
      do {
        const result = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.config.bucket,
            Prefix: prefix,
            MaxKeys: 1000,
            ContinuationToken: token,
          }),
        );
        for (const obj of result.Contents ?? []) {
          if (obj.Key) processKey(obj.Key);
        }
        token = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (token);
    };

    await Promise.all([
      listAll(pdfPrefix, (k) => {
        const filename = k.split('/').pop() ?? '';
        if (filename.endsWith('-ada.pdf')) {
          const tenderId = filename.replace(/-ada\.pdf$/, '');
          tenderIdsWithPdf.add(tenderId);
          adaTenderIds.add(tenderId);
        } else if (filename.endsWith('-cco.pdf')) {
          const tenderId = filename.replace(/-cco\.pdf$/, '');
          tenderIdsWithPdf.add(tenderId);
          ccoTenderIds.add(tenderId);
        }
      }),
      listAll(resultPrefix, (k) => {
        if (k.endsWith('.json')) {
          const tenderId = (k.split('/').pop() ?? '').replace(/\.json$/, '');
          resultTenderIds.add(tenderId);
        }
      }),
    ]);

    return { tenderIdsWithPdf, adaTenderIds, ccoTenderIds, resultTenderIds };
  }

  private async fetchOffererCountsForTenderIds(tenderIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const bodies = await Promise.all(
      tenderIds.map((tenderId) =>
        this.getObjectBody(key(this.config.prefixResults, `${tenderId}.json`)).catch(() => ''),
      ),
    );
    bodies.forEach((body, i) => {
      try {
        const data = JSON.parse(body || '{}') as { offererCount?: number };
        if (typeof data.offererCount === 'number') {
          map.set(tenderIds[i], data.offererCount);
        }
      } catch {
        // ignore
      }
    });
    return map;
  }

  /**
   * Solo licitaciones que tienen al menos un PDF guardado.
   */
  private async collectTenderIdsWithPdfs(availability?: { tenderIdsWithPdf: Set<string> }): Promise<{ ocid?: string; tenderId: string; awardIds: string[]; inputKey: string }[]> {
    const allIds = await this.collectTenderIds();
    if (availability) {
      return allIds.filter((t) => availability.tenderIdsWithPdf.has(t.tenderId));
    }
    const withPdfs = await this.getPdfAndResultAvailability();
    return allIds.filter((t) => withPdfs.tenderIdsWithPdf.has(t.tenderId));
  }

  async listTasks(input?: ListTasksInput): Promise<TaggingTaskModel[]> {
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;
    const pendingFirst = input?.pendingFirst ?? false;

    const availability = await this.getPdfAndResultAvailability();
    const tenderIds = await this.collectTenderIdsWithPdfs(availability);

    const slice = pendingFirst
      ? tenderIds.slice(0, Math.min(tenderIds.length, offset + limit))
      : tenderIds.slice(offset, offset + limit);

    const tenderIdsWithResults = slice
      .filter((t) => availability.resultTenderIds.has(t.tenderId))
      .map((t) => t.tenderId);
    const resultOffererCounts = tenderIdsWithResults.length > 0
      ? await this.fetchOffererCountsForTenderIds(tenderIdsWithResults)
      : new Map<string, number>();

    const tasks = await Promise.all(
      slice.map(({ ocid, tenderId, awardIds, inputKey }) =>
        this.buildTaskForTenderFast(
          { ocid, tenderId, awardIds },
          inputKey,
          { ...availability, resultOffererCounts },
        ),
      ),
    );

    const filtered = tasks.filter((t): t is TaggingTaskModel => t !== null);

    if (pendingFirst) {
      filtered.sort((a, b) => (a.saved === b.saved ? 0 : a.saved ? 1 : -1));
      return filtered.slice(offset, offset + limit);
    }
    return filtered;
  }

  async getStats(): Promise<TaggingStats> {
    const tenderIds = await this.collectTenderIdsWithPdfs();
    const total = tenderIds.length;

    const tenderIdSet = new Set(tenderIds.map((t) => t.tenderId));
    let saved = 0;
    let continuationToken: string | undefined;

    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: this.config.prefixResults.endsWith('/') ? this.config.prefixResults : `${this.config.prefixResults}/`,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });
      const result = await this.client.send(listCmd);
      const objects = result.Contents ?? [];
      for (const obj of objects) {
        const k = obj.Key;
        if (k?.endsWith('.json')) {
          const filename = k.split('/').pop() ?? '';
          const tenderId = filename.replace(/\.json$/, '');
          if (tenderIdSet.has(tenderId)) saved++;
        }
      }
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);

    return { total, saved };
  }

  /**
   * Collects tender IDs from input prefix.
   * Supports: (1) individual {id}.json or {id}.txt, (2) ids.json array, (3) ids.txt one-per-line.
   */
  private async collectTenderIds(): Promise<{ ocid?: string; tenderId: string; awardIds: string[]; inputKey: string }[]> {
    const listCmd = new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: this.config.prefixInput,
      MaxKeys: 1000,
    });
    const listResult = await this.client.send(listCmd);
    const objects = listResult.Contents ?? [];
    const inputKeys = objects
      .map((o) => o.Key)
      .filter((k): k is string => !!k)
      .filter((k) => k.endsWith('.json') || k.endsWith('.txt'));

    const manifestKeys = inputKeys.filter(
      (k) => k.endsWith('ids.json') || k.endsWith('ids.txt'),
    );
    if (manifestKeys.length > 0) {
      const fromManifest = await this.parseManifestFile(manifestKeys[0]);
      return fromManifest;
    }

    return inputKeys.map((inputKey) => ({
      tenderId: this.extractTenderIdFromKey(inputKey),
      awardIds: [] as string[],
      inputKey,
    }));
  }

  private async parseManifestFile(
    manifestKey: string,
  ): Promise<{ ocid?: string; tenderId: string; awardIds: string[]; inputKey: string }[]> {
    const body = await this.getObjectBody(manifestKey);

    if (manifestKey.endsWith('.json')) {
      try {
        const data = JSON.parse(body);
        const items = Array.isArray(data) ? data : [data];
        return items.map((item: unknown) => {
          if (typeof item === 'string') {
            return { tenderId: item, awardIds: [] as string[], inputKey: manifestKey };
          }
          if (item && typeof item === 'object') {
            const o = item as Record<string, unknown>;
            const tenderId = String(o.tenderId ?? o.id ?? o.tender_id ?? '');
            const awardIds = Array.isArray(o.awardIds) ? o.awardIds.map(String)
              : Array.isArray(o.awards) ? o.awards.map(String) : [];
            return {
              ocid: o.ocid ? String(o.ocid) : undefined,
              tenderId,
              awardIds,
              inputKey: manifestKey,
            };
          }
          return { tenderId: '', awardIds: [] as string[], inputKey: manifestKey };
        }).filter((x) => x.tenderId);
      } catch {
        // ignore
      }
    }

    return body
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((tenderId) => ({ tenderId, awardIds: [] as string[], inputKey: manifestKey }));
  }

  private extractTenderIdFromKey(inputKey: string): string {
    const filename = inputKey.split('/').pop() ?? inputKey;
    return filename.replace(/\.(json|txt)$/, '');
  }

  private async buildTaskForTenderFast(
    { ocid, tenderId, awardIds }: { ocid?: string; tenderId: string; awardIds: string[] },
    inputKey: string,
    availability: {
      adaTenderIds: Set<string>;
      ccoTenderIds: Set<string>;
      resultTenderIds: Set<string>;
      resultOffererCounts?: Map<string, number>;
    },
  ): Promise<TaggingTaskModel | null> {
    try {
      const isManifest = inputKey.endsWith('ids.json') || inputKey.endsWith('ids.txt');
      const inputBody = isManifest ? '{}' : await this.getObjectBody(inputKey);
      const parsed = this.parseInputFile(inputBody, tenderId, isManifest);

      const adaExists = availability.adaTenderIds.has(tenderId);
      const ccoExists = availability.ccoTenderIds.has(tenderId);
      const resultExists = availability.resultTenderIds.has(tenderId);

      if (!adaExists && !ccoExists) return null;

      let pdfAdaUrl: string | undefined;
      let pdfCcoUrl: string | undefined;

      if (this.getSignedUrl) {
        const urls = await Promise.all([
          adaExists ? this.getSignedUrl(key(this.config.prefixPdfs, `${tenderId}-ada.pdf`), 3600) : undefined,
          ccoExists ? this.getSignedUrl(key(this.config.prefixPdfs, `${tenderId}-cco.pdf`), 3600) : undefined,
        ]);
        pdfAdaUrl = urls[0];
        pdfCcoUrl = urls[1];
      }

      const saved = resultExists;
      const savedOffererCount = availability.resultOffererCounts?.get(tenderId);

      return {
        ocid: parsed.ocid ?? ocid,
        tenderId: parsed.tenderId,
        awardIds: parsed.awardIds.length ? parsed.awardIds : awardIds,
        offerers: parsed.offerers,
        pdfAdaUrl,
        pdfCcoUrl,
        saved,
        savedOffererCount,
        metadata: parsed.metadata,
      };
    } catch {
      return null;
    }
  }

  private async buildTaskForTender(
    { ocid, tenderId, awardIds }: { ocid?: string; tenderId: string; awardIds: string[] },
    inputKey: string,
  ): Promise<TaggingTaskModel | null> {
    try {
      const isManifest = inputKey.endsWith('ids.json') || inputKey.endsWith('ids.txt');
      const inputBody = isManifest ? '{}' : await this.getObjectBody(inputKey);
      const parsed = this.parseInputFile(inputBody, tenderId, isManifest);

      const resolvedOcid = parsed.ocid ?? ocid;
      const resolvedAwardIds = parsed.awardIds.length ? parsed.awardIds : awardIds;

      let pdfUrl: string | undefined;
      let pdfAdaUrl: string | undefined;
      let pdfCcoUrl: string | undefined;
      let saved = false;
      let savedOffererCount: number | undefined;

      const pdfKey = key(this.config.prefixPdfs, `${tenderId}.pdf`);
      const adaKey = key(this.config.prefixPdfs, `${tenderId}-ada.pdf`);
      const ccoKey = key(this.config.prefixPdfs, `${tenderId}-cco.pdf`);
      const resultKey = key(this.config.prefixResults, `${tenderId}.json`);

      if (this.getSignedUrl) {
        const [legacyExists, adaExists, ccoExists, resultExists] = await Promise.all([
          this.objectExists(pdfKey),
          this.objectExists(adaKey),
          this.objectExists(ccoKey),
          this.objectExists(resultKey),
        ]);
        if (legacyExists) pdfUrl = await this.getSignedUrl(pdfKey, 3600);
        if (adaExists) pdfAdaUrl = await this.getSignedUrl(adaKey, 3600);
        if (ccoExists) pdfCcoUrl = await this.getSignedUrl(ccoKey, 3600);
        if (resultExists) {
          saved = true;
          try {
            const body = await this.getObjectBody(resultKey);
            const result = JSON.parse(body) as { offererCount?: number };
            savedOffererCount = typeof result.offererCount === 'number' ? result.offererCount : undefined;
          } catch {
            // ignore
          }
        }
      }

      if (!pdfUrl && !pdfAdaUrl && !pdfCcoUrl) return null;

      return {
        ocid: resolvedOcid,
        tenderId: parsed.tenderId,
        awardIds: resolvedAwardIds,
        offerers: parsed.offerers,
        pdfUrl,
        pdfAdaUrl,
        pdfCcoUrl,
        saved,
        savedOffererCount,
        metadata: parsed.metadata,
      };
    } catch {
      return null;
    }
  }

  private async objectExists(s3Key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: s3Key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private async getObjectBody(s3Key: string): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Key,
    });
    const resp = await this.client.send(cmd);
    const body = resp.Body;
    if (!body) return '';
    return await body.transformToString();
  }

  private parseInputFile(
    body: string,
    fallbackTenderId: string,
    fromManifest = false,
  ): { ocid?: string; tenderId: string; awardIds: string[]; offerers: { id: string; name?: string }[]; metadata?: Record<string, unknown> } {
    if (fromManifest) {
      return { tenderId: fallbackTenderId, awardIds: [], offerers: [] };
    }
    try {
      const data = JSON.parse(body);
      if (typeof data === 'object') {
        const ocid = data.ocid;
        const tenderId = data.tenderId ?? data.id ?? fallbackTenderId;
        let awardIds = data.awardIds ?? data.awards ?? [];
        if (!Array.isArray(awardIds)) awardIds = [];
        awardIds = awardIds.map((a: unknown) => String(a));

        let offerers = data.offerers ?? data.oferentes ?? [];
        if (Array.isArray(data) && data.length > 0 && typeof data[0] !== 'object') {
          offerers = data.map((id: unknown) => ({ id: String(id) }));
        } else if (Array.isArray(data)) {
          offerers = data;
        }
        if (!Array.isArray(offerers)) {
          offerers = [];
        }
        return {
          ocid: ocid ? String(ocid) : undefined,
          tenderId: String(tenderId),
          awardIds,
          offerers: offerers.map((o: unknown) => {
            if (typeof o === 'string') return { id: o };
            if (o && typeof o === 'object' && 'id' in o) {
              return { id: String((o as { id: unknown }).id), name: (o as { name?: string }).name };
            }
            return { id: String(o) };
          }),
          metadata: data.metadata,
        };
      }
    } catch {
      // Not JSON - treat as plain tender ID
    }
    return {
      tenderId: fallbackTenderId,
      awardIds: [],
      offerers: [],
    };
  }

  async saveResult(result: TaggingResultModel): Promise<void> {
    const resultKey = key(this.config.prefixResults, `${result.tenderId}.json`);
    const body = JSON.stringify(result, null, 2);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: resultKey,
        Body: body,
        ContentType: 'application/json',
      }),
    );
  }
}
