import { getLogisticsProvider } from '@/lib/logistics';
import { LogisticsApiError } from '@/lib/logistics/errors';
import type { ShippingMethodQuery } from '@/lib/logistics/types';
import { requireRole } from '@/lib/auth-guard';

export async function GET(request: Request): Promise<Response> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) {
    return Response.json({ error: { message: "Unauthorized", statusCode: 401 } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const senderAddressParam = searchParams.get('sender_address');
  const servicePointIdParam = searchParams.get('service_point_id');

  const query: ShippingMethodQuery = {
    sender_address: senderAddressParam !== null ? Number(senderAddressParam) : undefined,
    service_point_id: servicePointIdParam !== null ? Number(servicePointIdParam) : undefined,
  };

  try {
    const provider = getLogisticsProvider();
    const shippingMethods = await provider.getShippingMethods(query);
    return Response.json({ data: shippingMethods });
  } catch (err) {
    if (err instanceof LogisticsApiError) {
      return Response.json(
        { error: { message: err.message, statusCode: err.statusCode } },
        { status: err.statusCode }
      );
    }
    return Response.json(
      { error: { message: 'Internal Server Error', statusCode: 500 } },
      { status: 500 }
    );
  }
}
