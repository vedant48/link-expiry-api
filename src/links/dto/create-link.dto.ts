import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLinkDto {
  @ApiProperty({
    description: 'Temporary message to store',
    example: 'Hello, this message will expire!',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  message: string;

  @ApiProperty({
    description: 'Time until the message expires, in seconds',
    example: 3600,
    minimum: 60,
    maximum: 604800,
  })
  @IsInt()
  @Min(60)
  @Max(604800)
  expiresIn: number;

  @ApiPropertyOptional({
    description: 'Maximum number of successful accesses',
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxVisits?: number;

  @ApiPropertyOptional({
    description: 'Password required to access the message',
    example: 'secret123',
    minLength: 4,
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @ApiPropertyOptional({
    description: 'Allow the message to be accessed only once',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  oneTime?: boolean;
}
