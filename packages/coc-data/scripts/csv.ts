/**
 * Parser do CSV da Supercell.
 *
 * Não é CSV comum. O formato é:
 *   linha 1 → nomes das colunas
 *   linha 2 → tipos das colunas (`string` | `int` | `boolean`)
 *   demais  → dados, onde uma linha com a PRIMEIRA coluna preenchida inicia um novo objeto e
 *             as linhas seguintes com a primeira coluna vazia são os NÍVEIS desse objeto.
 *
 * É exatamente essa convenção que dá os custos por nível. Célula vazia herda o valor da
 * linha anterior do mesmo objeto — sem isso, metade dos níveis parece custar zero.
 */

export type CsvValue = string | number | boolean | null;
export type CsvRow = Record<string, CsvValue>;

/** Um objeto do jogo com todas as suas linhas de nível, já com herança resolvida. */
export interface CsvObject {
  readonly name: string;
  readonly levels: readonly CsvRow[];
}

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Aspas duplas escapadas dentro de campo entre aspas.
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function coerce(raw: string, type: string): CsvValue {
  if (raw === "") return null;
  switch (type) {
    case "int":
      return Number.parseInt(raw, 10);
    case "boolean":
      return raw.toLowerCase() === "true" || raw === "1";
    default:
      return raw;
  }
}

export function parseSupercellCsv(content: string): CsvObject[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 3) return [];

  const headers = splitLine(lines[0]!);
  const types = splitLine(lines[1]!);

  const objects: { name: string; levels: CsvRow[] }[] = [];

  for (const line of lines.slice(2)) {
    const cells = splitLine(line);
    const first = (cells[0] ?? "").trim();

    if (first.length > 0) {
      objects.push({ name: first, levels: [] });
    }
    const target = objects.at(-1);
    if (!target) continue; // linha de nível antes de qualquer objeto: arquivo malformado

    const previous = target.levels.at(-1);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      const value = coerce((cells[index] ?? "").trim(), types[index] ?? "string");
      // Herança: célula vazia repete o valor do nível anterior do MESMO objeto.
      row[header] = value ?? previous?.[header] ?? null;
    });

    row[headers[0]!] = target.name;
    target.levels.push(row);
  }

  return objects;
}

export const asInt = (value: CsvValue): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const asString = (value: CsvValue): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export const asBool = (value: CsvValue): boolean => value === true;
