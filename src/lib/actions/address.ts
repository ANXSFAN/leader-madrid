"use server";

import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AddressType } from "@prisma/client";

export async function getUserAddresses(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.id !== userId) return [];

  return await db.address.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAddress(data: {
  userId: string;
  type: AddressType;
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
  phone?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.id !== data.userId) {
    return { error: "Unauthorized" };
  }

  try {
    const address = await db.address.create({
      data: {
        userId: data.userId,
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        street: data.street,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        phone: data.phone,
      },
    });

    revalidatePath("/[locale]/profile", "page");
    return { success: true, address };
  } catch (error) {
    console.error("Error creating address:", error);
    return { error: "Failed to create address" };
  }
}

export async function updateAddress(
  addressId: string,
  data: {
    type?: AddressType;
    firstName?: string;
    lastName?: string;
    company?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    phone?: string;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized" };

  try {
    const existingAddress = await db.address.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.userId !== session.user.id) {
      return { error: "Address not found or unauthorized" };
    }

    const address = await db.address.update({
      where: { id: addressId },
      data,
    });

    revalidatePath("/[locale]/profile", "page");
    return { success: true, address };
  } catch (error) {
    console.error("Error updating address:", error);
    return { error: "Failed to update address" };
  }
}

export async function deleteAddress(addressId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized" };

  try {
    const existingAddress = await db.address.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.userId !== session.user.id) {
      return { error: "Address not found or unauthorized" };
    }

    await db.address.delete({
      where: { id: addressId },
    });

    revalidatePath("/[locale]/profile", "page");
    return { success: true };
  } catch (error) {
    console.error("Error deleting address:", error);
    return { error: "Failed to delete address" };
  }
}
