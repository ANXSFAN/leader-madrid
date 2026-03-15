import { SendcloudProvider } from '@/lib/logistics/providers/sendcloud';
import { LogisticsApiError } from '@/lib/logistics/errors';
import type { CreateParcelDto, ServicePoint, ShippingMethod, ParcelResponse } from '@/lib/logistics/types';

const mockServicePoint: ServicePoint = {
  id: 1001,
  name: 'Test Service Point',
  street: 'Calle Gran Vía',
  house_number: '1',
  city: 'Madrid',
  postal_code: '28013',
  country: 'ES',
  latitude: '40.4200',
  longitude: '-3.7050',
};

const mockShippingMethod: ShippingMethod = {
  id: 8,
  name: 'Correos Express 24h Península',
  carrier: 'correos-express',
  min_weight: '0.001',
  max_weight: '30.000',
  price: 4.95,
};

const mockParcelResponse: ParcelResponse = {
  id: 12345,
  tracking_number: 'SC-TEST-001',
  tracking_url: 'https://tracking.sendcloud.sc/forward?code=SC-TEST-001',
  status: { id: 1, message: 'Announced' },
};

const validDto: CreateParcelDto = {
  name: 'John Doe',
  address: 'Calle Mayor',
  house_number: '5',
  city: 'Madrid',
  postal_code: '28001',
  country: 'ES',
  telephone: '+34600000001',
  email: 'test@example.com',
  weight: '1.000',
  shipment: { id: 8 },
};

describe('SendcloudProvider', () => {
  let provider: SendcloudProvider;

  beforeEach(() => {
    provider = new SendcloudProvider('test-public-key', 'test-secret-key');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getServicePoints', () => {
    it('should return ServicePoint[] on success', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ service_points: [mockServicePoint] }),
          { status: 200 }
        )
      );

      const result = await provider.getServicePoints({ country: 'ES' });

      expect(result).toEqual([mockServicePoint]);
    });
  });

  describe('getShippingMethods', () => {
    it('should return ShippingMethod[] on success', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ shipping_methods: [mockShippingMethod] }),
          { status: 200 }
        )
      );

      const result = await provider.getShippingMethods({});

      expect(result).toEqual([mockShippingMethod]);
    });
  });

  describe('createParcel', () => {
    it('should return ParcelResponse on success', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ parcel: mockParcelResponse }),
          { status: 200 }
        )
      );

      const result = await provider.createParcel(validDto);

      expect(result).toEqual(mockParcelResponse);
    });

    it('should always set request_label to false regardless of dto input', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ parcel: mockParcelResponse }),
          { status: 200 }
        )
      );

      // Simulate a caller attempting to pass request_label: true at runtime
      // (the DTO type does not allow it, but we verify the runtime safety guarantee)
      await provider.createParcel({ ...validDto, request_label: true } as any);

      const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);

      expect(calledBody.parcel.request_label).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw LogisticsApiError with statusCode 401 and original message on auth failure', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 401, message: 'Invalid credentials' } }),
          { status: 401 }
        )
      );

      await expect(provider.getServicePoints({ country: 'ES' })).rejects.toMatchObject({
        name: 'LogisticsApiError',
        statusCode: 401,
        message: 'Invalid credentials',
      });
    });

    it('should wrap AbortError as LogisticsApiError with statusCode 408', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      jest.spyOn(global, 'fetch').mockRejectedValue(abortError);

      await expect(provider.getServicePoints({ country: 'ES' })).rejects.toMatchObject({
        name: 'LogisticsApiError',
        statusCode: 408,
      });
    });
  });
});
