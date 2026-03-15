"use server";

import { requireRole } from "@/lib/auth-guard";
import { isSupportedCurrency, type SupportedCurrency } from "@/lib/currency";
import {
  getExchangeRate as getRate,
  getAllCurrentRates,
  fetchECBRates,
  setManualRate,
  removeManualOverride,
} from "@/lib/services/exchange-rate-service";

/**
 * Public: get all current exchange rates.
 */
export async function getExchangeRates() {
  return getAllCurrentRates();
}

/**
 * Public: get a single currency's exchange rate.
 */
export async function getExchangeRate(currency: string): Promise<number> {
  if (!isSupportedCurrency(currency)) {
    return 1.0;
  }
  return getRate(currency);
}

/**
 * ADMIN only: manually set an exchange rate override.
 */
export async function updateExchangeRate(currency: string, rate: number) {
  await requireRole(["ADMIN"]);

  if (!isSupportedCurrency(currency)) {
    return { error: "Unsupported currency" };
  }
  if (currency === "EUR") {
    return { error: "Cannot override EUR base rate" };
  }
  if (rate <= 0) {
    return { error: "Rate must be positive" };
  }

  await setManualRate(currency as SupportedCurrency, rate);
  return { success: true };
}

/**
 * ADMIN only: remove manual override, revert to ECB rate.
 */
export async function removeExchangeRateOverride(currency: string) {
  await requireRole(["ADMIN"]);

  if (!isSupportedCurrency(currency)) {
    return { error: "Unsupported currency" };
  }

  await removeManualOverride(currency as SupportedCurrency);
  return { success: true };
}

/**
 * ADMIN only: manually trigger ECB rate refresh.
 */
export async function refreshECBRates() {
  await requireRole(["ADMIN"]);

  try {
    const result = await fetchECBRates();
    return { success: true, ...result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch ECB rates",
    };
  }
}
