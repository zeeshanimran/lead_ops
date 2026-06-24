import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { requireConfig, requireConfigNumber } from './config/required-env';
import { PendingApprovalsGateway } from './realtime/pending-approvals.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const express = app.getHttpAdapter().getInstance();

  if (typeof express.disable === 'function') {
    express.disable('x-powered-by');
  }

  app.enableCors({
    origin: requireConfig(config, 'CORS_ORIGIN'),
    credentials: true,
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (config.get<string>('ENABLE_API_DOCS') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LeadOps CRM API')
      .setDescription('LeadOps CRM API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const server = await app.listen(requireConfigNumber(config, 'PORT'));
  app.get(PendingApprovalsGateway).attach(server);
}

void bootstrap();
