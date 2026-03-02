import {
  TaggingTaskRepository,
  TaggingStats,
} from '../../domain/repositories/tagging-task.repository';

export class GetTaggingStatsUsecase {
  constructor(private readonly repository: TaggingTaskRepository) {}

  async execute(): Promise<TaggingStats> {
    return this.repository.getStats();
  }
}
