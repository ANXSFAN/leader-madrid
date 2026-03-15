import { getCustomsDeclaration } from "@/lib/actions/customs";
import { CustomsDeclarationDetails } from "@/components/admin/customs-declaration-details";
import { notFound } from "next/navigation";

export default async function CustomsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const declaration = await getCustomsDeclaration(id);
  if (!declaration) notFound();
  return <CustomsDeclarationDetails declaration={declaration} />;
}
