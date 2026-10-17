import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database.service';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [DatabaseService, AppService, { provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
