import { Module } from '@nestjs/common';
import { LocalsService } from './locals.service';
import { LocalsController } from './locals.controller';

@Module({
  controllers: [LocalsController],
  providers: [LocalsService],
})
export class LocalsModule {}
