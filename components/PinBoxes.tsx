"use client";

import { useRef } from "react";

interface PinBoxesProps {
  value: string[];
  onChange: (v: string[]) => void;
  autoFocus?: boolean;
  size?: "sm" | "md" | "lg";
  error?: boolean;
}

export default function PinBoxes({ value, onChange, autoFocus = false, size = "md", error = false }: PinBoxesProps) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const sizeClass = {
    sm: "w-10 h-10 text-base",
    md: "w-12 h-12 text-xl",
    lg: "w-14 h-14 text-2xl",
  }[size];

  const borderClass = error
    ? "border-2 border-red-300 focus:border-red-500"
    : "border-2 border-gray-200 focus:border-black";

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 3) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!value[i] && i > 0) {
        const next = [...value];
        next[i - 1] = "";
        onChange(next);
        refs[i - 1].current?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs[i - 1].current?.focus();
    } else if (e.key === "ArrowRight" && i < 3) {
      refs[i + 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4).split("");
    const next = ["", "", "", ""];
    digits.forEach((d, i) => { next[i] = d; });
    onChange(next);
    const lastFilled = Math.min(digits.length, 3);
    refs[lastFilled].current?.focus();
  };

  return (
    <div className="flex justify-center gap-3">
      {value.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={d}
          autoFocus={autoFocus && i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={`${sizeClass} ${borderClass} rounded-xl text-center font-black outline-none transition-all bg-white`}
        />
      ))}
    </div>
  );
}
