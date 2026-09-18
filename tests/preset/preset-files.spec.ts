// Stable preset identity, display name, discovery through the supported DSH
// mechanism, and the shipped presets left intact.
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scanRoot } from '@deepseek-ai/dsh-agent-presets'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const harnessRoot = resolve(repoRoot, '../deepseek-harness')
const PRESET_ID = 'loadout'
// The containment pattern a preset id must match (packages/preset/agent-presets/src/preset.ts).
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const userRoot = resolve(repoRoot, 'packages/preset/preset')
const shippedRoot = resolve(harnessRoot, 'apps/cli/config/agent-presets')

describe('Loadout preset identity and discovery', () => {
  it('has the stable preset id loadout, valid as a preset directory name and not a shipped id', () => {
    expect(PRESET_ID).toMatch(PRESET_ID_PATTERN)
    expect(['standard', 'code', 'minimal', 'cordis']).not.toContain(PRESET_ID)
  })

  it('declares the display name Loadout and a description', async () => {
    const metadata = await readFile(resolve(userRoot, PRESET_ID, 'preset.yml'), 'utf8')
    expect(metadata).toContain('name: Loadout')
    expect(metadata).toContain('description:')
  })

  it('is discoverable through the supported DSH user-root mechanism, healthy and trusted user', async () => {
    const found = await scanRoot({ path: userRoot, trust: 'user' })
    expect(found.map(preset => preset.id)).toEqual([PRESET_ID])
    const preset = found[0]!
    expect(preset.trust).toBe('user')
    expect(preset.name).toBe('Loadout')
    expect(preset.broken).toBeUndefined()
    expect(preset.path).toBe(resolve(userRoot, PRESET_ID, 'agent.cordis.yml'))
  })

  it('keeps the shipped presets discoverable and unchanged', async () => {
    const found = await scanRoot({ path: shippedRoot, trust: 'system' })
    expect(found.map(preset => preset.id)).toEqual(['standard', 'code', 'minimal', 'cordis'])
    expect(found.every(preset => preset.broken === undefined)).toBe(true)
  })
})
