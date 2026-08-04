import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async list() {
    const { rows } = await this.db.query(
      'SELECT id, name, slug, type, icon, description FROM categories WHERE is_active = TRUE ORDER BY sort_order',
    );
    return rows;
  }
}
