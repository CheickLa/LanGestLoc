import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { ContractDocumentsService } from './contract-documents.service';
import { PaymentsModule } from '@/payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractDocumentsService],
})
export class ContractsModule {}
