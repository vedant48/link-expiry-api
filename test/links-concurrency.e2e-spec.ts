import { Test } from '@nestjs/testing';
import { GoneException } from '@nestjs/common';
import { LinksService } from '../src/links/links.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

// Explicit, dedicated test database only; never implicitly use the app database.
const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
describeWithDb('LinksService concurrency (PostgreSQL)', () => {
  let service: LinksService;
  let prisma: PrismaService;
  let originalDatabaseUrl: string | undefined;
  const ids: string[] = [];
  beforeAll(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const module = await Test.createTestingModule({
      providers: [
        LinksService,
        PrismaService,
        {
          provide: RedisService,
          useValue: { get: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();
    service = module.get(LinksService);
    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.link.deleteMany({ where: { id: { in: ids.splice(0) } } });
  });
  afterAll(async () => {
    await prisma?.onModuleDestroy();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  async function seed(maxVisits: number | null, oneTime = false) {
    const link = await prisma.link.create({
      data: {
        id: crypto.randomUUID(),
        code: crypto.randomUUID().slice(0, 8),
        message: 'secret',
        expiresAt: new Date(Date.now() + 3600000),
        maxVisits,
        oneTime,
        updatedAt: new Date(),
      },
    });
    ids.push(link.id);
    return link;
  }
  // All reads finish before any claim. Only the read is wrapped: real Prisma
  // UPDATEs still execute concurrently against PostgreSQL, not a mock.
  function synchronizeReads(count: number) {
    const original = prisma.link.findUnique.bind(prisma.link);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    jest.spyOn(prisma.link, 'findUnique').mockImplementation((async (
      args: any,
    ) => {
      const link = await original(args);
      if (++arrivals === count) release();
      await barrier;
      return link;
    }) as any);
  }
  it('allows exactly one of 10 simultaneous final-visit claims', async () => {
    const link = await seed(1);
    synchronizeReads(10);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.accessLink(link.code)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      results.filter(
        (r) => r.status === 'rejected' && r.reason instanceof GoneException,
      ),
    ).toHaveLength(9);
    expect(
      (await prisma.link.findUnique({ where: { id: link.id } }))?.visitCount,
    ).toBe(1);
  });
  it('preserves one-time burn-on-read under concurrent requests', async () => {
    const link = await seed(null, true);
    synchronizeReads(10);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.accessLink(link.code)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      results.filter(
        (r) => r.status === 'rejected' && r.reason instanceof GoneException,
      ),
    ).toHaveLength(9);
    const after = await prisma.link.findUnique({ where: { id: link.id } });
    expect(after?.used).toBe(true);
    expect(after?.visitCount).toBe(1);
  });
  it('does not cap unlimited links', async () => {
    const link = await seed(null);
    synchronizeReads(10);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.accessLink(link.code)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    expect(
      (await prisma.link.findUnique({ where: { id: link.id } }))?.visitCount,
    ).toBe(10);
  });
  it('serves all sequential visits up to the cap', async () => {
    const link = await seed(2);
    await expect(service.accessLink(link.code)).resolves.toEqual({
      message: 'secret',
    });
    await expect(service.accessLink(link.code)).resolves.toEqual({
      message: 'secret',
    });
    await expect(service.accessLink(link.code)).rejects.toThrow(GoneException);
  });
});
