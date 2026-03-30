"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClickablePropertyRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (loading) {
      document.body.style.cursor = "wait";
    } else {
      document.body.style.cursor = "default";
    }

    return () => {
      document.body.style.cursor = "default";
    };
  }, [loading]);

  useEffect(() => {
    setLoading(false);
    document.body.style.cursor = "default";
  }, [pathname]);

  function go() {
    setLoading(true);
    router.push(href);
  }

  return (
    <tr
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      tabIndex={0}
      role="link"
      className="cursor-pointer border-t border-slate-200 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
    >
      {children}
    </tr>
  );
}