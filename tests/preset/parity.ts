// Capability-parity analyzer.
//
// rc.5 has no preset-level patch semantics, so the loadout composition is a
// deliberate full copy of the shipped Standard composition (the same cost
// upstream accepts for code and cordis). This module makes the copy
// auditable instead of a hidden fork: it parses both files with the loader's
// own YAML dialect (entryListSchema, the one carrying !!js) and classifies
// every row PRESENT / INTENTIONALLY DIFFERENT / ADDED / MISSING. The parity
// tests fail the moment upstream Standard gains a row this copy lacks.
import { readFile } from 'node:fs/promises'
import { load } from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

export interface CompositionRow {
  readonly id: string
  readonly name?: string
  readonly disabled?: unknown
  readonly config?: unknown
  readonly group?: boolean
  readonly isolate?: Record<string, boolean>
}

export type CapabilityClassification = 'PRESENT' | 'INTENTIONALLY DIFFERENT' | 'ADDED' | 'MISSING'

export interface CapabilityRow {
  readonly id: string
  readonly classification: CapabilityClassification
  readonly note?: string
}

export interface ParityReport {
  readonly full: boolean
  readonly standardIds: readonly string[]
  readonly targetIds: readonly string[]
  readonly rows: readonly CapabilityRow[]
}

function flattenRows(rows: unknown): Map<string, CompositionRow> {
  const map = new Map<string, CompositionRow>()
  if (!Array.isArray(rows)) return map
  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue
    const record = raw as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : undefined
    if (id === undefined) continue
    let entry: CompositionRow = { id }
    if (typeof record.name === 'string') entry = { ...entry, name: record.name }
    if (record.disabled !== undefined) entry = { ...entry, disabled: record.disabled }
    if (record.config !== undefined) entry = { ...entry, config: record.config }
    if (record.group === true) entry = { ...entry, group: true }
    if (typeof record.isolate === 'object' && record.isolate !== null) entry = { ...entry, isolate: record.isolate as Record<string, boolean> }
    map.set(id, entry)
    for (const [nestedId, nestedRow] of flattenRows(record.config)) map.set(nestedId, nestedRow)
  }
  return map
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, stable(record[key])]))
  }
  return value
}

export async function loadComposition(path: string): Promise<CompositionRow[]> {
  const text = await readFile(path, 'utf8')
  const rows = load(text, { schema: entryListSchema })
  return [...flattenRows(rows).values()]
}

export async function analyzeParity(standardPath: string, targetPath: string): Promise<ParityReport> {
  const standard = await loadComposition(standardPath)
  const target = await loadComposition(targetPath)
  const standardById = new Map(standard.map(row => [row.id, row]))
  const targetById = new Map(target.map(row => [row.id, row]))
  const rows: CapabilityRow[] = []
  for (const id of [...standardById.keys()].sort()) {
    const source = standardById.get(id)
    const copy = targetById.get(id)
    if (source === undefined) continue
    if (copy === undefined) {
      rows.push({ id, classification: 'MISSING' })
      continue
    }
    const sameName = source.name === copy.name
    const sameConfig = JSON.stringify(stable(source.config)) === JSON.stringify(stable(copy.config))
    const sameDisabled = JSON.stringify(stable(source.disabled)) === JSON.stringify(stable(copy.disabled))
    if (sameName && sameConfig && sameDisabled) {
      rows.push({ id, classification: 'PRESENT' })
    } else if (id === 'persona') {
      rows.push({ id, classification: 'INTENTIONALLY DIFFERENT', note: 'Loadout persona text; template variables preserved' })
    } else {
      rows.push({ id, classification: 'MISSING', note: 'same id but different name/config/disabled - capability drift' })
    }
  }
  for (const id of [...targetById.keys()].sort()) {
    if (!standardById.has(id)) rows.push({ id, classification: 'ADDED' })
  }
  return {
    full: rows.every(row => row.classification !== 'MISSING'),
    standardIds: [...standardById.keys()].sort(),
    targetIds: [...targetById.keys()].sort(),
    rows: rows.sort((left, right) => left.id.localeCompare(right.id)),
  }
}
