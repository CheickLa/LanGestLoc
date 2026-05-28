import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { LocalsModule } from './locals/locals.module';
import { TenantsModule } from './tenants/tenants.module';
import { ContractsModule } from './contracts/contracts.module';
import { RentsModule } from './rents/rents.module';
import { RentDueModule } from './rent-due/rent-due.module';
import { PaymentsModule } from './payments/payments.module';
import { S3Module } from './s3/s3.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    S3Module,
    AuthModule,
    LocalsModule,
    TenantsModule,
    ContractsModule,
    RentsModule,
    RentDueModule,
    PaymentsModule,
    ReceiptsModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
