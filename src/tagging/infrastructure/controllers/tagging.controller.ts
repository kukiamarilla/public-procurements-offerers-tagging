import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { TaggingService } from '../services/tagging.service';
import { SaveResultDto } from '../dto/save-result.dto';

@Controller('tagging')
export class TaggingController {
  constructor(private readonly taggingService: TaggingService) {}

  @Get('tasks')
  async listTasks(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tasks = await this.taggingService.listTasks(
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
    return { tasks };
  }

  @Post('result')
  async saveResult(@Body() dto: SaveResultDto) {
    await this.taggingService.saveResult(dto);
    return { success: true };
  }
}
