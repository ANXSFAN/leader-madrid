export interface ServicePointQuery {
  country: string;
  postal_code?: string;
}

export interface ServicePoint {
  id: number;
  name: string;
  street: string;
  house_number: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
}

// request_label is intentionally excluded from this DTO.
// It is hardcoded to false inside SendcloudProvider to prevent
// label generation and billing during the test phase.
export interface CreateParcelDto {
  name: string;
  address: string;
  house_number?: string;
  city: string;
  postal_code: string;
  country: string;
  telephone: string;
  email: string;
  weight: string;
  shipment: { id: number };
  order_number?: string;
  to_service_point?: number;
  to_post_number?: string;
}

export interface ParcelResponse {
  id: number;
  tracking_number: string;
  tracking_url: string;
  status: {
    id: number;
    message: string;
  };
}

export interface ShippingMethodQuery {
  sender_address?: number;
  service_point_id?: number;
}

export interface ShippingMethod {
  id: number;
  name: string;
  carrier: string;
  min_weight: string;
  max_weight: string;
  price: number;
}
