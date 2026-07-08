"use client";

/**
 * Small curated icon set for spec-07 (accounting ledger). The rest of DiaM renders
 * icons as inline SVG (see app/dashboard/page.tsx) rather than pulling from an npm
 * icon library, so this follows the same pattern instead of adding a new dependency
 * — same outcome the spec asks for (no emoji, one consistent icon style), just kept
 * in one place so accounts/categories can share it.
 */

export type IconName =
  | "cash" | "bank" | "wallet" | "dots"
  | "receipt" | "home" | "bolt" | "users" | "box" | "tag" | "cart" | "gift";

const PATHS: Record<IconName, React.ReactNode> = {
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 6v0M18 6v0M6 18v0M18 18v0" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M4 10v9M9 10v9M15 10v9M20 10v9" />
      <path d="M2 21h20" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <path d="M16 14h3" />
      <path d="M6 7V5a2 2 0 012-2h6" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <circle cx="17.5" cy="9" r="2.6" />
      <path d="M15 20a5.2 5.2 0 016.5-3.6" />
    </>
  ),
  box: (
    <>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </>
  ),
  tag: (
    <>
      <path d="M2 12l9-9h9v9l-9 9-9-9z" />
      <circle cx="15" cy="8" r="1.6" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h3l2.6 12.4A2 2 0 009.5 17H18a2 2 0 002-1.6L21.5 7H6" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="1" />
      <path d="M3 13h18" />
      <path d="M12 9v12" />
      <path d="M12 9C9 9 7.5 7.5 7.5 6a2 2 0 013.5-1.3C11.5 5.5 12 7 12 9zM12 9c3 0 4.5-1.5 4.5-3a2 2 0 00-3.5-1.3C12.5 5.5 12 7 12 9z" />
    </>
  ),
};

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({ name, className }: { name: string; className?: string }) {
  const paths = PATHS[name as IconName] ?? PATHS.dots;
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (name: IconName) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {ICON_NAMES.map(name => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className={`aspect-square rounded-xl border flex items-center justify-center transition-all ${
            value === name ? "border-black bg-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-400"
          }`}
          aria-label={name}
        >
          <Icon name={name} className="w-4.5 h-4.5" />
        </button>
      ))}
    </div>
  );
}
