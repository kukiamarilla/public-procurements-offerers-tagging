import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DoSpacesConfig } from '../../../shared/infrastructure/config/do-spaces.config';

/**
 * Generates presigned URLs for S3/DO Spaces objects.
 */
export function createPresigner(config: DoSpacesConfig): (key: string, expiresIn?: number) => Promise<string> {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false,
  });

  return async (s3Key: string, expiresIn = 3600): Promise<string> => {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    });
    return getSignedUrl(client, command, { expiresIn });
  };
}
