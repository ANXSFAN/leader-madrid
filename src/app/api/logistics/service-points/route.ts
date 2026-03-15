import { getLogisticsProvider } from "@/lib/logistics";
import { LogisticsApiError } from "@/lib/logistics/errors";
import type { ServicePointQuery } from "@/lib/logistics/types";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: Request): Promise<Response> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) {
    return Response.json({ error: { message: "Unauthorized", statusCode: 401 } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country");
  const postal_code = searchParams.get("postal_code") ?? undefined;

  if (!country) {
    return Response.json(
      { error: { message: "country is required", statusCode: 400 } },
      { status: 400 }
    );
  }

  const query: ServicePointQuery = { country, postal_code };

  try {
    const provider = getLogisticsProvider();
    const servicePoints = await provider.getServicePoints(query);
    return Response.json({ data: servicePoints });
  } catch (err) {
    if (err instanceof LogisticsApiError) {
      return Response.json(
        { error: { message: err.message, statusCode: err.statusCode } },
        { status: err.statusCode }
      );
    }
    return Response.json(
      { error: { message: "Internal Server Error", statusCode: 500 } },
      { status: 500 }
    );
  }
}
