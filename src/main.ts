import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const apiPrefix = config.get<string>('API_PREFIX', 'api');

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({ origin: true });

  await app.listen(port);
  console.log(`App running at http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
