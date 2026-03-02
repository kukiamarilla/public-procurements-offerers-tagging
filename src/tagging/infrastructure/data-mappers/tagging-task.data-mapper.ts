import { TaggingTaskModel } from '../../domain/models/tagging-task.model';
import { TaggingTaskDto } from '../dto/tagging-task.dto';

export function taggingTaskToDto(model: TaggingTaskModel): TaggingTaskDto {
  return {
    ocid: model.ocid,
    tenderId: model.tenderId,
    awardIds: model.awardIds ?? [],
    offerers: model.offerers,
    pdfUrl: model.pdfUrl,
    pdfAdaUrl: model.pdfAdaUrl,
    pdfCcoUrl: model.pdfCcoUrl,
    saved: model.saved,
    savedOffererCount: model.savedOffererCount,
    metadata: model.metadata,
  };
}
