import { Product, ProductVariant, Category } from "@prisma/client";

export type SerializedProductVariant = Omit<
  ProductVariant,
  "price" | "b2bPrice" | "compareAtPrice" | "costPrice"
> & {
  price: number;
  b2bPrice: number | null;
  compareAtPrice: number | null;
  costPrice: number | null;
};

export type SerializedProduct = Product & {
  variants: SerializedProductVariant[];
  category: Category | null;
  minPrice: number;
  maxPrice: number;
};
