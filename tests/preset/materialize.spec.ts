// Boot-time preset materialization semantics: create-if-absent under the
// harness-home preset root, provenance marker, user-owned directories never
// rewritten, an untouched older generation upgraded in place.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { COMPOSITION_VERSION, MARKER_FILE, PRESET_ID, materializePreset, presetSourceDir } from '../../packages/preset/materialize.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = resolve(here, '../../packages/preset/preset/loadout')
const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

async function freshHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'loadout-preset-home-'))
  homes.push(home)
  return home
}

/** Deterministic tree hash (relative paths, sorted, marker excluded) - mirrors materialize.mjs. */
function hashTree(dir: string): string {
  const hash = createHash('sha256')
  const entries: Array<[string, Buffer]> = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const target = join(current, entry)
      if (statSync(target).isDirectory()) walk(target)
      else if (entry !== MARKER_FILE) entries.push([relative(dir, target).split('\\').join('/'), readFileSync(target)])
    }
  }
  walk(dir)
  for (const [path, content] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(path); hash.update('\u0000'); hash.update(content); hash.update('\u0000')
  }
  return hash.digest('hex')
}

interface Marker { presetId: string; version: number; sourceHash: string; materializedAt: string; source: string }

describe('Loadout preset materialization', () => {
  it('ships its own preset source directory with the skills inside it', () => {
    expect(PRESET_ID).toBe('loadout')
    expect(MARKER_FILE).toBe('.loadout-materialized.json')
    expect(COMPOSITION_VERSION).toBe(1)
    expect(existsSync(join(presetSourceDir(), 'agent.cordis.yml'))).toBe(true)
    expect(existsSync(join(presetSourceDir(), 'skills', 'grill-me', 'SKILL.md'))).toBe(true)
  })

  it('creates the preset under the harness-home preset root with a provenance marker, skills included', async () => {
    const home = await freshHome()
    const report = materializePreset({ home, sourceDir, now: () => '2026-01-01T00:00:00.000Z' })
    expect(report.action).toBe('created')
    expect(report.presetDir).toBe(join(home, '.agent-presets', PRESET_ID))
    expect(existsSync(join(report.presetDir, 'agent.cordis.yml'))).toBe(true)
    expect(existsSync(join(report.presetDir, 'preset.yml'))).toBe(true)
    expect(existsSync(join(report.presetDir, 'skills', 'systematic-debugging', 'SKILL.md'))).toBe(true)
    const marker = JSON.parse(readFileSync(report.markerPath, 'utf8')) as Marker
    expect(marker.presetId).toBe(PRESET_ID)
    expect(marker.version).toBe(COMPOSITION_VERSION)
    expect(marker.materializedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(marker.source).toBe('@loadout/dsh-preset')
    expect(marker.sourceHash).toBe(report.sourceHash)
    expect(hashTree(report.presetDir)).toBe(report.sourceHash)
  })

  it('a user edit anywhere in the directory - a skill included - is detected as present-outdated and never overwritten', async () => {
    const home = await freshHome()
    const first = materializePreset({ home, sourceDir })
    expect(first.action).toBe('created')
    const edited = join(first.presetDir, 'skills', 'grill-me', 'SKILL.md')
    await writeFile(edited, '---\nname: grill-me\ndescription: Use when edited.\n---\nmine\n')
    const second = materializePreset({ home, sourceDir })
    expect(second.action).toBe('present-outdated')
    expect(second.note).toContain('never overwritten')
    expect(await readFile(edited, 'utf8')).toContain('mine')
    const third = materializePreset({ home, sourceDir })
    expect(third.action).toBe('present-outdated')
    expect(await readFile(edited, 'utf8')).toContain('mine')
  })

  it('treats a pre-existing directory without a marker as user-owned and never repairs it', async () => {
    const home = await freshHome()
    const target = join(home, '.agent-presets', PRESET_ID)
    mkdirSync(target, { recursive: true })
    await writeFile(join(target, 'agent.cordis.yml'), '[]\n')
    const report = materializePreset({ home, sourceDir })
    expect(report.action).toBe('present')
    expect(await readFile(join(target, 'agent.cordis.yml'), 'utf8')).toBe('[]\n')
    expect(existsSync(join(target, MARKER_FILE))).toBe(false)
  })

  it('leaves an untouched current-generation materialization as present', async () => {
    const home = await freshHome()
    expect(materializePreset({ home, sourceDir }).action).toBe('created')
    const again = materializePreset({ home, sourceDir })
    expect(again.action).toBe('present')
    expect(again.markerVersion).toBe(COMPOSITION_VERSION)
  })

  it('upgrades an untouched OLDER generation in place and re-stamps the marker', async () => {
    const home = await freshHome()
    const first = materializePreset({ home, sourceDir })
    expect(first.action).toBe('created')
    // Rewrite the marker as an older generation with the same content hash: the
    // exact state an untouched previous install leaves behind.
    const previous = JSON.parse(readFileSync(first.markerPath, 'utf8')) as Marker
    writeFileSync(first.markerPath, JSON.stringify({ ...previous, version: COMPOSITION_VERSION - 1 }, null, 2) + '\n')
    const upgraded = materializePreset({ home, sourceDir })
    expect(upgraded.action).toBe('upgraded')
    expect(upgraded.markerVersion).toBe(COMPOSITION_VERSION - 1)
    expect(upgraded.sourceVersion).toBe(COMPOSITION_VERSION)
    const marker = JSON.parse(readFileSync(first.markerPath, 'utf8')) as Marker
    expect(marker.version).toBe(COMPOSITION_VERSION)
    expect(hashTree(first.presetDir)).toBe(marker.sourceHash)
  })

  it('never downgrades: a marker from a future generation is present', async () => {
    const home = await freshHome()
    const first = materializePreset({ home, sourceDir })
    const previous = JSON.parse(readFileSync(first.markerPath, 'utf8')) as Marker
    writeFileSync(first.markerPath, JSON.stringify({ ...previous, version: COMPOSITION_VERSION + 1 }, null, 2) + '\n')
    expect(materializePreset({ home, sourceDir }).action).toBe('present')
  })

  it('produces deterministic content hashes across homes', async () => {
    const first = materializePreset({ home: await freshHome(), sourceDir })
    const second = materializePreset({ home: await freshHome(), sourceDir })
    expect(first.sourceHash).toBe(second.sourceHash)
  })
})
