import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, ConsoleLogger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: process.env.NODE_ENV === "production" }),
  });
  const config = app.get(ConfigService);
  for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"])
    if ((config.get<string>(name)?.length || 0) < 32)
      throw new Error(`${name} must contain at least 32 characters`);
  if (config.get("JWT_ACCESS_SECRET") === config.get("JWT_REFRESH_SECRET"))
    throw new Error("JWT secrets must be distinct");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow("FRONTEND_URL"),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  const spec = new DocumentBuilder()
    .setTitle("Ever After API")
    .setDescription(
      "Wedding planning, team authorization and durable Google Calendar synchronization",
    )
    .setVersion("1.0")
    .addCookieAuth("access_token")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, spec));
  await app.listen(config.get("PORT") || 4000, "0.0.0.0");
  new Logger("Bootstrap").log("API listening. Open /docs for OpenAPI.");
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
