// Compare the bundle's declared plugins against the exact published Standard preset.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeParity, loadComposition } from './parity.ts'

const standardPath = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-web-app/presets/standard.patch.yml'))
const loadoutPath = resolve('packages/dsh-loadout/cordis.patch.yml')
const scratch: string[] = []
afterEach(async () => { for (const dir of scratch.splice(0)) await rm(dir, { recursive: true, force: true }) })

async function mutated(from: string, to: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'loadout-parity-'))
  scratch.push(dir)
  const text = await readFile(loadoutPath, 'utf8')
  expect(text).toContain(from)
  const path = join(dir, 'cordis.patch.yml')
  await writeFile(path, text.replace(from, to))
  return path
}

describe('Loadout parity with DSH 0.2.2-rc.4 Standard', () => {
  it('preserves every upstream row, configuration, platform gate, and top-level order', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.full).toBe(true)
    expect(report.targetIds).toEqual(report.standardIds)
    expect(report.targetTopLevelIds).toEqual(report.standardTopLevelIds)
    expect(report.rows.filter(row => row.classification === 'INTENTIONALLY DIFFERENT').map(row => row.id)).toEqual(['persona', 'skill-filesystem'])
  })

  it('includes the current scheduling, time, office, workflow and plugin-management capabilities', async () => {
    const ids = (await loadComposition(loadoutPath)).map(row => row.id)
    for (const id of ['time-context', 'tool-schedule', 'tool-office', 'workflow-ptc', 'tool-subagent-control', 'tool-plugin-manager']) expect(ids).toContain(id)
    for (const retired of ['workflow-worker-thread', 'tool-subagent-list-agents', 'tool-ralph']) expect(ids).not.toContain(retired)
  })

  it('keeps Standard documentation skills and appends the installed Loadout skill root', async () => {
    const rows = await loadComposition(loadoutPath)
    const config = rows.find(row => row.id === 'skill-filesystem')!.config as { customSkillDirs: unknown[] }
    expect(config.customSkillDirs).toHaveLength(2)
    expect(JSON.stringify(config.customSkillDirs[0])).toContain('@deepseek-ai/dsh-agent-preset/package.json')
    expect(JSON.stringify(config.customSkillDirs[1])).toContain('dsh-loadout/package.json')
  })

  it.each([
    ['              workflowEngine: true\n', ''],
    ["name: '@deepseek-ai/dsh-persona'", "name: '@deepseek-ai/dsh-agent-instructions'"],
    ['              prefix: |-', '              complete: true\n              prefix: |-'],
    ["resolve('dsh-loadout/package.json')", "resolve('elsewhere/package.json')"],
    ["resolve('@deepseek-ai/dsh-agent-preset/package.json')", "resolve('elsewhere/package.json')"],
    ['              applyPatch: false', '              applyPatch: true'],
  ])('rejects unauthorized composition drift: %s', async (from, to) => {
    const report = await analyzeParity(standardPath, await mutated(from, to))
    expect(report.full).toBe(false)
  })
})
