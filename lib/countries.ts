export interface CountryOption {
  code: string;
  label: string;
  timezone: string;
  utcOffset: string;
  currencyCode: string;
  currencySymbol: string;
  decimalDigits: number;
}

export const COUNTRIES: CountryOption[] = [
  { code: "TH", label: "🇹🇭 Thailand", timezone: "Asia/Bangkok", utcOffset: "UTC+7", currencyCode: "THB", currencySymbol: "฿", decimalDigits: 2 },
  { code: "VN", label: "🇻🇳 Vietnam", timezone: "Asia/Ho_Chi_Minh", utcOffset: "UTC+7", currencyCode: "VND", currencySymbol: "₫", decimalDigits: 0 },
  { code: "KH", label: "🇰🇭 Cambodia", timezone: "Asia/Phnom_Penh", utcOffset: "UTC+7", currencyCode: "KHR", currencySymbol: "៛", decimalDigits: 0 },
  { code: "LA", label: "🇱🇦 Laos", timezone: "Asia/Vientiane", utcOffset: "UTC+7", currencyCode: "LAK", currencySymbol: "₭", decimalDigits: 0 },
  { code: "MM", label: "🇲🇲 Myanmar", timezone: "Asia/Yangon", utcOffset: "UTC+6:30", currencyCode: "MMK", currencySymbol: "K", decimalDigits: 0 },
  { code: "MY", label: "🇲🇾 Malaysia", timezone: "Asia/Kuala_Lumpur", utcOffset: "UTC+8", currencyCode: "MYR", currencySymbol: "RM", decimalDigits: 2 },
  { code: "SG", label: "🇸🇬 Singapore", timezone: "Asia/Singapore", utcOffset: "UTC+8", currencyCode: "SGD", currencySymbol: "S$", decimalDigits: 2 },
  { code: "ID", label: "🇮🇩 Indonesia", timezone: "Asia/Jakarta", utcOffset: "UTC+7", currencyCode: "IDR", currencySymbol: "Rp", decimalDigits: 0 },
  { code: "PH", label: "🇵🇭 Philippines", timezone: "Asia/Manila", utcOffset: "UTC+8", currencyCode: "PHP", currencySymbol: "₱", decimalDigits: 2 },
  { code: "TW", label: "🇹🇼 Taiwan", timezone: "Asia/Taipei", utcOffset: "UTC+8", currencyCode: "TWD", currencySymbol: "NT$", decimalDigits: 0 },
  { code: "HK", label: "🇭🇰 Hong Kong", timezone: "Asia/Hong_Kong", utcOffset: "UTC+8", currencyCode: "HKD", currencySymbol: "HK$", decimalDigits: 2 },
  { code: "CN", label: "🇨🇳 China", timezone: "Asia/Shanghai", utcOffset: "UTC+8", currencyCode: "CNY", currencySymbol: "¥", decimalDigits: 2 },
  { code: "JP", label: "🇯🇵 Japan", timezone: "Asia/Tokyo", utcOffset: "UTC+9", currencyCode: "JPY", currencySymbol: "¥", decimalDigits: 0 },
  { code: "KR", label: "🇰🇷 South Korea", timezone: "Asia/Seoul", utcOffset: "UTC+9", currencyCode: "KRW", currencySymbol: "₩", decimalDigits: 0 },
];

export const DEFAULT_COUNTRY_CODE = "TH";

export function getCountry(code: string): CountryOption {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
}

export function getTimezoneForCountry(code: string): string {
  return getCountry(code).timezone;
}

export function isValidCountryCode(code: string): boolean {
  return COUNTRIES.some(c => c.code === code);
}
