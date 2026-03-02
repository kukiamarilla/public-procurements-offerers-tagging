import { TaggingTaskRepository } from '../../domain/repositories/tagging-task.repository';
import { TaggingResultModel } from '../../domain/models/tagging-result.model';

export interface SaveTaggingResultInput {
  ocid?: string;
  tenderId: string;
  awardIds?: string[];
  offererCount?: number;
  discarded?: boolean;
  metadata?: Record<string, unknown>;
}

export class SaveTaggingResultUsecase {
  constructor(private readonly repository: TaggingTaskRepository) {}

  async execute(input: SaveTaggingResultInput): Promise<void> {
    const result: TaggingResultModel = {
      ocid: input.ocid,
      tenderId: input.tenderId,
      awardIds: input.awardIds,
      offererCount: input.offererCount,
      discarded: input.discarded,
      taggedAt: new Date().toISOString(),
      metadata: input.metadata,
    };
    await this.repository.saveResult(result);
  }
}
