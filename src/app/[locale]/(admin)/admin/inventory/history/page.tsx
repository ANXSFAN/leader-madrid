import { redirect } from "next/navigation";

/**
 * Redirects to the main inventory page which now includes
 * search, filter, pagination and expandable detail rows.
 */
export default async function InventoryHistoryPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;

  // Preserve query params when redirecting
  const params = new URLSearchParams();
  if (typeof searchParams.q === "string") params.set("q", searchParams.q);
  if (typeof searchParams.type === "string") params.set("type", searchParams.type);
  if (typeof searchParams.page === "string") params.set("page", searchParams.page);

  const qs = params.toString();
  redirect(`/admin/inventory${qs ? `?${qs}` : ""}`);
}
