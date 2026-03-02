/**
 * Result of a tagging operation.
 * Tag = number of offerers (cantidad de oferentes).
 * discarded = true cuando se descarta por PDFs incorrectos (se puede deshacer).
 */
export interface TaggingResultModel {
  ocid?: string;
  tenderId: string;
  awardIds?: string[];
  offererCount?: number;
  discarded?: boolean;
  taggedAt: string;
  metadata?: Record<string, unknown>;
}
