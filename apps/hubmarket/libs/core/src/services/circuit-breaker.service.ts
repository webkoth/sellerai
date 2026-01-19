import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, reject all requests
  HALF_OPEN = 'half_open', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Successes needed to close from half-open
  timeout: number;               // Time in ms before trying half-open
  resetTimeout?: number;         // Time to reset failure count in closed state
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
  state: CircuitState;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  resetTimeout: 60000, // 1 minute
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits: Map<string, CircuitStats> = new Map();
  private readonly configs: Map<string, CircuitBreakerConfig> = new Map();

  /**
   * Configure circuit breaker for a specific service
   */
  configure(serviceId: string, config: Partial<CircuitBreakerConfig>): void {
    this.configs.set(serviceId, { ...DEFAULT_CONFIG, ...config });
    this.logger.log(`Circuit breaker configured for ${serviceId}`);
  }

  /**
   * Check if circuit allows request
   */
  canExecute(serviceId: string): boolean {
    const stats = this.getOrCreateStats(serviceId);
    const config = this.getConfig(serviceId);

    switch (stats.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has passed to try half-open
        if (Date.now() - stats.lastStateChange >= config.timeout) {
          this.transitionTo(serviceId, CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;

      default:
        return true;
    }
  }

  /**
   * Record successful execution
   */
  recordSuccess(serviceId: string): void {
    const stats = this.getOrCreateStats(serviceId);
    const config = this.getConfig(serviceId);

    stats.successes++;

    if (stats.state === CircuitState.HALF_OPEN) {
      if (stats.successes >= config.successThreshold) {
        this.transitionTo(serviceId, CircuitState.CLOSED);
        stats.failures = 0;
        stats.successes = 0;
      }
    } else if (stats.state === CircuitState.CLOSED) {
      // Reset failure count after successful period
      if (config.resetTimeout && Date.now() - stats.lastFailureTime >= config.resetTimeout) {
        stats.failures = 0;
      }
    }
  }

  /**
   * Record failed execution
   */
  recordFailure(serviceId: string, error?: Error): void {
    const stats = this.getOrCreateStats(serviceId);
    const config = this.getConfig(serviceId);

    stats.failures++;
    stats.lastFailureTime = Date.now();

    this.logger.warn(
      `Circuit ${serviceId}: failure #${stats.failures}${error ? `: ${error.message}` : ''}`,
    );

    if (stats.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately opens circuit
      this.transitionTo(serviceId, CircuitState.OPEN);
      stats.successes = 0;
    } else if (stats.state === CircuitState.CLOSED) {
      if (stats.failures >= config.failureThreshold) {
        this.transitionTo(serviceId, CircuitState.OPEN);
      }
    }
  }

  /**
   * Get current state of circuit
   */
  getState(serviceId: string): CircuitState {
    return this.getOrCreateStats(serviceId).state;
  }

  /**
   * Get circuit statistics
   */
  getStats(serviceId: string): CircuitStats {
    return { ...this.getOrCreateStats(serviceId) };
  }

  /**
   * Get all circuits status
   */
  getAllStats(): Record<string, CircuitStats> {
    const result: Record<string, CircuitStats> = {};
    for (const [id, stats] of this.circuits) {
      result[id] = { ...stats };
    }
    return result;
  }

  /**
   * Force circuit to specific state (for admin/testing)
   */
  forceState(serviceId: string, state: CircuitState): void {
    const stats = this.getOrCreateStats(serviceId);
    this.transitionTo(serviceId, state);
    if (state === CircuitState.CLOSED) {
      stats.failures = 0;
      stats.successes = 0;
    }
    this.logger.warn(`Circuit ${serviceId} forced to ${state}`);
  }

  /**
   * Reset circuit to initial state
   */
  reset(serviceId: string): void {
    this.circuits.delete(serviceId);
    this.logger.log(`Circuit ${serviceId} reset`);
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    serviceId: string,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>,
  ): Promise<T> {
    if (!this.canExecute(serviceId)) {
      this.logger.warn(`Circuit ${serviceId} is OPEN, rejecting request`);
      if (fallback) {
        return fallback();
      }
      throw new CircuitOpenError(serviceId);
    }

    try {
      const result = await fn();
      this.recordSuccess(serviceId);
      return result;
    } catch (error) {
      this.recordFailure(serviceId, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  private getOrCreateStats(serviceId: string): CircuitStats {
    if (!this.circuits.has(serviceId)) {
      this.circuits.set(serviceId, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        lastStateChange: Date.now(),
        state: CircuitState.CLOSED,
      });
    }
    return this.circuits.get(serviceId)!;
  }

  private getConfig(serviceId: string): CircuitBreakerConfig {
    return this.configs.get(serviceId) || DEFAULT_CONFIG;
  }

  private transitionTo(serviceId: string, newState: CircuitState): void {
    const stats = this.getOrCreateStats(serviceId);
    const oldState = stats.state;

    if (oldState !== newState) {
      stats.state = newState;
      stats.lastStateChange = Date.now();
      this.logger.warn(`Circuit ${serviceId}: ${oldState} -> ${newState}`);
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly serviceId: string) {
    super(`Circuit breaker is open for service: ${serviceId}`);
    this.name = 'CircuitOpenError';
  }
}
