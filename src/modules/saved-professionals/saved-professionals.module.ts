import { Module } from '@nestjs/common';
import { SavedProfessionalsController } from './saved-professionals.controller';
import { SavedProfessionalsService } from './saved-professionals.service';

@Module({
  controllers: [SavedProfessionalsController],
  providers: [SavedProfessionalsService],
})
export class SavedProfessionalsModule {}
