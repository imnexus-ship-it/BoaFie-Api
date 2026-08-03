import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('contracts/:id/reviews')
  create(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(id, user.id, dto);
  }

  @Public()
  @Get('users/:id/reviews')
  listForWorker(@Param('id') id: string) {
    return this.reviewsService.listForWorker(id);
  }
}
