import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Criar conta</h1>
      <p className="mt-1 mb-6 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Em seguida você vincula sua vila. Leva menos de um minuto.
      </p>

      <AuthForm mode="sign-up" />

      <p className="mt-6 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
        Já tem conta?{" "}
        <Link href="/sign-in" className="underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </>
  );
}
