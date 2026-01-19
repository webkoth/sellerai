import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkersModule } from './workers.module';

async function bootstrap() {
  const logger = new Logger('WorkersBootstrap');

  const app = await NestFactory.createApplicationContext(WorkersModule);

  logger.log('Marketplace Sync Workers started');
  logger.log('Listening for jobs on queues:');
  logger.log('  - sync:inbound:products');
  logger.log('  - sync:inbound:prices');
  logger.log('  - sync:outbound:products');
  logger.log('  - sync:outbound:prices');
  logger.log('  - orders:stock-update');
  logger.log('  - orders:poll');
  logger.log('  - mp:wb:content, mp:ozon, mp:yandex');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('Received SIGINT, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
