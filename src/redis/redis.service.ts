import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.client = createClient({ url: redisUrl });
        this.client.on('error', (error: Error) => {
          this.logger.warn(`Redis Client Error: ${error.message}`);
          this.isConnected = false;
        });
      } catch (error) {
        this.logger.warn(`Failed to initialize Redis client: ${(error as Error).message}`);
      }
    } else {
      this.logger.log('REDIS_URL not configured. Running in PostgreSQL-only mode.');
    }
  }

  async onModuleInit() {
    if (this.client) {
      try {
        await this.client.connect();
        this.isConnected = true;
        this.logger.log('Connected to Redis');
      } catch (error) {
        this.logger.warn(
          `Could not connect to Redis: ${(error as Error).message}. Falling back to PostgreSQL-only mode.`,
        );
        this.isConnected = false;
      }
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
      } catch (error) {
        this.logger.warn(`Error disconnecting Redis: ${(error as Error).message}`);
      }
    }
  }

  async set(key: string, value: string) {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.set(key, value);
    } catch {
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setWithExpiry(key: string, value: string, seconds: number) {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.set(key, value, {
        EX: seconds,
      });
    } catch {
      return null;
    }
  }

  async increment(key: string) {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.incr(key);
    } catch {
      return null;
    }
  }
}
