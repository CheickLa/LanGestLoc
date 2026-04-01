import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReceiptsModule } from '@/receipts/receipts.module';

@Module({
  imports: [PrismaModule, ReceiptsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
