// Validate the declaration with DSH's current entry validator; runtime mounting is covered by the packed smoke.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { entryListProblem, type PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { describe, expect, it } from 'vitest'

export async function declaration(): Promise<{ id: string; name: string; config: PresetDefinition }> {
  const patch = load(await readFile(resolve('packages/dsh-loadout/cordis.patch.yml'), 'utf8'), { schema: entryListSchema }) as { insert: { id: string; name: string; config: PresetDefinition }[] }[]
  expect(patch).toHaveLength(1)
  expect(patch[0]!.insert).toHaveLength(1)
  return patch[0]!.insert[0]!
}

describe('native declarative Loadout preset', () => {
  it('registers a named loadout preset through the supported plugin', async () => {
    const row = await declaration()
    expect(row.id).toBe('preset-loadout')
    expect(row.name).toBe('@deepseek-ai/dsh-agent-preset')
    expect(row.config).toMatchObject({ id: 'loadout', name: 'Loadout', order: 5 })
    expect(row.config.description).toContain('Stop Slop')
    expect(entryListProblem(row.config.plugins)).toBeUndefined()
  })
})
