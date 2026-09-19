// Capability parity between the loadout composition and the pinned Standard
// composition: every Standard row present with an identical shape and config,
// in Standard's order, no row added, the persona differing in prefix/suffix
// only, the skill-filesystem row carrying exactly the preset-local skills
// root - and a guard that bites on each kind of drift.
import { rmSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeParity, loadComposition } from './parity.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const standardPath = resolve(repoRoot, '../deepseek-harness-0.1.5/packages/preset/agent-presets/presets/standard/agent.cordis.yml')
const loadoutPath = resolve(repoRoot, 'packages/dsh-loadout/preset/loadout/agent.cordis.yml')
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
  goals: ['command-goal', 'tool-goal'],
  planning: ['plan-mode'],
  'background jobs': ['tool-jobs'],
  compaction: ['compaction-basic', 'command-compact', 'tool-result-pruner'],
  subagents: ['tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent', 'tool-subagent-fork'],
  workflow: ['workflow-worker-thread', 'tool-workflow', 'tool-ralph'],
  presentation: ['present'],
}

describe('Loadout capability parity with the pinned Standard composition', () => {
  it('keeps every Standard row PRESENT with identical composition', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.full).toBe(true)
    for (const row of report.rows) {
      expect(row.classification, row.id).not.toBe('MISSING')
    }
    expect(report.standardIds).toEqual(report.rows.map(row => row.id))
  })

  it('adds no row and keeps Standard\'s top-level order', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.rows.filter(row => row.classification === 'ADDED')).toEqual([])
    expect(report.targetTopLevelIds).toEqual(report.standardTopLevelIds)
    expect(report.targetIds).not.toContain('tool-presentation')
  })

  it('differs from Standard in exactly two rows: the persona text and the skill root', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.rows.filter(row => row.classification === 'INTENTIONALLY DIFFERENT').map(row => row.id)).toEqual(['persona', 'skill-filesystem'])
  })

  it('the persona keeps 0.1.5\'s prefix/suffix shape with the template variables intact', async () => {
    const [persona] = (await loadComposition(loadoutPath)).filter(row => row.id === 'persona')
    const config = persona?.config as Record<string, unknown>
    expect(Object.keys(config).sort()).toEqual(['prefix', 'suffix'])
    const text = JSON.stringify(config)
    expect(text).toContain('{{model}}')
    expect(text).toContain('{{cwd}}')
  })

  it('the skill-filesystem row adds the preset-local skills root the way upstream\'s cordis preset does', async () => {
    const row = (await loadComposition(loadoutPath)).find(candidate => candidate.id === 'skill-filesystem')
    expect(row?.name).toBe('@deepseek-ai/dsh-skill-filesystem')
    const config = row?.config as { customSkillDirs?: unknown[] }
    expect(Object.keys(config)).toEqual(['customSkillDirs'])
    expect(config.customSkillDirs).toHaveLength(1)
    expect(JSON.stringify(config.customSkillDirs![0])).toContain("new URL('skills/', baseUrl)")
  })

  it('covers every capability group', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    const settled = new Set(report.rows.filter(row => row.classification !== 'MISSING').map(row => row.id))
    for (const [capability, rows] of Object.entries(CAPABILITIES)) {
      for (const row of rows) {
        expect(settled.has(row), capability + ' -> ' + row).toBe(true)
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

  describe('the guard bites on every drift the README rules out', () => {
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

    it('a persona config that changes more than prefix and suffix is drift', async () => {
      const path = await mutated(text => text.replace('  config:\n    prefix: |-\n      Model:', '  config:\n    complete: true\n    prefix: |-\n      Model:'))
      const report = await analyzeParity(standardPath, path)
      expect(report.rows.find(row => row.id === 'persona')?.classification).toBe('MISSING')
    })

    it('a skill-filesystem config that carries anything beyond the skills root is drift', async () => {
      const path = await mutated(text => text.replace('  config:\n    customSkillDirs:', '  config:\n    watch: false\n    customSkillDirs:'))
      const report = await analyzeParity(standardPath, path)
      expect(report.rows.find(row => row.id === 'skill-filesystem')?.classification).toBe('MISSING')
    })

    it('a skills root that does not resolve beside the composition is drift', async () => {
      const path = await mutated(text => text.replace("new URL('skills/', baseUrl)", "new URL('skills/', 'file:///elsewhere/')"))
      const report = await analyzeParity(standardPath, path)
      expect(report.rows.find(row => row.id === 'skill-filesystem')?.classification).toBe('MISSING')
    })
  })
})
