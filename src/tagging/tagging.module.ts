import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaggingController } from './infrastructure/controllers/tagging.controller';
import { TaggingService } from './infrastructure/services/tagging.service';
import { createTaggingProviders } from './infrastructure/tagging.providers';
import { DO_SPACES_CONFIG } from '../shared/infrastructure/config/do-spaces.config';
import type { DoSpacesConfig } from '../shared/infrastructure/config/do-spaces.config';


@Module({
  controllers: [TaggingController],
  providers: [
    TaggingService,
    {
      provide: DO_SPACES_CONFIG,
      useFactory: (config: ConfigService): DoSpacesConfig => ({
        bucket: config.get<string>('DO_SPACES_BUCKET', ''),
        region: config.get<string>('DO_SPACES_REGION', 'tor1'),
        endpoint: config.get<string>(
          'DO_SPACES_ENDPOINT',
          'https://tor1.digitaloceanspaces.com',
        ),
        accessKeyId: config.get<string>('DO_SPACES_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('DO_SPACES_SECRET_ACCESS_KEY', ''),
        prefixInput: config.get<string>('DO_SPACES_PREFIX_INPUT', 'tagging/input'),
        prefixPdfs: config.get<string>('DO_SPACES_PREFIX_PDFS', 'tagging/pdfs'),
        prefixResults: config.get<string>(
          'DO_SPACES_PREFIX_RESULTS',
          'tagging/results',
        ),
      }),
      inject: [ConfigService],
    },
    ...createTaggingProviders(),
  ],
})
export class TaggingModule {}
