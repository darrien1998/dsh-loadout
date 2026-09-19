// The persona is environment plus task-level instruction: no identity claim,
// no competence adjectives, every bundled skill named, within budget.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadComposition } from './parity.ts'
import { BANNED_TOKENS, BUNDLED_SKILLS, PERSONA_MAX_CHARACTERS, ROLE_PLAY_TOKENS } from '../contract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const loadoutPath = resolve(here, '../../packages/dsh-loadout/preset/loadout/agent.cordis.yml')

interface Persona { readonly prefix: string; readonly suffix: string }

async function persona(): Promise<Persona> {
  const row = (await loadComposition(loadoutPath)).find(candidate => candidate.id === 'persona')
  const config = row?.config as { prefix?: unknown; suffix?: unknown } | undefined
  expect(typeof config?.prefix).toBe('string')
  expect(typeof config?.suffix).toBe('string')
  return { prefix: config!.prefix as string, suffix: config!.suffix as string }
}

describe('Loadout persona', () => {
  it('opens with the environment statement and nothing else on that line', async () => {
    expect((await persona()).prefix.split('\n')[0]).toBe('Model: {{model}}. Working directory: {{cwd}}.')
  })

  it('stays within the standing budget across prefix and suffix', async () => {
    const { prefix, suffix } = await persona()
    expect(prefix.length + suffix.length).toBeLessThanOrEqual(PERSONA_MAX_CHARACTERS)
  })

  it('references only the two prompt variables the agent loop registers', async () => {
    const { prefix, suffix } = await persona()
    const refs = [...(prefix + '\n' + suffix).matchAll(/\{\{([^{}]*)\}\}/g)].map(match => match[1])
    expect(new Set(refs)).toEqual(new Set(['model', 'cwd']))
  })

  it('routes to every bundled skill in the prefix and keeps the rules in the suffix', async () => {
    const { prefix, suffix } = await persona()
    for (const name of BUNDLED_SKILLS) expect(prefix, name).toContain(name)
    expect(prefix).toContain('`skill` tool')
    expect(suffix.split('\n')[0]).toBe('Standing rules:')
    expect(suffix).toContain('todo_write')
    expect(suffix.split('\n').filter(line => line.startsWith('- ')).length).toBe(7)
    for (const rule of ['act:', 'assessment, not a fix', 'surgically', 'Validate at boundaries', 'skipped steps as skipped', 'selecting detail', 'end a turn on a promise']) {
      expect(suffix, rule).toContain(rule)
    }
  })

  it('carries no vocabulary from another harness and no role-play', async () => {
    const { prefix, suffix } = await persona()
    for (const text of [prefix, suffix]) {
      for (const token of BANNED_TOKENS) expect(text, String(token)).not.toMatch(token)
      for (const token of ROLE_PLAY_TOKENS) expect(text, String(token)).not.toMatch(token)
    }
  })

  it('never tells the model to enter plan mode (only the user can)', async () => {
    const { prefix, suffix } = await persona()
    expect(prefix + suffix).not.toMatch(/plan mode/i)
  })
})
