// The bundle contract: a DSH bundle patch that inserts exactly the materialize
// row, depending on the preset package by workspace protocol.
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const bundleDir = resolve(here, '../../packages/bundle')

interface BundleManifest {
  name: string
  version: string
  type: string
  dependencies: Record<string, string>
  dsh: { bundle: { patch: string } }
  files: string[]
}

describe('@loadout/dsh bundle', () => {
  it('declares the bundle patch and depends on the preset package by workspace protocol', async () => {
    const manifest = JSON.parse(await readFile(resolve(bundleDir, 'package.json'), 'utf8')) as BundleManifest
    expect(manifest.name).toBe('@loadout/dsh')
    expect(manifest.version).toBe('0.1.0')
    expect(manifest.type).toBe('module')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dependencies).toEqual({ '@loadout/dsh-preset': 'workspace:^' })
    expect(manifest.files).toContain('cordis.patch.yml')
  })

  it('the patch inserts exactly the materialize row', async () => {
    const patch = load(await readFile(resolve(bundleDir, 'cordis.patch.yml'), 'utf8'), { schema: entryListSchema })
    expect(patch).toEqual([
      { insert: [{ id: 'loadout-preset', name: '@loadout/dsh-preset/materialize' }] },
    ])
  })
})
