"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { type RefreshState, refreshPlayerAction } from "@/server/actions/refresh";

const initial: RefreshState = { status: "idle" };

export function RefreshButton({ playerId }: { readonly playerId: string }) {
  const [state, action, pending] = useActionState(refreshPlayerAction, initial);

  const label =
    state.status === "throttled"
      ? "Sincronizado há pouco"
      : state.status === "error"
        ? "Tentar de novo"
        : state.status === "done"
          ? state.events > 0
            ? `${state.events} novidade${state.events > 1 ? "s" : ""}`
            : "Atualizado"
          : "Atualizar";

  return (
    <form action={action}>
      <input type="hidden" name="playerId" value={playerId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sincronizando…" : label}
      </Button>
    </form>
  );
}
