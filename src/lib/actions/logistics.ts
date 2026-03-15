'use server';

import { getLogisticsProvider } from '@/lib/logistics';
import { LogisticsApiError } from '@/lib/logistics/errors';
import type { CreateParcelDto, ParcelResponse } from '@/lib/logistics/types';
import { requireRole } from '@/lib/auth-guard';

type CreateShipmentResult =
  | { success: true; parcel: ParcelResponse }
  | { success: false; error: string; statusCode?: number };

export async function createShipmentAction(
  dto: CreateParcelDto
): Promise<CreateShipmentResult> {
  const session = await requireRole(['ADMIN', 'WAREHOUSE_MANAGER']);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const provider = getLogisticsProvider();
    const parcel = await provider.createParcel(dto);
    return { success: true, parcel };
  } catch (err) {
    if (err instanceof LogisticsApiError) {
      return { success: false, error: err.message, statusCode: err.statusCode };
    }
    console.error('[createShipmentAction] Unexpected error', err);
    return { success: false, error: 'Failed to create shipment' };
  }
}
