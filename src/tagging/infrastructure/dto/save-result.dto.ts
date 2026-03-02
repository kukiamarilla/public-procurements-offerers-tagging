export interface SaveResultDto {
  ocid?: string;
  tenderId: string;
  awardIds?: string[];
  offererCount?: number;
  discarded?: boolean;
  metadata?: Record<string, unknown>;
}
