import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RentDueService } from './rent-due.service';
import { RentDueController } from './rent-due.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [RentDueController],
  providers: [RentDueService],
})
export class RentDueModule {}
