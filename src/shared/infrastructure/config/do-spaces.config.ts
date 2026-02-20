export interface DoSpacesConfig {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefixInput: string;
  prefixPdfs: string;
  prefixResults: string;
}

export const DO_SPACES_CONFIG = 'DO_SPACES_CONFIG';
