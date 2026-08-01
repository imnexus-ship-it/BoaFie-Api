import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Public()
  @Get()
  list(@Query() query: SearchJobsDto) {
    return this.jobsService.search(query);
  }

  @Get('my-posts')
  myPosts(@CurrentUser() user: RequestUser, @Query() query: SearchJobsDto) {
    return this.jobsService.myPosts(user.id, query.page, query.limit);
  }

  @Get('recommended')
  recommended(@CurrentUser() user: RequestUser) {
    return this.jobsService.recommended(user.id, user.role);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateJobDto) {
    return this.jobsService.create(user.id, dto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.jobsService.remove(id, user.id);
  }

  @Patch(':id/close')
  close(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.jobsService.close(id, user.id);
  }
}
