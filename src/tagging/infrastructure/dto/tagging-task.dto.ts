export interface TaggingTaskDto {
  ocid?: string;
  tenderId: string;
  awardIds: string[];
  offerers: { id: string; name?: string }[];
  pdfUrl?: string;
  pdfAdaUrl?: string;
  pdfCcoUrl?: string;
  saved?: boolean;
  savedOffererCount?: number;
  metadata?: Record<string, unknown>;
}
