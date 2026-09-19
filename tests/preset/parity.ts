// Capability-parity analyzer.
//
// rc.5 has no preset-level patch semantics, so the loadout composition is a
// deliberate full copy of the shipped Standard composition (the same cost
// upstream accepts for code and cordis). This module makes the copy
// auditable instead of a hidden fork: it parses both files with the loader's
// own YAML dialect (entryListSchema, the one carrying !!js) and classifies
// every row PRESENT / INTENTIONALLY DIFFERENT / ADDED / MISSING. A row is
// PRESENT only when its whole shape (every key but `config`: name, disabled,
// group, isolate, anything else) and its config match; the persona is
// INTENTIONALLY DIFFERENT only when its shape matches and its config differs
// in `text` alone. The parity tests fail the moment upstream Standard gains a
// row this copy lacks, or the copy drifts in any other key.
import { readFile } from 'node:fs/promises'
import { load } from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

export interface CompositionRow {
  readonly id: string
  readonly config?: unknown
  readonly [key: string]: unknown
}

export type CapabilityClassification = 'PRESENT' | 'INTENTIONALLY DIFFERENT' | 'ADDED' | 'MISSING'

export interface CapabilityRow {
  readonly id: string
  readonly classification: CapabilityClassification
  readonly note?: string
}

export interface ParityReport {
  readonly full: boolean
  /** Every id at any depth, sorted. */
  readonly standardIds: readonly string[]
  readonly targetIds: readonly string[]
  /** Top-level ids only, in file order. */
  readonly standardTopLevelIds: readonly string[]
  readonly targetTopLevelIds: readonly string[]
  readonly rows: readonly CapabilityRow[]
}

interface Composition {
  readonly topLevelIds: readonly string[]
  readonly rows: Map<string, CompositionRow>
}

/** Every row keeps every key it carries; `config` rides along and nested rows inside it are flattened too. */
function flattenRows(rows: unknown, map = new Map<string, CompositionRow>()): Map<string, CompositionRow> {
  if (!Array.isArray(rows)) return map
  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue
    const record = raw as Record<string, unknown>
    if (typeof record.id !== 'string') continue
    map.set(record.id, { ...record, id: record.id })
    flattenRows(record.config, map)
  }
  return map
}

function topLevelIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return []
  const ids: string[] = []
  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue
    const id = (raw as Record<string, unknown>).id
    if (typeof id === 'string') ids.push(id)
  }
  return ids
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, stable(record[key])]))
  }
  return value
}

function omit(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const { [key]: _dropped, ...rest } = value as Record<string, unknown>
  return rest
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right))
}

async function readComposition(path: string): Promise<Composition> {
  const text = await readFile(path, 'utf8')
  const rows = load(text, { schema: entryListSchema })
  return { topLevelIds: topLevelIds(rows), rows: flattenRows(rows) }
}

export async function loadComposition(path: string): Promise<CompositionRow[]> {
  return [...(await readComposition(path)).rows.values()]
}

export async function analyzeParity(standardPath: string, targetPath: string): Promise<ParityReport> {
  const standard = await readComposition(standardPath)
  const target = await readComposition(targetPath)
  const standardById = standard.rows
  const targetById = target.rows
  const rows: CapabilityRow[] = []
  for (const id of [...standardById.keys()].sort()) {
    const source = standardById.get(id)
    const copy = targetById.get(id)
    if (source === undefined) continue
    if (copy === undefined) {
      rows.push({ id, classification: 'MISSING' })
      continue
    }
    const sameShape = same(omit(source, 'config'), omit(copy, 'config'))
    const sameConfig = same(source.config, copy.config)
    if (sameShape && sameConfig) {
      rows.push({ id, classification: 'PRESENT' })
    } else if (id === 'persona' && sameShape && same(omit(source.config, 'text'), omit(copy.config, 'text'))) {
      rows.push({ id, classification: 'INTENTIONALLY DIFFERENT', note: 'Loadout persona text; template variables preserved' })
    } else {
      rows.push({ id, classification: 'MISSING', note: 'same id but a different shape or config - capability drift' })
    }
  }
  for (const id of [...targetById.keys()].sort()) {
    if (!standardById.has(id)) rows.push({ id, classification: 'ADDED' })
  }
  return {
    full: rows.every(row => row.classification !== 'MISSING'),
    standardIds: [...standardById.keys()].sort(),
    targetIds: [...targetById.keys()].sort(),
    standardTopLevelIds: standard.topLevelIds,
    targetTopLevelIds: target.topLevelIds,
    rows: rows.sort((left, right) => left.id.localeCompare(right.id)),
  }
}
