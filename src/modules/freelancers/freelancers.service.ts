import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { offsetFor } from '../../common/dto/pagination.dto';
import { FreelancersRepository } from './freelancers.repository';
import { toFreelancerProfile } from './freelancer-profile.entity';
import { QueryFreelancersDto } from './dto/query-freelancers.dto';
import { CreateFreelancerProfileDto } from './dto/create-freelancer-profile.dto';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class FreelancersService {
  constructor(private readonly freelancers: FreelancersRepository) {}

  async list(query: QueryFreelancersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skills = query.skills
      ? query.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const remote = query.remote === undefined ? undefined : query.remote === 'true';

    const { rows, total } = await this.freelancers.list(
      { skills, rate_max: query.rate_max, remote, rating_min: query.rating_min, verified: query.verified },
      query.sort,
      limit,
      offsetFor(page, limit),
    );
    return {
      items: rows.map(toFreelancerProfile),
      meta: { page, limit, total },
    };
  }

  async getById(id: string) {
    const row = await this.freelancers.findByIdWithUser(id);
    if (!row) throw new NotFoundException('Freelancer profile not found');
    await this.freelancers.incrementViews(id);
    return toFreelancerProfile(row);
  }

  async getMine(userId: string) {
    const row = await this.freelancers.findByUserId(userId);
    if (!row) throw new NotFoundException('Freelancer profile not found');
    return toFreelancerProfile(row);
  }

  async create(userId: string, dto: CreateFreelancerProfileDto) {
    const existing = await this.freelancers.findByUserId(userId);
    if (existing) throw new ConflictException('Freelancer profile already exists');
    const row = await this.freelancers.insert({ ...dto, user_id: userId });
    return toFreelancerProfile(row);
  }

  async update(userId: string, dto: UpdateFreelancerProfileDto) {
    const existing = await this.freelancers.findByUserId(userId);
    if (!existing) throw new NotFoundException('Freelancer profile not found');
    const updated = await this.freelancers.updateById(existing.id, dto as Record<string, unknown>);
    return toFreelancerProfile(updated!);
  }

  async updateAvailability(userId: string, dto: UpdateAvailabilityDto) {
    const existing = await this.freelancers.findByUserId(userId);
    if (!existing) throw new NotFoundException('Freelancer profile not found');
    const updated = await this.freelancers.updateById(
      existing.id,
      dto as unknown as Record<string, unknown>,
    );
    return toFreelancerProfile(updated!);
  }
}
