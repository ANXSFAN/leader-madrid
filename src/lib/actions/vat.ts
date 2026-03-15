"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { EU_VAT_RATES } from "@/lib/vat";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";

export async function getVATConfigs() {
  const configs = await db.countryVATConfig.findMany({
    orderBy: [{ isEU: "desc" }, { countryCode: "asc" }],
  });
  return configs;
}

export async function upsertVATConfig(data: {
  countryCode: string;
  countryName: string;
  standardRate: number;
  reducedRate?: number | null;
  isEU: boolean;
  isActive: boolean;
}) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const schema = z.object({
    countryCode: z.string().length(2),
    countryName: z.string().min(1),
    standardRate: z.number().min(0).max(100),
    reducedRate: z.number().min(0).max(100).optional().nullable(),
    isEU: z.boolean(),
    isActive: z.boolean(),
  });

  const parsed = schema.safeParse(data);
  if (!parsed.success) return { error: "Invalid data" };

  await db.countryVATConfig.upsert({
    where: { countryCode: parsed.data.countryCode },
    update: parsed.data,
    create: parsed.data,
  });

  revalidatePath("/admin/vat");
  return { success: true };
}

export async function seedEUVATRates() {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const entries = Object.entries(EU_VAT_RATES).map(([code, config]) => ({
    countryCode: code,
    countryName: config.nameEs,
    standardRate: config.standard,
    reducedRate: config.reduced ?? null,
    isEU: true,
    isActive: true,
  }));

  for (const entry of entries) {
    await db.countryVATConfig.upsert({
      where: { countryCode: entry.countryCode },
      update: entry,
      create: entry,
    });
  }

  const nonEU = [
    { countryCode: "GB", countryName: "Reino Unido", standardRate: 20, reducedRate: 5, isEU: false, isActive: true },
    { countryCode: "NO", countryName: "Noruega", standardRate: 25, reducedRate: null, isEU: false, isActive: true },
    { countryCode: "CH", countryName: "Suiza", standardRate: 8.1, reducedRate: 2.6, isEU: false, isActive: true },
  ];

  for (const entry of nonEU) {
    await db.countryVATConfig.upsert({
      where: { countryCode: entry.countryCode },
      update: entry,
      create: entry,
    });
  }

  revalidatePath("/admin/vat");
  return { success: true };
}

export async function getDBVATRate(countryCode: string): Promise<number | null> {
  const config = await db.countryVATConfig.findUnique({
    where: { countryCode: countryCode.toUpperCase(), isActive: true },
    select: { standardRate: true },
  });
  return config ? Number(config.standardRate) : null;
}
