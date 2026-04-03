"use client";

import { useFormStatus } from "react-dom";

export default function RunCheckButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-medium text-white ${
        pending ? "cursor-wait bg-blue-400" : "cursor-pointer bg-blue-600 hover:bg-blue-700"
      }`}
    >
     {pending ? "Running..." : "Run Check"}

    </button>
  );
}