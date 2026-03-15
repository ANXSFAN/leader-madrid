# LED ERP Project Memory

## Common TypeScript Patterns & Fixes

### Zod locale schema reduce pattern
When extending `localizedSchema` inside `SUPPORTED_LOCALES.reduce()`, the `.extend()` return type doesn't match `typeof localizedSchema`. Fix: cast with `as unknown as typeof localizedSchema`. See `product-form-schema.ts` line 52 for canonical example. Also used in `attribute-form.tsx` and `category-form.tsx`.

### Recharts formatter typing
Recharts `<Tooltip formatter={...}>` has strict typing that doesn't match simple `(value: number) => string` callbacks. Fix: cast the formatter function `as any`.

### JSON field type interfaces (replacing `as any`)
For Prisma `Json` fields, define local interfaces and cast instead of `as any`:
- `ProductContentJson`: `{ images?: string[]; specs?: Record<string, string>; [locale]: { name?, description?, seoTitle?, seoDescription? } }`
- `CategoryContentJson`: `{ imageUrl?: string; icon?: string; [locale]: { name? } }`
- `SupplierContactJson`: `{ contactName?, email?, phone?, website? }`
- `AttrNameJson`: `Record<string, string>` (for `AttributeDefinition.name`)
- `VariantSpecsJson`: `Record<string, string>` (for `ProductVariant.specs`)
Cast: `(product.content as ProductContentJson)` instead of `(product.content as any)`.

### Supplier model shape
`Supplier` has: `name`, `code` (unique, required), `contact` (Json?), `address` (Json?). NO `email`, `phone`, `contactPerson`, or `website` columns. Contact info goes in `contact` JSON: `{ email, phone, contactName, website }`.

### Dynamic form paths (React Hook Form)
For `form.getValues`/`setValue` with dynamic locale paths like `` `locales.${lang}.name` ``, use `` as `locales.${string}.name` `` instead of `as any`. Same for `.description`, `.seoTitle`, `.seoDescription`.

### Locales reduce pattern (replacing `as any`)
For `SUPPORTED_LOCALES.reduce(...)` building default values, use explicit record type:
`{} as Record<string, { name: string }>` instead of `{} as any`.

### Order model field names
`Order` has `tax` (not `taxTotal`), `shipping` (not `shippingTotal`). Address is via relation IDs (`shippingAddressId`, `billingAddressId`), NOT inline JSON objects.

### OrderItem model shape
`OrderItem` has: `orderId`, `variantId`, `quantity`, `price`, `costPrice?`, `total`, `name`, `sku`. NO `productId` or `subtotal` fields.

### RFQStatus enum values
Valid: PENDING, REVIEWING, QUOTED, ACCEPTED, REJECTED, EXPIRED. NO "CONVERTED" value.

### ExcelJS Buffer compatibility (Node 22+)
`Buffer.from(arrayBuffer)` returns `Buffer<ArrayBufferLike>` which is not assignable to ExcelJS's `Buffer` param. Fix: cast `buffer as any` when passing to `workbook.xlsx.load()`.

### LocalizedString type in CMS
`BannerContent` fields (badge, heading, description) use `LocalizedString = string | Record<string, string>`. When assigning to `string` state, cast: `((content.field as any)?.es || (content.field as string)) || ""`.

### SerializedProduct vs Prisma Product
`ProductCard` expects `SerializedProduct` (from `lib/types/search.ts`) which extends `Product` with `minPrice`, `maxPrice`, and `SerializedProductVariant[]` (Decimal fields converted to number). When passing raw Prisma `Product & { variants: ProductVariant[] }`, cast `as any`.

### SiteSettingsData requires `currency`
The `SiteSettingsData` interface requires a `currency: string` field. When constructing from form values, include `currency: initialData?.currency || "EUR"`.

### Session callback null return
NextAuth session callback typing doesn't allow `null` return. Cast `return null as any` for disabled user case.

## B2B Flow (Phase 1 - 2026-02-28)
- User model: 12 new B2B fields (registrationCountry, companyStreet/City/Zip, phoneCountryCode, vatVerified/At/Name/Address, b2bAppliedAt, b2bReviewedAt, b2bRejectionReason)
- B2B actions: `src/lib/actions/b2b.ts` (verifyB2BVAT, approveB2BUser, rejectB2BUser)
- VAT verification: Spanish NIF/CIF/DNI/NIE local validation, EU VIES API for other countries
- `applyForB2B` in `src/actions/auth-actions.ts` updated to collect new fields
- `getUser` in `src/lib/actions/user.ts` uses `include` (not `select`), so all new fields auto-return

## B2B Flow (Phase 2 - 2026-02-28)
- Admin panel: `src/components/admin/b2b-application-panel.tsx` — VAT verify/approve/reject UI
- Integrated in customer detail page: shows above UserForm when b2bStatus !== NOT_APPLIED
- Storefront apply-b2b page rewritten: 3-section Card layout (Company/Address/Contact)
- COUNTRY_LIST imported from `src/lib/vat.ts` (has code, name, isEU fields)
- PHONE_CODES array defined inline in apply-b2b page (30 common country codes)
- 14 new i18n keys in apply_b2b namespace across all 9 locales
- 2 new industry options: hospitality, real_estate

## Key File Locations
- Prisma schema: `prisma/schema.prisma` (36 tables including ContactSubmission, CmsPage)
- Cart store: `src/lib/store/cart.ts` (CartItem interface)
- Search types: `src/lib/types/search.ts` (SerializedProduct)
- Mega menu types: `src/lib/types/mega-menu.ts` (MegaMenuData, MegaMenuColumn, etc.)
- CMS actions: `src/lib/actions/cms.ts` (BannerContent, LocalizedString)
- CMS pages actions: `src/lib/actions/cms-pages.ts` (CRUD for CmsPage model)
- Contact actions: `src/lib/actions/contact.ts` (submitContactForm, getContactSubmissions)
- Supabase client: `src/lib/supabase.ts` (client + service role)
- Upload API: `src/app/api/upload/route.ts` (Supabase Storage, ADMIN only)
- Site config: `src/lib/actions/config.ts` (SiteSettingsData)
- Auth: `src/lib/auth.ts`
- Product form schema: `src/components/admin/product-form-schema.ts`
- Email types: `src/lib/email.ts` (OrderEmailData interface)
- Wishlist actions: `src/lib/actions/wishlist.ts`
- Wishlist page: `src/app/[locale]/(storefront)/profile/wishlist/page.tsx`
- Wishlist button: `src/components/storefront/wishlist-button.tsx`
- User dropdown nav: `src/components/storefront/user-nav.tsx`
- B2B admin panel: `src/components/admin/b2b-application-panel.tsx`
- B2B server actions: `src/lib/actions/b2b.ts` (verifyB2BVAT, approveB2BUser, rejectB2BUser)
- VAT utilities + COUNTRY_LIST: `src/lib/vat.ts`

## Translation Key Locations
- `account` namespace: user dropdown items (admin_panel, profile, wishlist, logout)
- `product` namespace: product view labels (add_to_cart, add_to_favorites, added_to_wishlist, etc.)
- `profile` namespace: profile page tabs and subsections (orders, invoices, returns, wishlist)
- Some locales (fr, de) do NOT have `profile` section; they fallback to en.json
- Other locales (it, nl, pl, pt) have compact single-line profile subsections

## Prisma Generate DLL Lock Issue (Windows)
When dev server is running, `npx prisma generate` fails with EPERM on query_engine-windows.dll.node.
Workaround: stop dev server first, or restart it after schema changes (it auto-generates).
