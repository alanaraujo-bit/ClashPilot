import type { Metadata } from "next";
import { requireUser } from "@/server/session";
import { LinkPlayerForm } from "./link-player-form";

export const metadata: Metadata = { title: "Vincular vila" };

export default async function LinkPlayerPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-md px-5 py-12">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Vamos encontrar sua vila</h1>
      <p className="mt-1 mb-6 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Use a tag do jogo. Nada é alterado na sua conta — só leitura.
      </p>
      <LinkPlayerForm />
    </div>
  );
}
