import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { PaymentsModule } from '@/payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
