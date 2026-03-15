"use server";

import db from "@/lib/db";

export async function createDefaultSupplier() {
  try {
    const existing = await db.supplier.findFirst();
    if (existing) {
      console.log("Supplier already exists:", existing.name);
      return {
        success: true,
        message: "Supplier already exists",
        supplier: existing,
      };
    }

    const supplier = await db.supplier.create({
      data: {
        name: "General Supplier",
        code: "GEN",
        contact: {
          name: "Admin",
          email: "admin@example.com",
          phone: "123456789",
        },
      },
    });

    console.log("Default supplier created:", supplier.name);
    return { success: true, message: "Default supplier created", supplier };
  } catch (error: unknown) {
    console.error("Error creating default supplier:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Self-execute if run directly
if (require.main === module) {
  createDefaultSupplier()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
