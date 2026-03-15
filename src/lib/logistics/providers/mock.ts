import type { LogisticsProvider } from './base';
import type {
  ServicePointQuery,
  ServicePoint,
  CreateParcelDto,
  ParcelResponse,
  ShippingMethodQuery,
  ShippingMethod,
} from '../types';

export class MockLogisticsProvider implements LogisticsProvider {
  async getServicePoints(_query: ServicePointQuery): Promise<ServicePoint[]> {
    return [
      {
        id: 1001,
        name: 'Correos Express Valencia Centro',
        street: 'Calle Colón',
        house_number: '12',
        city: 'Valencia',
        postal_code: '46004',
        country: 'ES',
        latitude: '39.469907',
        longitude: '-0.376288',
      },
    ];
  }

  async createParcel(_data: CreateParcelDto): Promise<ParcelResponse> {
    return {
      id: 99999,
      tracking_number: 'MOCK-TRACK-001',
      tracking_url: 'https://tracking.sendcloud.sc/forward?carrier=mock&code=MOCK-TRACK-001',
      status: {
        id: 1,
        message: 'Announced',
      },
    };
  }

  // NOTE: Sendcloud free plan may return empty or restricted shipping method data.
  // The sender_address filter is not supported on the free plan.
  // Real shipping method IDs should be retrieved from the Sendcloud dashboard
  // and hardcoded in the business layer when creating parcels.
  async getShippingMethods(_query: ShippingMethodQuery): Promise<ShippingMethod[]> {
    return [
      {
        id: 8,
        name: 'Correos Express 24h Península',
        carrier: 'correos-express',
        min_weight: '0.001',
        max_weight: '30.000',
        price: 4.95,
      },
    ];
  }
}
