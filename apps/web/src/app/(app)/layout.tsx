import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass sticky top-0 z-10 border-x-0 border-t-0">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight">
              ClashPilot
            </Link>
            <nav className="flex items-center gap-4 text-[13px]">
              <Link href="/dashboard" className="hover:underline underline-offset-4">
                Dashboard
              </Link>
              <Link href="/plano" className="hover:underline underline-offset-4">
                Plano
              </Link>
              <Link href="/timeline" className="hover:underline underline-offset-4">
                Timeline
              </Link>
              <Link href="/vila" className="hover:underline underline-offset-4">
                Minha vila
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden text-[13px] sm:inline"
              style={{ color: "var(--text-tertiary)" }}
            >
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1">{children}</main>
    </div>
  );
}
