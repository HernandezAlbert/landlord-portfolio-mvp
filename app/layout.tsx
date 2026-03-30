import "./globals.css";
import type { Metadata } from "next";
import GlobalUiEnhancer from "@/components/GlobalUiEnhancer";

export const metadata: Metadata = {
  title: "Landlord Portfolio",
  description: "Single-user landlord portfolio MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlobalUiEnhancer />
        {children}
      </body>
    </html>
  );
}
