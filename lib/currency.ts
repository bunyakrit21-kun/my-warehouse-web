import { getCountry } from "@/lib/countries";

/** Formats an amount using the store's country currency symbol and decimal convention. */
export function formatCurrency(amount: number, countryCode: string): string {
  const { currencySymbol, decimalDigits } = getCountry(countryCode);
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: decimalDigits,
    maximumFractionDigits: decimalDigits,
  });
  return `${currencySymbol}${formatted}`;
}
