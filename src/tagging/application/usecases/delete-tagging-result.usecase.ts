import { TaggingTaskRepository } from '../../domain/repositories/tagging-task.repository';

export class DeleteTaggingResultUsecase {
  constructor(private readonly repository: TaggingTaskRepository) {}

  async execute(tenderId: string): Promise<void> {
    await this.repository.deleteResult(tenderId);
  }
}
