import type {
  ServicePointQuery,
  ServicePoint,
  CreateParcelDto,
  ParcelResponse,
  ShippingMethodQuery,
  ShippingMethod,
} from '../types';

export interface LogisticsProvider {
  getServicePoints(query: ServicePointQuery): Promise<ServicePoint[]>;
  createParcel(data: CreateParcelDto): Promise<ParcelResponse>;
  getShippingMethods(query: ShippingMethodQuery): Promise<ShippingMethod[]>;
}
