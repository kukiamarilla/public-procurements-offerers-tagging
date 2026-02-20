export interface TaggingTaskDto {
  ocid?: string;
  tenderId: string;
  awardIds: string[];
  offerers: { id: string; name?: string }[];
  pdfUrl?: string;
  metadata?: Record<string, unknown>;
}
