// Capability parity between the loadout composition and the pinned Standard
// composition: every Standard row present with an identical shape and config,
// in Standard's order, the persona differing in text only, the added skills
// row exactly as designed - and a guard that bites on each kind of drift.
import { rmSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeParity, loadComposition } from './parity.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const standardPath = resolve(repoRoot, '../deepseek-harness/apps/cli/config/agent-presets/standard/agent.cordis.yml')
const loadoutPath = resolve(repoRoot, 'packages/preset/preset/loadout/agent.cordis.yml')
const scratch: string[] = []

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

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

  it('keeps Standard\'s top-level row order and appends loadout-skills last', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.targetTopLevelIds).toEqual([...report.standardTopLevelIds, 'loadout-skills'])
  })

  describe('the guard bites on drift the old comparison ignored', () => {
    /** A copy of the loadout composition with one edit applied; the edit must actually change the text. */
    async function mutated(transform: (text: string) => string): Promise<string> {
      const dir = await mkdtemp(join(tmpdir(), 'loadout-parity-'))
      scratch.push(dir)
      const path = join(dir, 'agent.cordis.yml')
      const text = await readFile(loadoutPath, 'utf8')
      const result = transform(text)
      expect(result).not.toBe(text)
      await writeFile(path, result)
      return path
    }

    it('a group that loses its isolate realm is drift, not PRESENT', async () => {
      const path = await mutated(text => text.replace('  isolate:\n    planMode: true\n', ''))
      const report = await analyzeParity(standardPath, path)
      expect(report.rows.find(row => row.id === 'planning')?.classification).toBe('MISSING')
      expect(report.full).toBe(false)
    })

    it('a persona row pointed at another plugin is drift, not an intentional difference', async () => {
      const path = await mutated(text => text.replace("- id: persona\n  name: '@deepseek-ai/dsh-persona'", "- id: persona\n  name: '@deepseek-ai/dsh-agent-instructions'"))
      const report = await analyzeParity(standardPath, path)
      expect(report.rows.find(row => row.id === 'persona')?.classification).toBe('MISSING')
    })

    it('a persona config that changes more than text is drift', async () => {
      const path = await mutated(text => text.replace("  config:\n    text: |-\n      Model:", "  config:\n    complete: true\n    text: |-\n      Model:"))
      const report = await analyzeParity(standardPath, path)
      expect(report.rows.find(row => row.id === 'persona')?.classification).toBe('MISSING')
    })
  })
})
