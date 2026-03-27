import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { LocalsModule } from './locals/locals.module';
import { TenantsModule } from './tenants/tenants.module';
import { ContractsModule } from './contracts/contracts.module';
import { RentsModule } from './rents/rents.module';
import { RentDueModule } from './rent-due/rent-due.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    LocalsModule,
    TenantsModule,
    ContractsModule,
    RentsModule,
    RentDueModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
