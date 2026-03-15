"use server";

import db from "@/lib/db";

export async function getAttributes() {
  try {
    return await db.attributeDefinition.findMany({
      include: {
        options: true,
      },
      orderBy: { name: "asc" }, // Note: name is JSON, sorting might be tricky but okay for now
    });
  } catch (error) {
    console.error("Error fetching attributes:", error);
    return [];
  }
}
