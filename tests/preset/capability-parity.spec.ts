// Capability parity between the loadout composition and the pinned Standard
// composition: every Standard row present with identical name/config/disabled,
// the added skills row exactly as designed. (Task 3 adds the persona delta.)
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzeParity, loadComposition } from './parity.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const standardPath = resolve(repoRoot, '../deepseek-harness/apps/cli/config/agent-presets/standard/agent.cordis.yml')
const loadoutPath = resolve(repoRoot, 'packages/preset/preset/loadout/agent.cordis.yml')

// Capability groups mapped to the rows that carry them.
const CAPABILITIES: Readonly<Record<string, readonly string[]>> = {
  'filesystem/read': ['tool-fs'],
  'filesystem mutation': ['tool-fs'],
  search: ['tool-fs-search'],
  shell: ['tool-bash', 'tool-pwsh'],
  skills: ['skill-filesystem', 'tool-skill'],
  goals: ['tool-goal'],
  planning: ['plan-mode'],
  'background jobs': ['tool-jobs'],
  compaction: ['compaction-basic', 'command-compact', 'tool-result-pruner'],
  subagents: ['tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent', 'tool-subagent-fork'],
  workflow: ['workflow-worker-thread', 'tool-workflow', 'tool-ralph'],
}

describe('Loadout capability parity with the pinned Standard composition', () => {
  it('keeps every Standard row PRESENT with identical composition', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.full).toBe(true)
    for (const row of report.rows) {
      expect(row.classification, row.id).not.toBe('MISSING')
    }
    expect(report.standardIds).toEqual(report.rows.filter(row => row.classification !== 'ADDED').map(row => row.id))
  })

  it('adds exactly one row: loadout-skills', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.rows.filter(row => row.classification === 'ADDED').map(row => row.id)).toEqual(['loadout-skills'])
    // Standard carries no presentation row and neither does loadout: presentation stays native.
    expect(report.targetIds).not.toContain('tool-presentation')
  })

  it('the persona is the only Standard row that differs, with the template variables intact', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.rows.filter(row => row.classification === 'INTENTIONALLY DIFFERENT').map(row => row.id)).toEqual(['persona'])
    const [persona] = (await loadComposition(loadoutPath)).filter(row => row.id === 'persona')
    const text = JSON.stringify(persona?.config)
    expect(text).toContain('{{model}}')
    expect(text).toContain('{{cwd}}')
  })

  it('the loadout-skills row is an isolated second skill-filesystem provider over the materialized skills root', async () => {
    const row = (await loadComposition(loadoutPath)).find(candidate => candidate.id === 'loadout-skills')
    expect(row?.name).toBe('@deepseek-ai/dsh-skill-filesystem')
    const config = row?.config as Record<string, unknown>
    expect(config.providerName).toBe('loadout')
    expect(config.includeDefaultRoots).toBe(false)
    expect(config.watch).toBe(false)
    expect(JSON.stringify(config.bundledSkillDir)).toContain("dshHomePath('.agent-presets', 'loadout', 'skills')")
  })

  it('covers every capability group', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    const present = new Set(report.rows.filter(row => row.classification === 'PRESENT').map(row => row.id))
    for (const [capability, rows] of Object.entries(CAPABILITIES)) {
      for (const row of rows) {
        expect(present.has(row), capability + ' -> ' + row).toBe(true)
      }
    }
  })

  it('keeps platform-gating of shell tools identical to Standard', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    const byId = new Map(report.rows.map(row => [row.id, row]))
    expect(byId.get('tool-bash')?.classification).toBe('PRESENT')
    expect(byId.get('tool-pwsh')?.classification).toBe('PRESENT')
    const standard = await loadComposition(standardPath)
    expect(JSON.stringify(standard.find(row => row.id === 'tool-bash')?.disabled)).toContain('process.platform')
    expect(JSON.stringify(standard.find(row => row.id === 'tool-pwsh')?.disabled)).toContain('process.platform')
  })
})
