import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import lzma from "lzma";

/**
 * Download e decodificação dos arquivos de lógica oficiais do jogo.
 *
 * Fonte: `https://game-assets.clashofclans.com/{fingerprint}/logic/*.csv` — o mesmo CDN que o
 * próprio jogo usa. É a única fonte que não é "alguém digitou numa wiki": os números são
 * exatamente os que o cliente do jogo carrega. Ver ADR-004.
 *
 * Formato: os arquivos vêm com um cabeçalho de assinatura `Sig:` de 68 bytes, seguido de LZMA
 * com um header não-padrão de 9 bytes (5 de propriedades + 4 de tamanho descomprimido, em vez
 * dos 13 do LZMA canônico). Reconstruímos o header padrão inserindo 4 bytes zero.
 */

const SIGNATURE_PREFIX = "Sig:";
const SIGNATURE_LENGTH = 68;

export const ASSET_FILES = {
  buildings: "logic/buildings.csv",
  characters: "logic/characters.csv",
  heroes: "logic/heroes.csv",
  pets: "logic/pets.csv",
  spells: "logic/spells.csv",
  equipment: "logic/character_items.csv",
  traps: "logic/traps.csv",
  townHalls: "logic/townhall_levels.csv",
  supers: "logic/super_licences.csv",
  texts: "localization/texts.csv",
} as const;

export type AssetName = keyof typeof ASSET_FILES;

function stripSignature(buffer: Buffer): Buffer {
  const head = buffer.subarray(0, SIGNATURE_PREFIX.length).toString("ascii");
  return head === SIGNATURE_PREFIX ? buffer.subarray(SIGNATURE_LENGTH) : buffer;
}

function isPlainCsv(buffer: Buffer): boolean {
  return buffer.subarray(0, 6).toString("ascii").startsWith('"');
}

/** Insere os 4 bytes de tamanho que faltam para virar um header LZMA canônico de 13 bytes. */
function toCanonicalLzma(buffer: Buffer): Buffer {
  return Buffer.concat([buffer.subarray(0, 9), Buffer.alloc(4), buffer.subarray(9)]);
}

export function decodeAsset(raw: Buffer): string {
  const body = stripSignature(raw);
  if (isPlainCsv(body)) return body.toString("utf8");

  const decompressed = lzma.decompress(toCanonicalLzma(body)) as number[] | string;
  return typeof decompressed === "string"
    ? decompressed
    : Buffer.from(decompressed).toString("utf8");
}

export async function fetchAsset(fingerprint: string, remotePath: string): Promise<string> {
  const url = `https://game-assets.clashofclans.com/${fingerprint}/${remotePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return decodeAsset(Buffer.from(await res.arrayBuffer()));
}

/**
 * Baixa uma vez e mantém em cache local: regenerar o catálogo não deve depender da rede
 * nem martelar o CDN da Supercell a cada execução.
 */
export async function loadAsset(
  fingerprint: string,
  name: AssetName,
  cacheDir: string,
): Promise<string> {
  const file = path.join(cacheDir, fingerprint, `${name}.csv`);
  try {
    return await readFile(file, "utf8");
  } catch {
    const content = await fetchAsset(fingerprint, ASSET_FILES[name]);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, "utf8");
    return content;
  }
}
