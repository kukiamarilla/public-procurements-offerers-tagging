/**
 * A tagging task represents a tender (licitación) to be tagged.
 * Cada licitación puede tener: ocid, tenderId y varios awardIds.
 */
export interface Offerer {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface TaggingTaskModel {
  ocid?: string;
  tenderId: string;
  awardIds: string[];
  offerers: Offerer[];
  pdfUrl?: string;
  metadata?: Record<string, unknown>;
}
