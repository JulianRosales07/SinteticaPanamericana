"use client";

import type { PropsWithChildren } from "react";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { usePathname } from "next/navigation";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname() || "";
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/registro");

  return (
    <div className={`min-h-dvh ${isAdmin ? "bg-background flex flex-col" : "bg-background text-on-background flex flex-col"}`}>
      {!isAdmin && <Navbar hidden={isAuth} />}
      <main className="flex-1">
        {children}
      </main>
      {!isAdmin && !isAuth && <Footer />}
    </div>
  );
}
