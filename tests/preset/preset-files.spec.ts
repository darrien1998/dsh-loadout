// Stable preset identity, display name, discovery through the supported DSH
// mechanism, and the shipped presets left intact.
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scanRoot } from '@deepseek-ai/dsh-agent-presets'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const harnessRoot = resolve(repoRoot, '../deepseek-harness-0.1.5')
// Production passes ctx.baseUrl — the profile directory, which resolves
// through a mirror of the install anchor's (apps/cli/package.json)
// dependency closure. The worktree's apps/cli/ resolves the same packages
// directly, and is stricter where they differ.
const harnessBase = pathToFileURL(join(harnessRoot, 'apps', 'cli', '/')).href
const PRESET_ID = 'loadout'
// The containment pattern a preset id must match (packages/preset/agent-presets/src/preset.ts).
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const userRoot = resolve(repoRoot, 'packages/dsh-loadout/preset')
const shippedRoot = resolve(harnessRoot, 'packages/preset/agent-presets/presets')

describe('Loadout preset identity and discovery', () => {
  it('has the stable preset id loadout, valid as a preset directory name and not a shipped id', () => {
    expect(PRESET_ID).toMatch(PRESET_ID_PATTERN)
    expect(['standard', 'ptc', 'minimal', 'cordis']).not.toContain(PRESET_ID)
  })

  it('declares the display name Loadout and a description', async () => {
    const metadata = await readFile(resolve(userRoot, PRESET_ID, 'preset.yml'), 'utf8')
    expect(metadata).toContain('name: Loadout')
    expect(metadata).toContain('description:')
  })

  it('is discoverable through the supported DSH user-root mechanism, healthy and trusted user', async () => {
    const found = await scanRoot({ path: userRoot, trust: 'user' }, harnessBase)
    expect(found.map(preset => preset.id)).toEqual([PRESET_ID])
    const preset = found[0]!
    expect(preset.trust).toBe('user')
    expect(preset.name).toBe('Loadout')
    expect(preset.broken).toBeUndefined()
    expect(preset.path).toBe(resolve(userRoot, PRESET_ID, 'agent.cordis.yml'))
  })

  it('keeps the shipped presets discoverable and unchanged', async () => {
    const found = await scanRoot({ path: shippedRoot, trust: 'system' }, harnessBase)
    const ids = found.map(preset => preset.id)
    expect(ids).toEqual(['standard', 'ptc', 'minimal', 'cordis'])
    expect(ids).not.toContain(PRESET_ID)
    expect(found.every(preset => preset.broken === undefined)).toBe(true)
  })
})
