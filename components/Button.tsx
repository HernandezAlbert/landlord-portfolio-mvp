"use client";

import { useState } from "react";

type Variant = "primary" | "secondary" | "danger";

export default function Button({
  children,
  type = "button",
  variant = "primary",
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: Variant;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const styles: Record<Variant, string> = {
    primary:
      "bg-blue-700 hover:bg-blue-800 text-white border-blue-700",
    secondary:
      "bg-slate-300 hover:bg-slate-400 text-slate-900 border-slate-400",
    danger:
      "bg-red-600 hover:bg-red-700 text-white border-red-600",
  };

  async function handleClick() {
    if (!onClick) return;

    try {
      setLoading(true);
      document.body.style.cursor = "wait";

      await onClick();

    } finally {
      document.body.style.cursor = "default";
      setLoading(false);
    }
  }

  return (
    <button
      type={type}
      onClick={onClick ? handleClick : undefined}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {loading ? "Working..." : children}
    </button>
  );
}