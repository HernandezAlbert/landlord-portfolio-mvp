export type AppToastVariant = "success" | "error" | "info";

export function emitAppToast(message: string, variant: AppToastVariant = "info") {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: { message, variant },
    }),
  );
}