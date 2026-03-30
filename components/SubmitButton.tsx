"use client";

import { useFormStatus } from "react-dom";

type Variant = "primary" | "secondary" | "danger";

export default function SubmitButton({
  children,
  pendingLabel = "Working...",
  className = "",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: Variant;
}) {
  const { pending } = useFormStatus();
  const styles: Record<Variant, string> = {
    primary: "btn btn-primary",
    secondary: "btn btn-secondary",
    danger: "btn btn-danger",
  };

  return (
    <button type="submit" disabled={pending} className={`${styles[variant]} ${className}`.trim()}>
      <span className="inline-flex items-center gap-2">
        {pending && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />}
        {pending ? pendingLabel : children}
      </span>
    </button>
  );
}
