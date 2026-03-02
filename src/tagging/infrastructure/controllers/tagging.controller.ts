import { Controller, Get, Post, Delete, Body, Query, Param } from '@nestjs/common';
import { TaggingService } from '../services/tagging.service';
import { SaveResultDto } from '../dto/save-result.dto';

@Controller('tagging')
export class TaggingController {
  constructor(private readonly taggingService: TaggingService) {}

  @Get('stats')
  async getStats() {
    return this.taggingService.getStats();
  }

  @Get('tasks')
  async listTasks(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('pendingFirst') pendingFirst?: string,
  ) {
    const tasks = await this.taggingService.listTasks(
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
      pendingFirst === 'true' || pendingFirst === '1',
    );
    return { tasks };
  }

  @Post('result')
  async saveResult(@Body() dto: SaveResultDto) {
    await this.taggingService.saveResult(dto);
    return { success: true };
  }

  @Delete('result/:tenderId')
  async deleteResult(@Param('tenderId') tenderId: string) {
    await this.taggingService.deleteResult(tenderId);
    return { success: true };
  }
}
