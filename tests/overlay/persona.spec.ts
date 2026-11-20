// The persona is environment plus task-level instruction: no identity claim,
// no competence adjectives, every bundled skill named, within budget.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { BANNED_TOKENS, BUNDLED_SKILLS, PERSONA_MAX_CHARACTERS, ROLE_PLAY_TOKENS } from '../contract.ts'

const loadoutPath = resolve('packages/dsh-loadout/cordis.patch.yml')

interface Persona { readonly prefix: string; readonly suffix: string }
interface OverlayPatch {
  readonly insert: { readonly config: { readonly id: string; readonly config: unknown }[] }[]
}

async function persona(): Promise<Persona> {
  const patch = load(await readFile(loadoutPath, 'utf8'), { schema: entryListSchema }) as OverlayPatch[]
  const row = patch[0]?.insert[0]?.config.find(candidate => candidate.id === 'loadout-prompt')
  const config = row?.config as { prefix?: unknown; suffix?: unknown } | undefined
  expect(typeof config?.prefix).toBe('string')
  expect(typeof config?.suffix).toBe('string')
  return { prefix: config!.prefix as string, suffix: config!.suffix as string }
}

describe('Loadout persona', () => {
  it('opens with the environment statement and nothing else on that line', async () => {
    expect((await persona()).prefix.split('\n')[0]).toBe('Model: {{model}}.')
  })

  it('stays within the standing budget across prefix and suffix', async () => {
    const { prefix, suffix } = await persona()
    expect(prefix.length + suffix.length).toBeLessThanOrEqual(PERSONA_MAX_CHARACTERS)
  })

  it('references only the model prompt variable supported by the current agent loop', async () => {
    const { prefix, suffix } = await persona()
    const refs = [...(prefix + '\n' + suffix).matchAll(/\{\{([^{}]*)\}\}/g)].map(match => match[1])
    expect(new Set(refs)).toEqual(new Set(['model']))
  })

  it('routes to every bundled skill in the prefix and keeps the rules in the suffix', async () => {
    const { prefix, suffix } = await persona()
    for (const name of BUNDLED_SKILLS) expect(prefix, name).toContain(name)
    expect(prefix).toContain('`skill` tool')
    const sections = suffix.split('\n\n').map(section => section.split('\n')[0])
    expect(sections).toEqual(['Task execution:', 'Code changes:', 'Delivery:', 'Writing rules (Stop Slop):'])
    expect(suffix).toContain('todo_write')
  })

  it('keeps the Stop Slop core rules active without loading a skill', async () => {
    const { suffix } = await persona()
    for (const rule of ['Cut filler', 'formulaic contrasts', 'active voice', 'Name specifics', 'reader directly', 'Vary sentence', 'Trust the reader', 'pull-quotes', 'across languages', 'technical accuracy']) expect(suffix).toContain(rule)
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
