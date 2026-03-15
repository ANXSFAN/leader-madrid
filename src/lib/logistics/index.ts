import type { LogisticsProvider } from './providers/base';
import { SendcloudProvider } from './providers/sendcloud';
import { MockLogisticsProvider } from './providers/mock';

// Validation runs on first factory call, not at module load time.
// This prevents CI/CD build failures when business env vars are absent.
function validateEnv(): void {
  if (process.env.LOGISTICS_ADAPTER === 'sendcloud') {
    if (!process.env.SENDCLOUD_PUBLIC_KEY) {
      throw new Error('Missing required environment variable: SENDCLOUD_PUBLIC_KEY');
    }
    if (!process.env.SENDCLOUD_SECRET_KEY) {
      throw new Error('Missing required environment variable: SENDCLOUD_SECRET_KEY');
    }
  }
}

// Returns the logistics provider configured via LOGISTICS_ADAPTER env var.
// Default: 'mock' (safe for local dev and CI).
// Only call this from server-side code (Server Actions / Route Handlers).
export function getLogisticsProvider(): LogisticsProvider {
  validateEnv();
  const adapter = process.env.LOGISTICS_ADAPTER ?? 'mock';
  switch (adapter) {
    case 'sendcloud':
      return new SendcloudProvider(
        process.env.SENDCLOUD_PUBLIC_KEY!,
        process.env.SENDCLOUD_SECRET_KEY!
      );
    case 'mock':
    default:
      return new MockLogisticsProvider();
  }
}

export type { LogisticsProvider } from './providers/base';
export type {
  ServicePointQuery,
  ServicePoint,
  CreateParcelDto,
  ParcelResponse,
  ShippingMethodQuery,
  ShippingMethod,
} from './types';
export { LogisticsApiError } from './errors';
