import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CreateLinkDto } from './dto/create-link.dto';
import { AccessLinkDto } from './dto/access-link.dto';
import { LinksService } from './links.service';

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a temporary message',
  })
  @ApiResponse({
    status: 201,
    description: 'Temporary message created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  createLink(@Body() createLinkDto: CreateLinkDto) {
    return this.linksService.createLink(createLinkDto);
  }

  @Get('/:shortCode')
  @ApiOperation({
    summary: 'Access a public temporary message',
  })
  @ApiResponse({
    status: 200,
    description: 'Message retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Link not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Password required for protected link',
  })
  @ApiResponse({
    status: 410,
    description: 'Link expired, exhausted, or already used',
  })
  getLinkByShortCode(@Param('shortCode') shortCode: string) {
    return this.linksService.accessLink(shortCode);
  }

  @Post('/:shortCode/access')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Access a protected temporary message',
  })
  @ApiResponse({
    status: 200,
    description: 'Message retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing password',
  })
  @ApiResponse({
    status: 404,
    description: 'Link not found',
  })
  @ApiResponse({
    status: 410,
    description: 'Link expired, exhausted, or already used',
  })
  accessLink(
    @Param('shortCode') shortCode: string,
    @Body() accessLinkDto: AccessLinkDto,
  ) {
    return this.linksService.accessLink(shortCode, accessLinkDto.password);
  }
}
