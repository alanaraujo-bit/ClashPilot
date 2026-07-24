import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-8 text-[15px] font-semibold tracking-tight">
        ClashPilot
      </Link>
      {children}
    </main>
  );
}
