import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { describe, expect, it } from 'vitest'

const patch = load(await readFile(resolve('packages/dsh-loadout/cordis.patch.yml'), 'utf8'), { schema: entryListSchema })

describe('Loadout bundle', () => {
  it('adds only the persona and skill provider in one group', () => {
    expect(patch).toEqual([{ insert: [{
      id: 'loadout',
      name: 'cordis:group',
      group: true,
      config: [
        {
          id: 'loadout-prompt',
          name: 'dsh-loadout/prompt-overlay',
          config: { prefix: expect.any(String), suffix: expect.any(String) },
        },
        {
          id: 'loadout-skills',
          name: '@deepseek-ai/dsh-skill-filesystem',
          config: {
            providerName: 'loadout',
            includeDefaultRoots: false,
            customSkillDirs: [expect.anything()],
          },
        },
      ],
    }] }])
  })
})
