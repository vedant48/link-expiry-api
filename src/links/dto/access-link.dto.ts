import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, MinLength } from 'class-validator';

export class AccessLinkDto {
  @ApiPropertyOptional({
    description: 'Password for a protected message',
    example: 'secret123',
    minLength: 4,
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}
