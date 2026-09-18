import 'dotenv/config';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const allowedOrigins: (string | RegExp)[] = [
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (process.env.FRONTEND_URL) {
    const configuredOrigins = process.env.FRONTEND_URL.split(',').map((url) =>
      url.trim(),
    );
    allowedOrigins.push(...configuredOrigins);
  }

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Link Expiry API')
    .setDescription('Temporary message sharing API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on port ${port} (0.0.0.0)`);
  logger.log(`Swagger docs available at port ${port}: /api/docs`);
}

void bootstrap().catch((err: unknown) => {
  console.error('Fatal error during application bootstrap:', err);
  process.exit(1);
});
