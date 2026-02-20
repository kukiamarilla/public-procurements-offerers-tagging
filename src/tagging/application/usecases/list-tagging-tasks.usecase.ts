import {
  TaggingTaskRepository,
  ListTasksInput,
} from '../../domain/repositories/tagging-task.repository';
import { TaggingTaskModel } from '../../domain/models/tagging-task.model';

export class ListTaggingTasksUsecase {
  constructor(private readonly repository: TaggingTaskRepository) {}

  async execute(input?: ListTasksInput): Promise<TaggingTaskModel[]> {
    return this.repository.listTasks(input);
  }
}
