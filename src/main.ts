import { webcrypto } from "node:crypto";
(globalThis as Record<string, unknown>).crypto ??= webcrypto;

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // Validation pipe — strips unknown fields, transforms types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter for consistent error shape
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS — tighten origins in production
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `🚀 Macropage Connect running on http://localhost:${port}/api/v1`,
  );
}

void bootstrap();
