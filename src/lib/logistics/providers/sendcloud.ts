import type { LogisticsProvider } from './base';
import type {
  ServicePointQuery,
  ServicePoint,
  CreateParcelDto,
  ParcelResponse,
  ShippingMethodQuery,
  ShippingMethod,
} from '../types';
import { LogisticsApiError } from '../errors';

export class SendcloudProvider implements LogisticsProvider {
  private readonly baseUrl = 'https://panel.sendcloud.sc';
  private readonly authHeader: string;

  constructor(publicKey: string, secretKey: string) {
    const credentials = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  private get defaultHeaders(): Record<string, string> {
    return {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
    };
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as { error?: { message?: string } };
      return data.error?.message ?? `HTTP ${response.status}`;
    } catch (parseErr) {
      return `HTTP ${response.status}`;
    }
  }

  private throwHttpError(status: number, message: string): never {
    if (status === 401) throw new LogisticsApiError(message, 401);
    if (status === 403) throw new LogisticsApiError(message, 403);
    if (status === 422) throw new LogisticsApiError(message, 422);
    if (status === 429) throw new LogisticsApiError(message, 429);
    if (status >= 500) throw new LogisticsApiError(message, 502);
    throw new LogisticsApiError(message, status);
  }

  async getServicePoints(query: ServicePointQuery): Promise<ServicePoint[]> {
    const params = new URLSearchParams({ country: query.country });
    if (query.postal_code !== undefined) {
      params.append('postal_code', query.postal_code);
    }
    const url = `${this.baseUrl}/api/v2/service-points?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: this.defaultHeaders,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const message = await this.extractErrorMessage(response);
        console.error(`[Sendcloud] getServicePoints ${response.status}: ${message}`, { url });
        this.throwHttpError(response.status, message);
      }

      const data = (await response.json()) as { service_points: ServicePoint[] };
      return data.service_points;
    } catch (err) {
      if (err instanceof LogisticsApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[Sendcloud] getServicePoints timeout`, { url });
        throw new LogisticsApiError('Request timeout', 408, err);
      }
      console.error(`[Sendcloud] getServicePoints network error`, { url, err });
      throw new LogisticsApiError('Connection failed', 503, err);
    }
  }

  async createParcel(data: CreateParcelDto): Promise<ParcelResponse> {
    const url = `${this.baseUrl}/api/v2/parcels`;

    // Security: request_label is hardcoded to false to prevent label generation
    // and any billing charges during the test phase.
    // Placing it after the spread ensures it overrides any same-named field
    // even if a caller somehow passes request_label via the dto at runtime.
    const body = {
      parcel: {
        ...data,
        request_label: false,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const message = await this.extractErrorMessage(response);
        console.error(`[Sendcloud] createParcel ${response.status}: ${message}`, { url });
        this.throwHttpError(response.status, message);
      }

      const responseData = (await response.json()) as { parcel: ParcelResponse };
      return responseData.parcel;
    } catch (err) {
      if (err instanceof LogisticsApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[Sendcloud] createParcel timeout`, { url });
        throw new LogisticsApiError('Request timeout', 408, err);
      }
      console.error(`[Sendcloud] createParcel network error`, { url, err });
      throw new LogisticsApiError('Connection failed', 503, err);
    }
  }

  async getShippingMethods(query: ShippingMethodQuery): Promise<ShippingMethod[]> {
    const params = new URLSearchParams();
    if (query.sender_address !== undefined) {
      params.append('sender_address', String(query.sender_address));
    }
    if (query.service_point_id !== undefined) {
      params.append('service_point_id', String(query.service_point_id));
    }

    // NOTE: this endpoint uses an underscore (shipping_methods), NOT a hyphen.
    // Do not change this URL pattern — it will return 404 otherwise.
    const url = `${this.baseUrl}/api/v2/shipping_methods?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: this.defaultHeaders,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const message = await this.extractErrorMessage(response);
        console.error(`[Sendcloud] getShippingMethods ${response.status}: ${message}`, { url });
        this.throwHttpError(response.status, message);
      }

      const data = (await response.json()) as { shipping_methods: ShippingMethod[] };
      return data.shipping_methods;
    } catch (err) {
      if (err instanceof LogisticsApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[Sendcloud] getShippingMethods timeout`, { url });
        throw new LogisticsApiError('Request timeout', 408, err);
      }
      console.error(`[Sendcloud] getShippingMethods network error`, { url, err });
      throw new LogisticsApiError('Connection failed', 503, err);
    }
  }
}
