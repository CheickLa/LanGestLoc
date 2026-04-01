import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
