import sql from "@/lib/db";
import { getTimezoneForCountry } from "@/lib/countries";

/**
 * Computes the "business date" a timestamp belongs to, given the store's
 * timezone and business-day start time (e.g. "18:00" for a store open 18:00-04:30).
 * Times before the cutoff belong to the previous calendar day's business date.
 * Default "00:00" makes this identical to the plain calendar date.
 */
export function getBusinessDate(timestamp: Date, businessDayStartTime: string, timezone: string): string {
  const [h, m] = businessDayStartTime.split(":").map(Number);
  const cutoffMinutes = h * 60 + (m || 0);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);

  const get = (type: string) => parts.find(p => p.type === type)!.value;
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const nowMinutes = Number(get("hour")) * 60 + Number(get("minute"));

  if (nowMinutes < cutoffMinutes) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return dateStr;
}

/** Looks up the store's business-day start time + IANA timezone (derived from country). */
export async function getStoreTimeContext(storeId: string): Promise<{ businessDayStartTime: string; timezone: string }> {
  const [store] = await sql`SELECT business_day_start_time, country FROM stores WHERE id = ${storeId}`;
  return {
    businessDayStartTime: store?.business_day_start_time ?? "00:00",
    timezone: getTimezoneForCountry(store?.country ?? "TH"),
  };
}

/** Looks up the store's country/business-day start time and returns today's business date. */
export async function getCurrentBusinessDate(storeId: string): Promise<string> {
  const { businessDayStartTime, timezone } = await getStoreTimeContext(storeId);
  return getBusinessDate(new Date(), businessDayStartTime, timezone);
}

/** Wall-clock minutes-since-midnight for a timestamp in the given timezone (for shift-window matching). */
export function getMinutesSinceMidnight(timestamp: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return Number(get("hour")) * 60 + Number(get("minute"));
}
