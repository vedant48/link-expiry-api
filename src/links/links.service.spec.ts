import { GoneException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LinksService } from './links.service';

describe('LinksService', () => {
  let service: LinksService;
  let prismaMock: {
    link: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let redisMock: {
    get: jest.Mock;
    setWithExpiry: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      link: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    redisMock = {
      get: jest.fn(),
      setWithExpiry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLink', () => {
    it('should create a link and cache it in Redis if cacheable', async () => {
      const mockLink = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'abc12345',
        message: 'Secret message',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        maxVisits: null,
        oneTime: false,
        passwordHash: null,
      };

      prismaMock.link.create.mockResolvedValue(mockLink);
      redisMock.setWithExpiry.mockResolvedValue('OK');

      const result = await service.createLink({
        message: 'Secret message',
        expiresIn: 3600,
      });

      expect(result.code).toBe(mockLink.code);
      expect(result.expiresAt).toEqual(mockLink.expiresAt);
      expect(redisMock.setWithExpiry).toHaveBeenCalledWith(
        `link:${mockLink.code}`,
        mockLink.message,
        3600,
      );
    });

    it('should create a protected link without caching in Redis', async () => {
      const mockLink = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        code: 'prot1234',
        message: 'Protected secret',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        maxVisits: null,
        oneTime: false,
        passwordHash: 'hashed_pw',
      };

      prismaMock.link.create.mockResolvedValue(mockLink);

      const result = await service.createLink({
        message: 'Protected secret',
        expiresIn: 3600,
        password: 'password123',
      });

      expect(result.code).toBe(mockLink.code);
      expect(redisMock.setWithExpiry).not.toHaveBeenCalled();
    });
  });

  describe('accessLink', () => {
    it('should return message from Redis cache if present', async () => {
      redisMock.get.mockResolvedValue('Cached hello');

      const result = await service.accessLink('short123');

      expect(result).toEqual({ message: 'Cached hello' });
      expect(prismaMock.link.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if link is not found in database', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.link.findUnique.mockResolvedValue(null);

      await expect(service.accessLink('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw GoneException if link has expired', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.link.findUnique.mockResolvedValue({
        id: 'uuid-1',
        code: 'expired1',
        message: 'Old secret',
        expiresAt: new Date(Date.now() - 10000),
        passwordHash: null,
        maxVisits: null,
        visitCount: 0,
        oneTime: false,
        used: false,
      });

      await expect(service.accessLink('expired1')).rejects.toThrow(
        GoneException,
      );
    });

    it('should throw UnauthorizedException if password is required but missing or wrong', async () => {
      const passwordHash = await bcrypt.hash('secretpass', 10);
      redisMock.get.mockResolvedValue(null);
      prismaMock.link.findUnique.mockResolvedValue({
        id: 'uuid-2',
        code: 'pass1234',
        message: 'Secret',
        expiresAt: new Date(Date.now() + 100000),
        passwordHash,
        maxVisits: null,
        visitCount: 0,
        oneTime: false,
        used: false,
      });

      // Missing password
      await expect(service.accessLink('pass1234')).rejects.toThrow(
        UnauthorizedException,
      );

      // Incorrect password
      await expect(
        service.accessLink('pass1234', 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return message and update visitCount for valid link', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.link.findUnique.mockResolvedValue({
        id: 'uuid-3',
        code: 'valid123',
        message: 'Valid message',
        expiresAt: new Date(Date.now() + 100000),
        passwordHash: null,
        maxVisits: 5,
        visitCount: 0,
        oneTime: false,
        used: false,
      });
      prismaMock.link.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.accessLink('valid123');
      expect(result).toEqual({ message: 'Valid message' });
      expect(prismaMock.link.updateMany).toHaveBeenCalled();
    });

    it('should throw GoneException if link claim count is 0', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.link.findUnique.mockResolvedValue({
        id: 'uuid-4',
        code: 'used1234',
        message: 'Used message',
        expiresAt: new Date(Date.now() + 100000),
        passwordHash: null,
        maxVisits: 1,
        visitCount: 1,
        oneTime: true,
        used: true,
      });
      prismaMock.link.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.accessLink('used1234')).rejects.toThrow(
        GoneException,
      );
    });
  });

  describe('cleanupExpiredLinks', () => {
    it('should delete expired links', async () => {
      prismaMock.link.deleteMany.mockResolvedValue({ count: 3 });

      await service.cleanupExpiredLinks();

      expect(prismaMock.link.deleteMany).toHaveBeenCalled();
    });
  });
});
