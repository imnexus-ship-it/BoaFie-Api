import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { offsetFor } from '../../common/dto/pagination.dto';
import { ArtisansRepository } from './artisans.repository';
import { toArtisanProfile } from './artisan-profile.entity';
import { QueryArtisansDto } from './dto/query-artisans.dto';
import { CreateArtisanProfileDto } from './dto/create-artisan-profile.dto';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class ArtisansService {
  constructor(private readonly artisans: ArtisansRepository) {}

  async list(query: QueryArtisansDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { rows, total } = await this.artisans.list(
      {
        category: query.category,
        location: query.location,
        availability: query.availability,
        rate_max: query.rate_max,
        rating_min: query.rating_min,
        verified: query.verified,
      },
      query.sort,
      limit,
      offsetFor(page, limit),
    );
    return {
      items: rows.map(toArtisanProfile),
      meta: { page, limit, total },
    };
  }

  async getById(id: string) {
    const row = await this.artisans.findByIdWithUser(id);
    if (!row) throw new NotFoundException('Artisan profile not found');
    await this.artisans.incrementViews(id);
    return toArtisanProfile(row);
  }

  async getMine(userId: string) {
    const row = await this.artisans.findByUserId(userId);
    if (!row) throw new NotFoundException('Artisan profile not found');
    return toArtisanProfile(row);
  }

  async create(userId: string, dto: CreateArtisanProfileDto) {
    const existing = await this.artisans.findByUserId(userId);
    if (existing) throw new ConflictException('Artisan profile already exists');
    const row = await this.artisans.insert({ ...dto, user_id: userId });
    return toArtisanProfile(row);
  }

  async update(userId: string, dto: UpdateArtisanProfileDto) {
    const existing = await this.artisans.findByUserId(userId);
    if (!existing) throw new NotFoundException('Artisan profile not found');
    const updated = await this.artisans.updateById(existing.id, dto as Record<string, unknown>);
    return toArtisanProfile(updated!);
  }

  async updateAvailability(userId: string, dto: UpdateAvailabilityDto) {
    const existing = await this.artisans.findByUserId(userId);
    if (!existing) throw new NotFoundException('Artisan profile not found');
    const updated = await this.artisans.updateById(
      existing.id,
      dto as unknown as Record<string, unknown>,
    );
    return toArtisanProfile(updated!);
  }
}
