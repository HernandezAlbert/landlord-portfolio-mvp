"use client";

import React from "react";

type ConfirmSubmitProps = {
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  title?: string;
  description?: string;
  confirmText?: string;
};

export function ConfirmSubmit({
  children,
  className,
  confirmMessage,
  title,
  description,
  confirmText,
}: ConfirmSubmitProps) {
  const fallbackTitle = title ?? confirmMessage ?? "Are you sure?";
  const message = description
    ? `${fallbackTitle}\n\n${description}`
    : fallbackTitle;

  return (
    <button
      type="submit"
      className={className ?? "btn btn-secondary"}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      aria-label={confirmText ?? fallbackTitle}
    >
      {children}
    </button>
  );
}

export default ConfirmSubmit;