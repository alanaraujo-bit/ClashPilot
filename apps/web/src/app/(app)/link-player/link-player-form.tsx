"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import {
  type ActionState,
  linkPlayerAction,
  searchPlayerAction,
} from "@/server/actions/link-player";
import { formatNumber } from "@/lib/utils";

const initial: ActionState = { status: "idle" };

export function LinkPlayerForm() {
  const [search, searchAction, searching] = useActionState(searchPlayerAction, initial);
  const [link, linkAction, linking] = useActionState(linkPlayerAction, initial);
  const [mode, setMode] = useState<"choose" | "verified" | "observed">("choose");

  const preview = search.status === "preview" ? search.player : null;
  const error =
    link.status === "error" ? link.message : search.status === "error" ? search.message : null;

  return (
    <div className="flex flex-col gap-6">
      {error ? <FormError>{error}</FormError> : null}

      <form action={searchAction} className="flex flex-col gap-3">
        <Field
          label="Tag do jogador"
          hint="No jogo: toque no seu nome, em Perfil. Ela começa com #."
        >
          <Input
            name="tag"
            required
            placeholder="#2PP"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="tabular"
            defaultValue={preview?.tag ?? ""}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={searching}>
          {searching ? "Procurando…" : "Procurar vila"}
        </Button>
      </form>

      {preview ? (
        <section className="card flex flex-col gap-4 p-5">
          <header className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[15px] font-medium tracking-tight">{preview.name}</p>
              <p className="tabular text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {preview.tag}
              </p>
            </div>
            <p className="tabular text-[13px]" style={{ color: "var(--text-secondary)" }}>
              CV {preview.townHallLevel} · {formatNumber(preview.trophies)} 🏆
            </p>
          </header>

          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {preview.clanName ? `Clã: ${preview.clanName}` : "Sem clã"}
            {preview.leagueName ? ` · ${preview.leagueName}` : ""}
          </p>

          {mode === "choose" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => setMode("verified")} className="flex-1">
                É minha conta
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode("observed")}
                className="flex-1"
              >
                Só acompanhar
              </Button>
            </div>
          ) : null}

          {mode === "verified" ? (
            <form action={linkAction} className="flex flex-col gap-3">
              <input type="hidden" name="tag" value={preview.tag} />
              <input type="hidden" name="mode" value="verified" />

              <ol
                className="flex list-decimal flex-col gap-1 pl-4 text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <li>No jogo: Configurações → Mais Configurações</li>
                <li>Conta da API → Mostrar</li>
                <li>Copie o token e cole abaixo</li>
              </ol>

              <Field
                label="Token da API"
                hint="Ele expira em poucos minutos. Se falhar, gere outro."
              >
                <Input name="token" required autoComplete="off" spellCheck={false} />
              </Field>

              <div className="flex gap-2">
                <Button type="submit" disabled={linking} className="flex-1">
                  {linking ? "Verificando…" : "Verificar e vincular"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
                  Voltar
                </Button>
              </div>
            </form>
          ) : null}

          {mode === "observed" ? (
            <form action={linkAction} className="flex flex-col gap-3">
              <input type="hidden" name="tag" value={preview.tag} />
              <input type="hidden" name="mode" value="observed" />
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                No modo observação você vê resumo e evolução pública, mas sem registro da vila,
                metas ou notificações — esses recursos exigem provar que a conta é sua.
              </p>
              <div className="flex gap-2">
                <Button type="submit" variant="secondary" disabled={linking} className="flex-1">
                  {linking ? "Vinculando…" : "Acompanhar mesmo assim"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
                  Voltar
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
