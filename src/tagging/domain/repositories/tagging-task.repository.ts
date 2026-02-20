import { TaggingTaskModel } from '../models/tagging-task.model';
import { TaggingResultModel } from '../models/tagging-result.model';

export interface ListTasksInput {
  limit?: number;
  offset?: number;
}

export interface TaggingTaskRepository {
  listTasks(input?: ListTasksInput): Promise<TaggingTaskModel[]>;

  saveResult(result: TaggingResultModel): Promise<void>;
}
