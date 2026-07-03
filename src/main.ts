import { webcrypto } from "node:crypto";
(globalThis as Record<string, unknown>).crypto ??= webcrypto;

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Preserve raw body for Razorpay webhook signature verification
  app.use(
    "/api/v1/billing/webhook",
    express.raw({ type: "application/json" }),
    (
      req: express.Request & { rawBody?: string },
      _res: express.Response,
      next: express.NextFunction,
    ) => {
      if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body.toString("utf8");
        req.body = JSON.parse(req.rawBody) as unknown;
      }
      next();
    },
  );

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
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `🚀 Macropage Connect running on http://localhost:${port}/api/v1`,
  );
}

void bootstrap();
