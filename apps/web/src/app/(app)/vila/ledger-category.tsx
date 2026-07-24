"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { type LedgerActionState, saveLedgerAction } from "@/server/actions/ledger";
import { cn } from "@/lib/utils";

export interface SlotView {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly quantity: number;
  readonly maxLevel: number;
  readonly declared: readonly { slot: number; level: number; count: number }[];
}

const initial: LedgerActionState = { status: "idle" };

/** Nível de cada cópia. Muralha é tratada à parte: peças demais para uma por uma. */
function initialLevels(slot: SlotView): number[] {
  const levels = Array.from({ length: slot.quantity }, () => 0);
  for (const row of slot.declared) {
    if (row.slot >= 0 && row.slot < levels.length) levels[row.slot] = row.level;
  }
  return levels;
}

function initialWalls(slot: SlotView): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const row of slot.declared) counts[row.level] = row.count;
  return counts;
}

export function LedgerCategory({
  playerId,
  category,
  label,
  slots,
  previousTownHallMax,
}: {
  readonly playerId: string;
  readonly category: string;
  readonly label: string;
  readonly slots: readonly SlotView[];
  readonly previousTownHallMax: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(saveLedgerAction, initial);
  const [levels, setLevels] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(slots.map((s) => [s.key, initialLevels(s)])),
  );
  const [walls, setWalls] = useState<Record<string, Record<number, number>>>(() =>
    Object.fromEntries(slots.map((s) => [s.key, initialWalls(s)])),
  );

  const isWall = category === "wall";

  const payload = useMemo(() => {
    const entries = isWall
      ? slots.flatMap((slot) =>
          Object.entries(walls[slot.key] ?? {})
            .map(([level, count]) => ({
              key: slot.key,
              slot: Number(level),
              level: Number(level),
              count,
            }))
            .filter((e) => e.count > 0),
        )
      : slots.flatMap((slot) =>
          (levels[slot.key] ?? []).map((level, index) => ({
            key: slot.key,
            slot: index,
            level,
            count: 1,
          })),
        );
    return JSON.stringify({ playerId, category, entries });
  }, [isWall, slots, walls, levels, playerId, category]);

  const declaredCount = slots.reduce((acc, s) => acc + s.declared.length, 0);

  /** Heurística que resolve a maioria das contas em um toque (docs/00 §2.1). */
  function fillAll(source: "previous" | "max") {
    setLevels(
      Object.fromEntries(
        slots.map((s) => [
          s.key,
          Array.from({ length: s.quantity }, () =>
            source === "max" ? s.maxLevel : (previousTownHallMax[s.key] ?? s.maxLevel),
          ),
        ]),
      ),
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />

      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-medium tracking-tight">{label}</h2>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {declaredCount > 0 ? "Declarado" : "Ainda não declarado"} · {slots.length} tipos
          </p>
        </div>
        {!isWall ? (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => fillAll("previous")}>
              Máximo do CV anterior
            </Button>
            <Button type="button" variant="ghost" onClick={() => fillAll("max")}>
              Tudo no máximo
            </Button>
          </div>
        ) : null}
      </header>

      {state.status === "error" ? <FormError>{state.message}</FormError> : null}
      {state.status === "saved" ? (
        <p className="text-[13px]" style={{ color: "var(--positive)" }}>
          Salvo. O progresso já foi recalculado.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {slots.map((slot) =>
          isWall ? (
            <WallRow
              key={slot.key}
              slot={slot}
              counts={walls[slot.key] ?? {}}
              onChange={(next) => setWalls((prev) => ({ ...prev, [slot.key]: next }))}
            />
          ) : (
            <SlotRow
              key={slot.key}
              slot={slot}
              values={levels[slot.key] ?? []}
              onChange={(next) => setLevels((prev) => ({ ...prev, [slot.key]: next }))}
            />
          ),
        )}
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando…" : `Salvar ${label.toLowerCase()}`}
      </Button>
    </form>
  );
}

function SlotRow({
  slot,
  values,
  onChange,
}: {
  readonly slot: SlotView;
  readonly values: readonly number[];
  readonly onChange: (next: number[]) => void;
}) {
  return (
    <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-baseline gap-2">
        <span className="text-[14px]">{slot.name}</span>
        <span className="tabular text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          ×{slot.quantity} · máx {slot.maxLevel}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value, index) => (
          <input
            // A posição é a identidade aqui: são cópias idênticas de um mesmo prédio.
            key={index}
            type="number"
            inputMode="numeric"
            min={0}
            max={slot.maxLevel}
            value={value}
            aria-label={`${slot.name} ${index + 1}`}
            onChange={(event) => {
              const next = [...values];
              next[index] = Math.max(0, Math.min(slot.maxLevel, Number(event.target.value) || 0));
              onChange(next);
            }}
            className={cn(
              "tabular h-9 w-12 rounded-[var(--radius-control)] border bg-[var(--bg-base)] text-center text-[13px]",
              "border-[var(--border-strong)] transition-colors focus:border-[var(--accent)]",
              value === 0 && "opacity-50",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function WallRow({
  slot,
  counts,
  onChange,
}: {
  readonly slot: SlotView;
  readonly counts: Record<number, number>;
  readonly onChange: (next: Record<number, number>) => void;
}) {
  const total = Object.values(counts).reduce((acc, n) => acc + n, 0);
  const levels = Array.from({ length: slot.maxLevel }, (_, i) => i + 1);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px]">{slot.name}</span>
        <span
          className="tabular text-[12px]"
          style={{ color: total > slot.quantity ? "var(--critical)" : "var(--text-tertiary)" }}
        >
          {total} / {slot.quantity} peças
        </span>
      </div>
      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        Quantas peças você tem em cada nível. Não precisa somar exatamente — o que faltar conta como
        ainda não construído.
      </p>
      <div className="flex flex-wrap gap-2">
        {levels.map((level) => (
          <label key={level} className="flex flex-col items-center gap-1">
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              nv {level}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={slot.quantity}
              value={counts[level] ?? 0}
              aria-label={`Peças de muralha no nível ${level}`}
              onChange={(event) =>
                onChange({ ...counts, [level]: Math.max(0, Number(event.target.value) || 0) })
              }
              className="tabular h-9 w-16 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-base)] text-center text-[13px] transition-colors focus:border-[var(--accent)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
