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
  /** Presigned URL for Acta de Apertura ({tenderId}-ada.pdf) */
  pdfAdaUrl?: string;
  /** Presigned URL for Cuadro Comparativo de Ofertas ({tenderId}-cco.pdf) */
  pdfCcoUrl?: string;
  /** Si ya existe un resultado guardado para esta tarea */
  saved?: boolean;
  /** Cantidad de oferentes guardada (si saved) */
  savedOffererCount?: number;
  metadata?: Record<string, unknown>;
}
