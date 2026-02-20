import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { TaggingTaskRepository, ListTasksInput } from '../../domain/repositories/tagging-task.repository';
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

  async listTasks(input?: ListTasksInput): Promise<TaggingTaskModel[]> {
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;

    const tenderIds = await this.collectTenderIds();
    const slice = tenderIds.slice(offset, offset + limit);

    const tasks: TaggingTaskModel[] = [];
    for (const { ocid, tenderId, awardIds, inputKey } of slice) {
      const task = await this.buildTaskForTender({ ocid, tenderId, awardIds }, inputKey);
      if (task) tasks.push(task);
    }
    return tasks;
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
      const pdfKey = key(this.config.prefixPdfs, `${tenderId}.pdf`);
      if (this.getSignedUrl) {
        pdfUrl = await this.getSignedUrl(pdfKey, 3600);
      }

      return {
        ocid: resolvedOcid,
        tenderId: parsed.tenderId,
        awardIds: resolvedAwardIds,
        offerers: parsed.offerers,
        pdfUrl,
        metadata: parsed.metadata,
      };
    } catch {
      return null;
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
