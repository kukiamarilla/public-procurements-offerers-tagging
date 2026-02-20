import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TaggingModule } from './tagging/tagging.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TaggingModule,
  ],
})
export class AppModule {}
