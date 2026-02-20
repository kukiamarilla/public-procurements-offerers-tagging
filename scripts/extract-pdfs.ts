#!/usr/bin/env npx ts-node
/**
 * Extrae PDFs de licitaciones y los sube al bucket.
 *
 * Uso:
 *   npx ts-node scripts/extract-pdfs.ts
 *
 * Este script debe:
 * 1. Leer los IDs de licitación desde DO_SPACES_PREFIX_INPUT
 * 2. Para cada ID, ejecutar la lógica de extracción (ej: descargar de DNCP API)
 * 3. Subir los PDFs a DO_SPACES_PREFIX_PDFS como {tenderId}.pdf
 *
 * Dependencias sugeridas:
 *   - @aws-sdk/client-s3 (ya instalado)
 *   - pdf-lib o pdfplumber para generar/mergear PDFs
 *   - axios para descargar de contrataciones.gov.py
 */

import 'dotenv/config';

async function main() {
  const bucket = process.env.DO_SPACES_BUCKET;
  const prefixInput = process.env.DO_SPACES_PREFIX_INPUT ?? 'tagging/input';
  const prefixPdfs = process.env.DO_SPACES_PREFIX_PDFS ?? 'tagging/pdfs';

  console.log('PLACEHOLDER: extracción de PDFs');
  console.log('  Bucket:', bucket ?? '(no configurado)');
  console.log('  Input prefix:', prefixInput);
  console.log('  Output PDFs prefix:', prefixPdfs);
  console.log('');
  console.log('Implementar:');
  console.log('  1. Listar objetos en', prefixInput);
  console.log('  2. Para cada ID, descargar documentos de DNCP API');
  console.log('  3. Subir PDF resultante a', prefixPdfs, 'como {tenderId}.pdf');
}

main().catch(console.error);
