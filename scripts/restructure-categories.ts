/**
 * Category Restructuring Script
 *
 * Reorganizes 29 flat categories into a 3-level hierarchy:
 *   L1 (4 top-level) → L2 (intermediate groups) → L3 (existing leaf categories)
 *
 * - Products stay linked to their current (L3) category
 * - Special categories (NOVEDADES, SALES, MÁS PRODUCTOS, PANTALLAS - TOTEM) are handled
 * - Idempotent: checks for existing categories before creating
 *
 * Usage:  npx tsx scripts/restructure-categories.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ─── Helper: slugify ────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Helper: find or create category ────────────────────────────

async function findOrCreate(
  slug: string,
  content: Record<string, any>,
  parentId: string | null
): Promise<string> {
  const existing = await db.category.findUnique({ where: { slug } });
  if (existing) {
    console.log(`  [EXISTS] "${slug}" (id: ${existing.id})`);
    // Update parentId if needed
    if (existing.parentId !== parentId) {
      await db.category.update({
        where: { id: existing.id },
        data: { parentId },
      });
      console.log(`    → updated parentId to ${parentId}`);
    }
    return existing.id;
  }

  const created = await db.category.create({
    data: { slug, content, parentId },
  });
  console.log(`  [CREATED] "${slug}" (id: ${created.id})`);
  return created.id;
}

// ─── Helper: find existing category by slug pattern ─────────────

async function findBySlug(slug: string): Promise<{ id: string; slug: string; content: any } | null> {
  return db.category.findUnique({
    where: { slug },
    select: { id: true, slug: true, content: true },
  });
}

// ─── Helper: rename category content ────────────────────────────

async function renameCategory(
  id: string,
  esName: string,
  enName: string
): Promise<void> {
  const cat = await db.category.findUnique({ where: { id } });
  if (!cat) return;

  const content = (cat.content as Record<string, any>) || {};
  // Update es and en names, keep other locales/fields
  if (!content.es) content.es = {};
  if (!content.en) content.en = {};
  content.es.name = esName;
  content.en.name = enName;

  await db.category.update({
    where: { id },
    data: { content },
  });
  console.log(`  [RENAMED] → es: "${esName}", en: "${enName}"`);
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("=== Category Restructuring Script ===\n");

  // ── 0. Survey current state ────────────────────────────────

  const allCats = await db.category.findMany({
    include: { _count: { select: { products: true } } },
  });
  console.log(`Found ${allCats.length} categories total.\n`);

  const bySlug = new Map(allCats.map((c) => [c.slug, c]));

  // Helper to get category id by slug (tries common slug patterns)
  function getCatId(slug: string): string | null {
    const cat = bySlug.get(slug);
    return cat ? cat.id : null;
  }

  // Print current state
  console.log("Current categories:");
  for (const c of allCats) {
    const name = (c.content as any)?.es?.name || (c.content as any)?.name || c.slug;
    console.log(`  ${c.slug} → "${name}" (${c._count.products} products, parent: ${c.parentId || "none"})`);
  }
  console.log();

  // ── 1. Create L1 parent categories ─────────────────────────

  console.log("── Step 1: Creating L1 (top-level) categories ──\n");

  const l1Iluminacion = await findOrCreate("iluminacion-decorativa", {
    es: { name: "Iluminación Decorativa", description: "Lámparas decorativas para interior: techo, pared, mesa y suelo" },
    en: { name: "Decorative Lighting", description: "Decorative indoor lamps: ceiling, wall, table and floor" },
  }, null);

  const l1Tecnica = await findOrCreate("iluminacion-tecnica", {
    es: { name: "Iluminación Técnica", description: "Soluciones de iluminación técnica LED: downlights, paneles, focos de carril y lineales" },
    en: { name: "Technical Lighting", description: "Technical LED lighting solutions: downlights, panels, track lights and linear" },
  }, null);

  const l1Exterior = await findOrCreate("iluminacion-exterior-industrial", {
    es: { name: "Iluminación Exterior e Industrial", description: "Iluminación LED para exterior, industrial y de seguridad" },
    en: { name: "Outdoor & Industrial Lighting", description: "LED lighting for outdoor, industrial and security applications" },
  }, null);

  const l1Componentes = await findOrCreate("componentes-accesorios", {
    es: { name: "Componentes y Accesorios", description: "Bombillas, tiras LED, transformadores y accesorios de iluminación" },
    en: { name: "Components & Accessories", description: "Bulbs, LED strips, transformers and lighting accessories" },
  }, null);

  console.log();

  // ── 2. Create L2 intermediate categories ───────────────────

  console.log("── Step 2: Creating L2 (intermediate) categories ──\n");

  // Under Iluminación Decorativa
  const l2Techo = await findOrCreate("lamparas-de-techo", {
    es: { name: "Lámparas de Techo", description: "Plafones, colgantes y ventiladores de techo LED" },
    en: { name: "Ceiling Lamps", description: "LED ceiling fixtures, pendants and ceiling fans" },
  }, l1Iluminacion);

  const l2ParedMesa = await findOrCreate("lamparas-pared-mesa", {
    es: { name: "Lámparas de Pared y Mesa", description: "Apliques de pared, lámparas de mesa y de suelo" },
    en: { name: "Wall & Table Lamps", description: "Wall sconces, table lamps and floor lamps" },
  }, l1Iluminacion);

  // Under Iluminación Técnica
  const l2Downlight = await findOrCreate("downlight-paneles", {
    es: { name: "Downlight y Paneles", description: "Downlights LED empotrados, paneles y focos" },
    en: { name: "Downlights & Panels", description: "Recessed LED downlights, panels and spotlights" },
  }, l1Tecnica);

  const l2Carril = await findOrCreate("focos-de-carril", {
    es: { name: "Focos de Carril", description: "Sistemas de iluminación en carril LED" },
    en: { name: "Track Lighting", description: "LED track lighting systems" },
  }, l1Tecnica);

  const l2Lineal = await findOrCreate("iluminacion-lineal", {
    es: { name: "Iluminación Lineal", description: "Tubos LED y iluminación lineal" },
    en: { name: "Linear Lighting", description: "LED tubes and linear lighting" },
  }, l1Tecnica);

  // Under Iluminación Exterior e Industrial
  const l2Industrial = await findOrCreate("industrial", {
    es: { name: "Industrial", description: "Campanas LED e iluminación industrial" },
    en: { name: "Industrial", description: "LED high bays and industrial lighting" },
  }, l1Exterior);

  const l2ExteriorSub = await findOrCreate("exterior", {
    es: { name: "Exterior", description: "Proyectores LED y iluminación solar" },
    en: { name: "Outdoor", description: "LED floodlights and solar lighting" },
  }, l1Exterior);

  const l2Seguridad = await findOrCreate("seguridad", {
    es: { name: "Seguridad", description: "Iluminación de emergencia y espejos LED" },
    en: { name: "Security", description: "Emergency lighting and LED mirrors" },
  }, l1Exterior);

  // Under Componentes y Accesorios
  const l2Fuentes = await findOrCreate("fuentes-de-luz", {
    es: { name: "Fuentes de Luz", description: "Bombillas LED y tiras LED" },
    en: { name: "Light Sources", description: "LED bulbs and LED strips" },
  }, l1Componentes);

  const l2Alimentacion = await findOrCreate("alimentacion", {
    es: { name: "Alimentación", description: "Transformadores y fuentes de alimentación LED" },
    en: { name: "Power Supply", description: "LED transformers and power supplies" },
  }, l1Componentes);

  console.log();

  // ── 3. Map existing L3 categories to their L2 parents ──────

  console.log("── Step 3: Assigning existing categories as L3 (leaf) ──\n");

  // Mapping: existing slug → { parentId, newEsName?, newEnName? }
  const l3Mappings: Array<{
    slug: string;
    parentId: string;
    renameEs?: string;
    renameEn?: string;
  }> = [
    // Iluminación Decorativa > Lámparas de Techo
    { slug: "lamparas-de-techo-plafon", parentId: l2Techo, renameEs: "Plafones LED", renameEn: "LED Ceiling Lights" },
    { slug: "lamparas-colgante", parentId: l2Techo },  // actual slug is singular
    { slug: "ventiladores", parentId: l2Techo },

    // Iluminación Decorativa > Lámparas de Pared y Mesa
    { slug: "apliques-de-pared-decoracion-e-iluminacion", parentId: l2ParedMesa },  // full actual slug
    { slug: "lamparas-de-mesa", parentId: l2ParedMesa },
    { slug: "lamparas-de-suelo", parentId: l2ParedMesa },

    // Iluminación Decorativa > Lámparas de Decoración (direct child of L1)
    { slug: "lamparas-decoracion", parentId: l1Iluminacion },  // actual slug

    // Iluminación Técnica > Downlight y Paneles
    { slug: "downlight", parentId: l2Downlight },  // actual slug
    { slug: "panel-led", parentId: l2Downlight },
    { slug: "focos-led", parentId: l2Downlight },

    // Iluminación Técnica > Focos de Carril
    { slug: "focos-carril-led", parentId: l2Carril },
    { slug: "focos-carril-led-magnetico", parentId: l2Carril },
    { slug: "carril-ultrafino", parentId: l2Carril },

    // Iluminación Técnica > Iluminación Lineal
    { slug: "tubos-led", parentId: l2Lineal },

    // Exterior e Industrial > Industrial
    { slug: "campana-led", parentId: l2Industrial, renameEs: "Campanas LED", renameEn: "LED High Bays" },
    { slug: "iluminacion-industrial", parentId: l2Industrial },

    // Exterior e Industrial > Exterior
    { slug: "foco-proyector-ufo", parentId: l2ExteriorSub, renameEs: "Proyectores LED", renameEn: "LED Floodlights" },
    { slug: "solar", parentId: l2ExteriorSub },

    // Exterior e Industrial > Seguridad
    { slug: "luz-emergencia", parentId: l2Seguridad, renameEs: "Luz de Emergencia", renameEn: "Emergency Lights" },
    { slug: "espejos-led", parentId: l2Seguridad },

    // Componentes > Fuentes de Luz
    { slug: "bombillas", parentId: l2Fuentes },  // actual slug
    { slug: "tiras-led", parentId: l2Fuentes },

    // Componentes > Accesorios (direct child of L1)
    { slug: "accesorios", parentId: l1Componentes },

    // Componentes > Alimentación
    { slug: "transformador", parentId: l2Alimentacion, renameEs: "Transformadores", renameEn: "Transformers" },
    { slug: "fuente-alimentacion", parentId: l2Alimentacion, renameEs: "Fuentes de Alimentación", renameEn: "Power Supplies" },
  ];

  for (const mapping of l3Mappings) {
    const cat = bySlug.get(mapping.slug);
    if (!cat) {
      console.log(`  [WARN] Category "${mapping.slug}" not found — skipping`);
      continue;
    }

    // Update parentId
    await db.category.update({
      where: { id: cat.id },
      data: { parentId: mapping.parentId },
    });
    console.log(`  [LINKED] "${mapping.slug}" → parent ${mapping.parentId}`);

    // Rename if needed
    if (mapping.renameEs || mapping.renameEn) {
      await renameCategory(
        cat.id,
        mapping.renameEs || ((cat.content as any)?.es?.name || cat.slug),
        mapping.renameEn || ((cat.content as any)?.en?.name || cat.slug)
      );
    }
  }

  console.log();

  // ── 4. Handle special categories ───────────────────────────

  console.log("── Step 4: Handling special categories ──\n");

  // 4a. NOVEDADES → mark products as isFeatured, then delete category
  const novedades = bySlug.get("novedades");
  if (novedades) {
    const products = await db.product.findMany({
      where: { categoryId: novedades.id },
      select: { id: true },
    });
    console.log(`  [NOVEDADES] Found ${products.length} products`);

    if (products.length > 0) {
      await db.product.updateMany({
        where: { categoryId: novedades.id },
        data: { isFeatured: true },
      });
      console.log(`  [NOVEDADES] Marked ${products.length} products as isFeatured`);

      // We need to reassign these products to a real category before deleting.
      // Default them to the most appropriate L3 based on names, or Accesorios as fallback.
      const productsWithNames = await db.product.findMany({
        where: { categoryId: novedades.id },
        select: { id: true, content: true },
      });

      // Get target category ids for reassignment
      const accesoriosCat = bySlug.get("accesorios");
      const accesoriosId = accesoriosCat?.id;

      for (const p of productsWithNames) {
        const content = p.content as any;
        const name = (content?.es?.name || content?.name || "").toLowerCase();

        let targetCatId = accesoriosId; // default

        if (name.includes("colgante") || name.includes("lámpara") || name.includes("lampara")) {
          const colgantes = bySlug.get("lamparas-colgantes");
          if (colgantes) targetCatId = colgantes.id;
        } else if (name.includes("aplique") || name.includes("pared")) {
          const apliques = bySlug.get("apliques-de-pared");
          if (apliques) targetCatId = apliques.id;
        } else if (name.includes("plafon") || name.includes("plafón") || name.includes("techo")) {
          const plafon = bySlug.get("lamparas-de-techo-plafon");
          if (plafon) targetCatId = plafon.id;
        }

        if (targetCatId) {
          await db.product.update({
            where: { id: p.id },
            data: { categoryId: targetCatId },
          });
        }
      }
      console.log(`  [NOVEDADES] Reassigned products to appropriate categories`);
    }

    await db.category.delete({ where: { id: novedades.id } });
    console.log(`  [NOVEDADES] Deleted category`);
  } else {
    console.log(`  [NOVEDADES] Not found — skipping`);
  }

  // 4b. SALES → leave products' compareAtPrice, delete category
  const sales = bySlug.get("sales");
  if (sales) {
    const salesProducts = await db.product.findMany({
      where: { categoryId: sales.id },
      select: { id: true, content: true },
    });
    console.log(`  [SALES] Found ${salesProducts.length} products`);

    if (salesProducts.length > 0) {
      // Reassign SALES products similarly to NOVEDADES
      const accesoriosCat = bySlug.get("accesorios");
      const accesoriosId = accesoriosCat?.id;

      for (const p of salesProducts) {
        const content = p.content as any;
        const name = (content?.es?.name || content?.name || "").toLowerCase();

        let targetCatId = accesoriosId; // default

        if (name.includes("colgante") || name.includes("lámpara") || name.includes("lampara")) {
          const colgantes = bySlug.get("lamparas-colgantes");
          if (colgantes) targetCatId = colgantes.id;
        } else if (name.includes("aplique") || name.includes("pared")) {
          const apliques = bySlug.get("apliques-de-pared");
          if (apliques) targetCatId = apliques.id;
        } else if (name.includes("downlight")) {
          const dl = bySlug.get("downlight-led");
          if (dl) targetCatId = dl.id;
        } else if (name.includes("panel")) {
          const panel = bySlug.get("panel-led");
          if (panel) targetCatId = panel.id;
        } else if (name.includes("bombilla")) {
          const bombillas = bySlug.get("bombillas-led");
          if (bombillas) targetCatId = bombillas.id;
        } else if (name.includes("tira")) {
          const tiras = bySlug.get("tiras-led");
          if (tiras) targetCatId = tiras.id;
        } else if (name.includes("foco")) {
          const focos = bySlug.get("focos-led");
          if (focos) targetCatId = focos.id;
        } else if (name.includes("plafon") || name.includes("plafón") || name.includes("techo")) {
          const plafon = bySlug.get("lamparas-de-techo-plafon");
          if (plafon) targetCatId = plafon.id;
        }

        if (targetCatId) {
          await db.product.update({
            where: { id: p.id },
            data: { categoryId: targetCatId },
          });
        }
      }
      console.log(`  [SALES] Reassigned products to appropriate categories`);
    }

    await db.category.delete({ where: { id: sales.id } });
    console.log(`  [SALES] Deleted category`);
  } else {
    console.log(`  [SALES] Not found — skipping`);
  }

  // 4c. MÁS PRODUCTOS → reassign based on product name patterns
  const masProductos = bySlug.get("mas-productos");
  if (masProductos) {
    const products = await db.product.findMany({
      where: { categoryId: masProductos.id },
      select: { id: true, content: true },
    });
    console.log(`  [MÁS PRODUCTOS] Found ${products.length} products`);

    const accesoriosCat = bySlug.get("accesorios");
    const accesoriosId = accesoriosCat?.id;

    for (const p of products) {
      const content = p.content as any;
      const name = (content?.es?.name || content?.name || "").toLowerCase();

      let targetCatId = accesoriosId; // default fallback

      if (name.includes("pantalla") || name.includes("totem") || name.includes("tótem")) {
        const industrial = bySlug.get("iluminacion-industrial");
        if (industrial) targetCatId = industrial.id;
      } else if (name.includes("aplique") || name.includes("pared")) {
        const apliques = bySlug.get("apliques-de-pared");
        if (apliques) targetCatId = apliques.id;
      } else if (name.includes("proyector")) {
        const proy = bySlug.get("foco-proyector-ufo");
        if (proy) targetCatId = proy.id;
      } else if (name.includes("foco")) {
        const focos = bySlug.get("focos-led");
        if (focos) targetCatId = focos.id;
      }

      if (targetCatId) {
        await db.product.update({
          where: { id: p.id },
          data: { categoryId: targetCatId },
        });
        console.log(`    → "${name.substring(0, 50)}..." → category ${targetCatId}`);
      }
    }

    await db.category.delete({ where: { id: masProductos.id } });
    console.log(`  [MÁS PRODUCTOS] Deleted category`);
  } else {
    console.log(`  [MÁS PRODUCTOS] Not found — skipping`);
  }

  // 4d. PANTALLAS - TOTEM → just delete (0 products)
  const pantallas = bySlug.get("pantallas-totem") || bySlug.get("pantallas---totem");
  if (pantallas) {
    const count = await db.product.count({ where: { categoryId: pantallas.id } });
    if (count > 0) {
      console.log(`  [WARN] PANTALLAS - TOTEM has ${count} products — reassigning to Accesorios`);
      const accesoriosCat = bySlug.get("accesorios");
      if (accesoriosCat) {
        await db.product.updateMany({
          where: { categoryId: pantallas.id },
          data: { categoryId: accesoriosCat.id },
        });
      }
    }
    await db.category.delete({ where: { id: pantallas.id } });
    console.log(`  [PANTALLAS - TOTEM] Deleted category`);
  } else {
    console.log(`  [PANTALLAS - TOTEM] Not found — skipping`);
  }

  console.log();

  // ── 5. Verification ───────────────────────────────────────

  console.log("── Step 5: Verification ──\n");

  const finalCats = await db.category.findMany({
    include: {
      _count: { select: { products: true } },
      parent: { select: { slug: true } },
      children: { select: { slug: true } },
    },
    orderBy: { slug: "asc" },
  });

  let totalProducts = 0;
  const orphanProducts = await db.product.count({ where: { categoryId: null } });

  console.log("Final category tree:\n");

  // Print L1 categories
  const l1Cats = finalCats.filter((c) => !c.parentId);
  for (const l1 of l1Cats) {
    const l1Name = (l1.content as any)?.es?.name || l1.slug;
    console.log(`${l1Name} [${l1.slug}] (${l1._count.products} direct products)`);
    totalProducts += l1._count.products;

    // L2 children
    const l2Children = finalCats.filter((c) => c.parentId === l1.id);
    for (const l2 of l2Children) {
      const l2Name = (l2.content as any)?.es?.name || l2.slug;
      const isLastL2 = l2 === l2Children[l2Children.length - 1];
      console.log(`  ${isLastL2 ? "└─" : "├─"} ${l2Name} [${l2.slug}] (${l2._count.products} direct products)`);
      totalProducts += l2._count.products;

      // L3 children
      const l3Children = finalCats.filter((c) => c.parentId === l2.id);
      for (const l3 of l3Children) {
        const l3Name = (l3.content as any)?.es?.name || l3.slug;
        const isLastL3 = l3 === l3Children[l3Children.length - 1];
        console.log(`  ${isLastL2 ? "  " : "│ "} ${isLastL3 ? "└─" : "├─"} ${l3Name} [${l3.slug}] (${l3._count.products} products)`);
        totalProducts += l3._count.products;
      }
    }
    console.log();
  }

  console.log(`Total products in categories: ${totalProducts}`);
  console.log(`Orphan products (no category): ${orphanProducts}`);
  console.log(`Total categories: ${finalCats.length}`);
  console.log();

  // Check for any remaining root-level leaf categories that weren't mapped
  const unmappedRoots = l1Cats.filter((c) => {
    const children = finalCats.filter((ch) => ch.parentId === c.id);
    return children.length === 0 && !["iluminacion-decorativa", "iluminacion-tecnica", "iluminacion-exterior-industrial", "componentes-accesorios"].includes(c.slug);
  });

  if (unmappedRoots.length > 0) {
    console.log("[WARN] Unmapped root-level categories still exist:");
    for (const c of unmappedRoots) {
      const name = (c.content as any)?.es?.name || c.slug;
      console.log(`  - ${name} [${c.slug}] (${c._count.products} products)`);
    }
  }

  console.log("\n=== Done ===");
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
