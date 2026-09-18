import {
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateLinkDto } from './dto/create-link.dto';

@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private isCacheable(link: {
    passwordHash: string | null;
    maxVisits: number | null;
    oneTime: boolean;
  }) {
    return !link.passwordHash && link.maxVisits === null && !link.oneTime;
  }

  async createLink(createLinkDto: CreateLinkDto) {
    const expiresAt = new Date(Date.now() + createLinkDto.expiresIn * 1000);

    const passwordHash = createLinkDto.password
      ? await bcrypt.hash(createLinkDto.password, 10)
      : null;

    const link = await this.prisma.link.create({
      data: {
        id: crypto.randomUUID(),
        code: crypto.randomUUID().slice(0, 8),
        message: createLinkDto.message,
        expiresAt,
        maxVisits: createLinkDto.maxVisits,
        oneTime: createLinkDto.oneTime ?? false,
        passwordHash,
        updatedAt: new Date(),
      },
    });

    if (this.isCacheable(link)) {
      await this.redis.setWithExpiry(
        `link:${link.code}`,
        link.message,
        createLinkDto.expiresIn,
      );
    }

    return {
      code: link.code,
      expiresAt: link.expiresAt,
    };
  }

  async accessLink(shortCode: string, password?: string) {
    // 1. Check Redis first
    const cachedMessage = await this.redis.get(`link:${shortCode}`);

    if (cachedMessage !== null) {
      return {
        message: cachedMessage,
      };
    }

    // 2. Find the link in PostgreSQL
    const link = await this.prisma.link.findUnique({
      where: {
        code: shortCode,
      },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    // 3. Check expiration
    if (link.expiresAt <= new Date()) {
      throw new GoneException('Link has expired');
    }

    // 4. Check password if protected
    if (link.passwordHash) {
      if (!password) {
        throw new UnauthorizedException('Password is required');
      }

      const isPasswordValid = await bcrypt.compare(password, link.passwordHash);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // 5. Atomically claim access
    const result = await this.prisma.link.updateMany({
      where: {
        id: link.id,
        AND: [
          {
            OR: [
              {
                maxVisits: null,
              },
              {
                maxVisits: {
                  gt: link.visitCount,
                },
              },
            ],
          },
          ...(link.oneTime
            ? [
                {
                  used: false,
                },
              ]
            : []),
        ],
      },
      data: {
        visitCount: {
          increment: 1,
        },
        ...(link.oneTime
          ? {
              used: true,
            }
          : {}),
        updatedAt: new Date(),
      },
    });

    // 6. Access could not be claimed
    if (result.count === 0) {
      if (link.oneTime && link.used) {
        throw new GoneException('Link has already been used');
      }

      throw new GoneException('Link has reached its maximum visits');
    }

    // 7. Return the message
    return {
      message: link.message,
    };
  }

  // Runs at the beginning of every hour
  @Cron('0 * * * *')
  async cleanupExpiredLinks() {
    const result = await this.prisma.link.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} expired link(s)`);
    }
  }
}
