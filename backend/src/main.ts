import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@/app.module';
import { parseTrustProxyHops } from '@/common/trust-proxy';

async function bootstrap() {
  // Lu avant de créer l'app : une valeur invalide arrête tout de suite le démarrage
  const trustProxyHops = parseTrustProxyHops(process.env.TRUST_PROXY_HOPS);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', trustProxyHops);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentation réservée au dev et à la CI : en production, elle exposerait
  // publiquement toutes les routes et tous les DTO de l'API.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LanGestLoc API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    SwaggerModule.setup('api', app, () =>
      SwaggerModule.createDocument(app, config),
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
