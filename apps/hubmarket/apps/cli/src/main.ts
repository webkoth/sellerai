import 'reflect-metadata';
import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module';
import { CategoriesCommand } from './commands/categories.command';
import { SyncCommand } from './commands/sync.command';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn'],
  });

  const program = new Command();
  program
    .name('hubmarket-cli')
    .description('HubMarket CLI for managing marketplace sync')
    .version('1.0.0');

  // Register commands
  const categoriesCommand = app.get(CategoriesCommand);
  const syncCommand = app.get(SyncCommand);

  categoriesCommand.register(program);
  syncCommand.register(program);

  await program.parseAsync(process.argv);

  await app.close();
}

bootstrap().catch((error) => {
  console.error('CLI error:', error);
  process.exit(1);
});
