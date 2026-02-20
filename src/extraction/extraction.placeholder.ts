/**
 * PLACEHOLDER: Lógica de extracción de PDFs.
 *
 * Este módulo debe:
 * 1. Leer los IDs de licitación desde el prefix de input del bucket
 * 2. Para cada ID, ejecutar la lógica de extracción (ej: descargar de DNCP API, procesar documentos)
 * 3. Escribir los PDFs extraídos en el prefix de output del bucket
 *
 * Dependencias sugeridas (no instaladas):
 * - pdfplumber o pdf-lib para manipulación de PDFs
 * - axios/fetch para descargar documentos de contrataciones.gov.py
 *
 * Ejemplo de flujo:
 *   const tenderIds = await readTenderIdsFromBucket(inputPrefix);
 *   for (const id of tenderIds) {
 *     const pdfBuffer = await extractPdfForTender(id);  // <-- implementar
 *     await uploadToBucket(outputPrefix, `${id}.pdf`, pdfBuffer);
 *   }
 */

import { DoSpacesConfig } from '../shared/infrastructure/config/do-spaces.config';

export interface ExtractionResult {
  tenderId: string;
  success: boolean;
  outputKey?: string;
  error?: string;
}

export async function extractPdfsPlaceholder(
  _config: DoSpacesConfig,
  _tenderIds: string[],
): Promise<ExtractionResult[]> {
  // Placeholder: retorna resultados simulados
  return _tenderIds.map((tenderId) => ({
    tenderId,
    success: false,
    error: 'PDF extraction not implemented - replace with real logic',
  }));
}
