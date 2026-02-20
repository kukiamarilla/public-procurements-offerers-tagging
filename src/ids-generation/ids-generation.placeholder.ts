/**
 * PLACEHOLDER: Lógica para generar ids.txt y subirlo al bucket.
 *
 * Sin inputs externos, solo usa configs.
 * La URL es parte de la lógica interna; los configs son un listado dinámico de query params.
 */

import { DoSpacesConfig } from '../shared/infrastructure/config/do-spaces.config';

export interface IdsGenerationConfig {
  /** Query params dinámicos (definidos en config/constante, no env) */
  queryParams: Record<string, string>;
}

export interface IdsGenerationResult {
  count: number;
  outputKey: string;
  error?: string;
}

export async function generateIdsPlaceholder(
  _spacesConfig: DoSpacesConfig,
  _config: IdsGenerationConfig,
): Promise<IdsGenerationResult> {
  // Placeholder: implementar obtención de IDs y subida de ids.txt
  return {
    count: 0,
    outputKey: '',
    error: 'IDS generation not implemented - replace with real logic',
  };
}
