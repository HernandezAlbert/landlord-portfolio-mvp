"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastDetail = {
  message: string;
  variant?: ToastVariant;
};

export default function GlobalUiEnhancer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const nextToastId = useRef(1);

  const searchKey = useMemo(() => searchParams?.toString() ?? "", [searchParams]);

  useEffect(() => {
    const clearPendingTimeout = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const beginPending = () => {
      clearPendingTimeout();
      setPending(true);
      timeoutRef.current = window.setTimeout(() => {
        setPending(false);
        timeoutRef.current = null;
      }, 10000);
    };

    const resetPending = () => {
      clearPendingTimeout();
      setPending(false);
    };

    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;

      const submitter = (event as SubmitEvent).submitter as
        | HTMLButtonElement
        | HTMLInputElement
        | null;

      if (submitter?.disabled) return;
      beginPending();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      if (link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      beginPending();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetPending();
      }
    };

    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;

      const id = nextToastId.current++;
      const variant = detail.variant ?? "info";

      setToasts((current) => [...current, { id, message: detail.message, variant }]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 3500);
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("pageshow", resetPending);
    window.addEventListener("focus", resetPending);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("app:toast", onToast as EventListener);

    return () => {
      clearPendingTimeout();
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pageshow", resetPending);
      window.removeEventListener("focus", resetPending);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("app:toast", onToast as EventListener);
    };
  }, []);

  useEffect(() => {
    setPending(false);
  }, [pathname, searchKey]);

  useEffect(() => {
    document.body.classList.toggle("app-pending", pending);
    return () => document.body.classList.remove("app-pending");
  }, [pending]);

  return (
    <>
      <div className={`app-progress ${pending ? "app-progress-visible" : ""}`} aria-hidden={!pending}>
        <div className="app-progress-bar" />
        <div className="app-progress-chip" role="status" aria-live="polite">
          <span className="app-spinner" />
          Working...
        </div>
      </div>

      <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`app-toast ${
              toast.variant === "success"
                ? "app-toast-success"
                : toast.variant === "error"
                ? "app-toast-error"
                : "app-toast-info"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}