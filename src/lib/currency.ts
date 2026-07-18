// Currency configuration and formatting utilities for CWA Homes
// Supports: NGN (Nigerian Naira), GBP (British Pounds), USD (US Dollars), EUR (Euros)

import type { Currency } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  name: string;
  locale: string;
  decimalPlaces: number;
}

export const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG", decimalPlaces: 2 },
  GBP: { code: "GBP", symbol: "£", name: "British Pounds", locale: "en-GB", decimalPlaces: 2 },
  USD: { code: "USD", symbol: "$", name: "US Dollars", locale: "en-US", decimalPlaces: 2 },
  EUR: { code: "EUR", symbol: "€", name: "Euros", locale: "de-DE", decimalPlaces: 2 },
} as const;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Locale-aware currency formatting using Intl.NumberFormat.
 *
 * Examples:
 *   formatCurrency(1234567.89, "NGN") → "₦1,234,567.89"
 *   formatCurrency(1234.56, "GBP")    → "£1,234.56"
 */
export function formatCurrency(amount: number, currency: Currency | string): string {
  const config = CURRENCY_CONFIG[currency as Currency];
  if (!config) {
    return `${amount.toFixed(2)} ${currency}`;
  }

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: config.decimalPlaces,
    maximumFractionDigits: config.decimalPlaces,
  }).format(amount);
}

/**
 * Compact notation for dashboards.
 *
 * Examples:
 *   formatCurrencyCompact(1_200_000, "NGN") → "₦1.2M"
 *   formatCurrencyCompact(45_000, "GBP")    → "£45K"
 */
export function formatCurrencyCompact(amount: number, currency: Currency | string): string {
  const config = CURRENCY_CONFIG[currency as Currency];
  if (!config) {
    return `${amount} ${currency}`;
  }

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Exchange rates (static / indicative only)
// ---------------------------------------------------------------------------

/**
 * Approximate static exchange rates with NGN as the base currency.
 * The value represents how many NGN one unit of the given currency buys.
 *
 * These are for UI display purposes ONLY — not for financial transactions.
 */
export const EXCHANGE_RATES: Record<Currency, number> = {
  NGN: 1,
  GBP: 2050,
  USD: 1600,
  EUR: 1750,
} as const;

export interface ConversionResult {
  amount: number;
  rate: number;
  disclaimer: string;
}

/**
 * Convert an amount between two currencies using static indicative rates.
 *
 * Always includes a disclaimer — these rates must never be used for
 * actual financial transactions.
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
): ConversionResult {
  const fromRate = EXCHANGE_RATES[from];
  const toRate = EXCHANGE_RATES[to];

  // Convert via NGN base: amount * (fromRate / toRate)
  const rate = fromRate / toRate;
  const converted = amount * rate;

  return {
    amount: Math.round(converted * 100) / 100,
    rate: Math.round(rate * 1_000_000) / 1_000_000,
    disclaimer: "Indicative rate only. Not for financial transactions.",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Quick symbol lookup.
 *
 *   getCurrencySymbol("NGN") → "₦"
 *   getCurrencySymbol("GBP") → "£"
 */
export function getCurrencySymbol(currency: Currency | string): string {
  const config = CURRENCY_CONFIG[currency as Currency];
  return config?.symbol ?? currency;
}

/**
 * Parse a user-entered currency string into a number.
 *
 * Strips currency symbols, thousand separators, and whitespace.
 * Returns null if the value cannot be parsed.
 *
 *   parseCurrencyAmount("₦1,234.56", "NGN") → 1234.56
 *   parseCurrencyAmount("1234", "USD")       → 1234
 *   parseCurrencyAmount("abc", "GBP")        → null
 */
export function parseCurrencyAmount(value: string, _currency: Currency): number | null {
  // Strip known currency symbols and whitespace
  let cleaned = value.replace(/[₦£$€\s]/g, "");

  // Remove thousand separators (commas)
  cleaned = cleaned.replace(/,/g, "");

  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** The four supported currencies in display order. */
export const DEFAULT_CURRENCIES: Currency[] = ["NGN", "GBP", "USD", "EUR"];
