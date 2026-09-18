// The persona is environment plus task-level instruction: no identity claim,
// no competence adjectives, every bundled skill named, within budget.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadComposition } from './parity.ts'
import { BANNED_TOKENS, BUNDLED_SKILLS, PERSONA_MAX_CHARACTERS, ROLE_PLAY_TOKENS } from '../contract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const loadoutPath = resolve(here, '../../packages/preset/preset/loadout/agent.cordis.yml')

async function persona(): Promise<string> {
  const row = (await loadComposition(loadoutPath)).find(candidate => candidate.id === 'persona')
  const config = row?.config as { text?: unknown } | undefined
  expect(typeof config?.text).toBe('string')
  return config!.text as string
}

describe('Loadout persona', () => {
  it('opens with the environment statement and nothing else on that line', async () => {
    expect((await persona()).split('\n')[0]).toBe('Model: {{model}}. Working directory: {{cwd}}.')
  })

  it('stays within the standing budget', async () => {
    expect((await persona()).length).toBeLessThanOrEqual(PERSONA_MAX_CHARACTERS)
  })

  it('references only the two prompt variables the agent loop registers', async () => {
    const refs = [...(await persona()).matchAll(/\{\{([^{}]*)\}\}/g)].map(match => match[1])
    expect(new Set(refs)).toEqual(new Set(['model', 'cwd']))
  })

  it('names every bundled skill and the tools that reach them', async () => {
    const text = await persona()
    for (const name of BUNDLED_SKILLS) expect(text, name).toContain(name)
    expect(text).toContain('`skill` tool')
    expect(text).toContain('todo_write')
  })

  it('carries no vocabulary from another harness and no role-play', async () => {
    const text = await persona()
    for (const token of BANNED_TOKENS) expect(text, String(token)).not.toMatch(token)
    for (const token of ROLE_PLAY_TOKENS) expect(text, String(token)).not.toMatch(token)
  })

  it('never tells the model to enter plan mode (only the user can)', async () => {
    expect(await persona()).not.toMatch(/plan mode/i)
  })
})
