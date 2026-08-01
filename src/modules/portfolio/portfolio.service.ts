import { Injectable, NotFoundException } from '@nestjs/common';
import { PortfolioRepository } from './portfolio.repository';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto';

@Injectable()
export class PortfolioService {
  constructor(private readonly portfolio: PortfolioRepository) {}

  list(userId: string) {
    return this.portfolio.listForUser(userId);
  }

  create(userId: string, dto: CreatePortfolioItemDto) {
    return this.portfolio.insert({ ...dto, user_id: userId });
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleted = await this.portfolio.deleteForUser(id, userId);
    if (!deleted) throw new NotFoundException('Portfolio item not found');
  }

  async toggleFeature(id: string, userId: string) {
    const updated = await this.portfolio.toggleFeatured(id, userId);
    if (!updated) throw new NotFoundException('Portfolio item not found');
    return updated;
  }
}
