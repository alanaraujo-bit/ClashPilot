"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { signIn, signUp } from "@/lib/auth-client";

const MIN_PASSWORD = 10;

/** Traduz o erro do Better Auth para algo que o usuário consiga agir. */
function humanize(code: string | undefined, fallback: string): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail ou senha incorretos.";
    case "USER_ALREADY_EXISTS":
      return "Já existe uma conta com esse e-mail. Tente entrar.";
    case "PASSWORD_TOO_SHORT":
      return `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`;
    default:
      return fallback;
  }
}

export function AuthForm({ mode }: { readonly mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    if (mode === "sign-up" && password.length < MIN_PASSWORD) {
      setError(`A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    const result =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: String(data.get("name") ?? "") });

    if (result.error) {
      setError(humanize(result.error.code, result.error.message ?? "Não foi possível continuar."));
      return;
    }

    // `refresh` antes de navegar: o layout do app lê a sessão no servidor.
    startTransition(() => {
      router.refresh();
      router.push(mode === "sign-in" ? "/dashboard" : "/link-player");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}

      {mode === "sign-up" ? (
        <Field label="Como podemos te chamar?">
          <Input name="name" autoComplete="name" placeholder="Alan" />
        </Field>
      ) : null}

      <Field label="E-mail">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@email.com"
        />
      </Field>

      <Field
        label="Senha"
        hint={mode === "sign-up" ? `Mínimo de ${MIN_PASSWORD} caracteres.` : undefined}
      >
        <Input
          name="password"
          type="password"
          required
          minLength={mode === "sign-up" ? MIN_PASSWORD : undefined}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        />
      </Field>

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Aguarde…" : mode === "sign-in" ? "Entrar" : "Criar conta"}
      </Button>
    </form>
  );
}
