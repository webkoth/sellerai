import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService, HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Full health check with all components
   * GET /health
   */
  @Get()
  async check() {
    const health = await this.healthService.getHealth();

    if (health.status === HealthStatus.UNHEALTHY) {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }

  /**
   * Liveness probe (for Kubernetes)
   * GET /health/live
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  async live() {
    return this.healthService.getLiveness();
  }

  /**
   * Readiness probe (for Kubernetes)
   * GET /health/ready
   */
  @Get('ready')
  async ready() {
    const readiness = await this.healthService.getReadiness();

    if (!readiness.ready) {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }

  /**
   * Detailed component status
   * GET /health/components
   */
  @Get('components')
  async components() {
    const health = await this.healthService.getHealth();
    return {
      components: health.components,
      timestamp: health.timestamp,
    };
  }
}
