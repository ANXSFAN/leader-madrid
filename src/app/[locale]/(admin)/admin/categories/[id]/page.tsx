import { getCategory, getCategories } from "@/lib/actions/category";
import { CategoryForm } from "@/components/admin/category-form";

export default async function CategoryPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const isNew = params.id === "new";
  const category = isNew ? null : await getCategory(params.id);
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <CategoryForm initialData={category} categories={categories} />
    </div>
  );
}
