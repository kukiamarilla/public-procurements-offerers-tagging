import { TaggingTaskModel } from '../models/tagging-task.model';
import { TaggingResultModel } from '../models/tagging-result.model';

export interface ListTasksInput {
  limit?: number;
  offset?: number;
  /** Si true, las pendientes aparecen primero */
  pendingFirst?: boolean;
}

export interface TaggingStats {
  total: number;
  saved: number;
}

export interface TaggingTaskRepository {
  listTasks(input?: ListTasksInput): Promise<TaggingTaskModel[]>;

  getStats(): Promise<TaggingStats>;

  saveResult(result: TaggingResultModel): Promise<void>;
}
