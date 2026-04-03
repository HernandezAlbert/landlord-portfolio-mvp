"use client";

import { useEffect, useRef } from "react";
import { emitAppToast, type AppToastVariant } from "@/lib/app-toast";

export default function ToastBridge({
  message,
  variant = "success",
}: {
  message?: string | null;
  variant?: AppToastVariant;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!message || firedRef.current) return;
    firedRef.current = true;
    emitAppToast(message, variant);
  }, [message, variant]);

  return null;
}