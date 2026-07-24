import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Entrar</h1>
      <p className="mt-1 mb-6 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Continue de onde sua vila parou.
      </p>

      <AuthForm mode="sign-in" />

      <p className="mt-6 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
        Ainda não tem conta?{" "}
        <Link href="/sign-up" className="underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </>
  );
}
