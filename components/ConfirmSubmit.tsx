"use client";

import React from "react";

type ConfirmSubmitProps = {
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
};

export function ConfirmSubmit({ confirmMessage, children, className }: ConfirmSubmitProps) {
  return (
    <button
      type="submit"
      className={className ?? "btn btn-secondary"}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
    </button>
  );
}

export default ConfirmSubmit;
