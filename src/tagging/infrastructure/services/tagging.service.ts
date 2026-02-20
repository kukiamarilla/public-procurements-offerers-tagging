import { Injectable, Inject } from '@nestjs/common';
import {
  LIST_TAGGING_TASKS_USECASE,
  SAVE_TAGGING_RESULT_USECASE,
} from '../tagging.providers';
import { ListTaggingTasksUsecase } from '../../application/usecases/list-tagging-tasks.usecase';
import { SaveTaggingResultUsecase } from '../../application/usecases/save-tagging-result.usecase';
import { taggingTaskToDto } from '../data-mappers/tagging-task.data-mapper';
import { TaggingTaskDto } from '../dto/tagging-task.dto';
import { SaveResultDto } from '../dto/save-result.dto';

@Injectable()
export class TaggingService {
  constructor(
    @Inject(LIST_TAGGING_TASKS_USECASE)
    private readonly listTasksUsecase: ListTaggingTasksUsecase,
    @Inject(SAVE_TAGGING_RESULT_USECASE)
    private readonly saveResultUsecase: SaveTaggingResultUsecase,
  ) {}

  async listTasks(limit?: number, offset?: number): Promise<TaggingTaskDto[]> {
    const tasks = await this.listTasksUsecase.execute({ limit, offset });
    return tasks.map(taggingTaskToDto);
  }

  async saveResult(dto: SaveResultDto): Promise<void> {
    await this.saveResultUsecase.execute({
      ocid: dto.ocid,
      tenderId: dto.tenderId,
      awardIds: dto.awardIds,
      offererCount: dto.offererCount,
      metadata: dto.metadata,
    });
  }
}
