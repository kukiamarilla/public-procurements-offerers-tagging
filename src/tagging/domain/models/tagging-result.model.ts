/**
 * Result of a tagging operation.
 * Tag = number of offerers (cantidad de oferentes).
 */
export interface TaggingResultModel {
  ocid?: string;
  tenderId: string;
  awardIds?: string[];
  offererCount: number;
  taggedAt: string;
  metadata?: Record<string, unknown>;
}
