import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { FailSafeService } from '../services/fail-safe.service';
import { ProductMarketplaceMapping } from '../database/entities/product-marketplace-mapping.entity';
import { CanonicalProduct } from '../database/entities/canonical-product.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ProductMarketplaceMapping, CanonicalProduct]),
  ],
  providers: [CircuitBreakerService, FailSafeService],
  exports: [CircuitBreakerService, FailSafeService],
})
export class FailSafeModule {}
