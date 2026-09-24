import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';

/**
 * Contexte des commandes CLI : configuration et base de données seulement.
 * Volontairement sans AppModule : ni S3, ni crons pendant une commande ponctuelle.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
export class CliModule {}
