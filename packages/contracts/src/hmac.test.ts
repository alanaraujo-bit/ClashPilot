import { describe, expect, it } from "vitest";
import { canonicalBody, sign, verify } from "./hmac.js";

const secret = "segredo-de-teste-com-32-caracteres";
const now = 1_800_000_000_000;
const base = { secret, method: "GET", path: "/players/%232PP", body: "", now };

const signed = (overrides: Partial<typeof base> = {}) => {
  const params = { ...base, ...overrides };
  const timestamp = String(params.now);
  return verify({
    ...params,
    timestamp,
    signature: sign(secret, timestamp, params.method, params.path, params.body),
  });
};

describe("HMAC do gateway", () => {
  it("aceita uma assinatura válida dentro da janela", () => {
    expect(signed()).toEqual({ ok: true });
  });

  it("rejeita quando falta assinatura ou timestamp", () => {
    expect(verify({ ...base, signature: undefined, timestamp: String(now) })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(verify({ ...base, signature: "abc", timestamp: undefined })).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("rejeita timestamp fora da janela — impede replay", () => {
    const timestamp = String(now - 120_000);
    const signature = sign(secret, timestamp, base.method, base.path, base.body);
    expect(verify({ ...base, timestamp, signature })).toEqual({ ok: false, reason: "expired" });
  });

  it("rejeita timestamp não numérico", () => {
    expect(verify({ ...base, timestamp: "ontem", signature: "abc" })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejeita quando método, caminho ou corpo mudam — a assinatura cobre tudo", () => {
    const timestamp = String(now);
    const signature = sign(secret, timestamp, "GET", "/players/A", "");

    expect(verify({ ...base, timestamp, signature, method: "POST", path: "/players/A" }).ok).toBe(
      false,
    );
    expect(verify({ ...base, timestamp, signature, method: "GET", path: "/players/B" }).ok).toBe(
      false,
    );
    expect(
      verify({ ...base, timestamp, signature, method: "GET", path: "/players/A", body: "x" }).ok,
    ).toBe(false);
  });

  it("rejeita assinatura de outro segredo", () => {
    const timestamp = String(now);
    const signature = sign(
      "outro-segredo-completamente",
      timestamp,
      base.method,
      base.path,
      base.body,
    );
    expect(verify({ ...base, timestamp, signature })).toEqual({ ok: false, reason: "mismatch" });
  });

  it("canonicalBody trata ausência de corpo como string vazia", () => {
    // Regressão: `JSON.stringify(undefined ?? "")` devolve '""' e quebrava todo GET.
    expect(canonicalBody(undefined)).toBe("");
    expect(canonicalBody(null)).toBe("");
    expect(canonicalBody("")).toBe("");
    expect(canonicalBody("cru")).toBe("cru");
    expect(canonicalBody({ token: "abc" })).toBe('{"token":"abc"}');
  });

  it("um GET sem corpo assina igual dos dois lados", () => {
    const timestamp = String(now);
    const clientSig = sign(secret, timestamp, "GET", "/players/%232PP", "");
    expect(
      verify({
        secret,
        timestamp,
        signature: clientSig,
        method: "GET",
        path: "/players/%232PP",
        body: canonicalBody(undefined),
        now,
      }),
    ).toEqual({ ok: true });
  });

  it("é determinístico para a mesma entrada", () => {
    expect(sign(secret, "1", "GET", "/x", "")).toBe(sign(secret, "1", "GET", "/x", ""));
  });
});
