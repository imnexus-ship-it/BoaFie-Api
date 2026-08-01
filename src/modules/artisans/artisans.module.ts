import { Module } from '@nestjs/common';
import { ArtisansController } from './artisans.controller';
import { ArtisansService } from './artisans.service';
import { ArtisansRepository } from './artisans.repository';

@Module({
  controllers: [ArtisansController],
  providers: [ArtisansService, ArtisansRepository],
})
export class ArtisansModule {}
