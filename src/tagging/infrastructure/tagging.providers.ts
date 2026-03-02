import { Provider } from '@nestjs/common';
import {
  DoSpacesConfig,
  DO_SPACES_CONFIG,
} from '../../shared/infrastructure/config/do-spaces.config';
import { createPresigner } from './services/spaces-presigner.service';
import { SpacesTaggingRepository } from './repositories/spaces-tagging.repository';
import { ListTaggingTasksUsecase } from '../application/usecases/list-tagging-tasks.usecase';
import { SaveTaggingResultUsecase } from '../application/usecases/save-tagging-result.usecase';
import { GetTaggingStatsUsecase } from '../application/usecases/get-tagging-stats.usecase';
import { TaggingTaskRepository } from '../domain/repositories/tagging-task.repository';

export const TAGGING_TASK_REPOSITORY = 'TAGGING_TASK_REPOSITORY';
export const LIST_TAGGING_TASKS_USECASE = 'LIST_TAGGING_TASKS_USECASE';
export const SAVE_TAGGING_RESULT_USECASE = 'SAVE_TAGGING_RESULT_USECASE';
export const GET_TAGGING_STATS_USECASE = 'GET_TAGGING_STATS_USECASE';

export function createTaggingProviders(): Provider[] {
  return [
    {
      provide: TAGGING_TASK_REPOSITORY,
      useFactory: (config: DoSpacesConfig) => {
        const presigner = createPresigner(config);
        return new SpacesTaggingRepository(config, presigner);
      },
      inject: [DO_SPACES_CONFIG],
    },
    {
      provide: LIST_TAGGING_TASKS_USECASE,
      useFactory: (repo: TaggingTaskRepository) =>
        new ListTaggingTasksUsecase(repo),
      inject: [TAGGING_TASK_REPOSITORY],
    },
    {
      provide: SAVE_TAGGING_RESULT_USECASE,
      useFactory: (repo: TaggingTaskRepository) =>
        new SaveTaggingResultUsecase(repo),
      inject: [TAGGING_TASK_REPOSITORY],
    },
    {
      provide: GET_TAGGING_STATS_USECASE,
      useFactory: (repo: TaggingTaskRepository) =>
        new GetTaggingStatsUsecase(repo),
      inject: [TAGGING_TASK_REPOSITORY],
    },
  ];
}
