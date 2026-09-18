import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@ApiTags('System')
@SkipThrottle()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API welcome endpoint' })
  @ApiResponse({ status: 200, description: 'Service status greeting' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Service health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and responding',
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
