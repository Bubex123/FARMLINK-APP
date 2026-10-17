import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const production = process.env.NODE_ENV === 'production';
  const frontendOrigins = process.env.FRONTEND_URL?.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (production && !frontendOrigins?.length) {
    throw new Error('FRONTEND_URL must list the deployed frontend origin(s) in production.');
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.enableCors({
    origin: frontendOrigins?.length ? frontendOrigins : ['http://localhost:3000'],
  });
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
