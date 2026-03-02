import { TaggingTaskModel } from '../models/tagging-task.model';
import { TaggingResultModel } from '../models/tagging-result.model';

export type TaskStatusFilter = 'pending' | 'saved' | 'discarded';

export interface ListTasksInput {
  limit?: number;
  offset?: number;
  /** Si true, las pendientes aparecen primero (deprecated: usar status) */
  pendingFirst?: boolean;
  /** Filtrar por estado: pending, saved, discarded. Pagina dentro de ese subconjunto. */
  status?: TaskStatusFilter;
}

export interface TaggingStats {
  total: number;
  saved: number;
  discarded: number;
}

export interface TaggingTaskRepository {
  listTasks(input?: ListTasksInput): Promise<TaggingTaskModel[]>;

  getStats(): Promise<TaggingStats>;

  saveResult(result: TaggingResultModel): Promise<void>;

  deleteResult(tenderId: string): Promise<void>;
}
