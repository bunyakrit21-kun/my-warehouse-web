"use client";

interface PinBoxesProps {
  value: string[];
  onChange: (v: string[]) => void;
  onComplete?: (pin: string) => void;
  autoFocus?: boolean;
  size?: "sm" | "md" | "lg";
  error?: boolean;
}

export default function PinBoxes({ value, onChange, onComplete, error = false }: PinBoxesProps) {
  const filled = value.filter(d => d !== "").length;

  const handleDigit = (d: string) => {
    if (filled >= 4) return;
    const next = [...value];
    next[filled] = d;
    onChange(next);
    if (filled === 3 && onComplete) onComplete(next.join(""));
  };

  const handleDelete = () => {
    if (filled === 0) return;
    const next = [...value];
    for (let i = 3; i >= 0; i--) {
      if (next[i] !== "") { next[i] = ""; break; }
    }
    onChange(next);
  };

  const dotColor = error ? "bg-red-500" : "bg-gray-900";
  const emptyDot = error ? "border-red-300" : "border-gray-300";

  return (
    <div className="select-none">
      {/* 4 dot indicators */}
      <div className="flex justify-center gap-4 mb-6">
        {value.map((d, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
              d ? dotColor : `border-2 ${emptyDot}`
            }`}
          />
        ))}
      </div>

      {/* Numpad 3×4 */}
      <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
        {["1","2","3","4","5","6","7","8","9"].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-900 text-xl font-semibold transition-all"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={handleDelete}
          className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-500 transition-all flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12H5m0 0l3-3m-3 3l3 3M19 12H12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-900 text-xl font-semibold transition-all"
        >
          0
        </button>
        <div />
      </div>
    </div>
  );
}
