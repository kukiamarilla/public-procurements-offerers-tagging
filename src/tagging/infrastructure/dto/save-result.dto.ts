export interface SaveResultDto {
  ocid?: string;
  tenderId: string;
  awardIds?: string[];
  offererCount: number;
  metadata?: Record<string, unknown>;
}
