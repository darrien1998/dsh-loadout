// The package contract: dsh-loadout is a DSH bundle whose patch inserts exactly
// its own materialize row, and it ships the preset with the patch.
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(here, '../../packages/dsh-loadout')

interface Manifest {
  name: string
  version: string
  type: string
  license: string
  files: string[]
  exports: Record<string, string>
  dsh: { bundle: { patch: string } }
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
  repository: { type: string; url: string; directory: string }
}

describe('dsh-loadout package', () => {
  it('is one unscoped bundle package that ships the patch, the row, and the preset', async () => {
    const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as Manifest
    expect(manifest.name).toBe('dsh-loadout')
    expect(manifest.version).toBe('0.1.0')
    expect(manifest.type).toBe('module')
    expect(manifest.license).toBe('MIT')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.exports).toEqual({
      './materialize': './materialize.mjs',
      './cordis.patch.yml': './cordis.patch.yml',
      './package.json': './package.json',
    })
    expect(manifest.files).toEqual(['cordis.patch.yml', 'materialize.mjs', 'preset', 'LICENSE', 'README.md'])
    expect(manifest.repository).toEqual({ type: 'git', url: 'git+https://github.com/darrien1998/dsh-loadout.git', directory: 'packages/dsh-loadout' })
    expect(Object.keys(manifest.peerDependencies)).toEqual(['@deepseek-ai/dsh-home-paths'])
    expect(manifest.peerDependenciesMeta['@deepseek-ai/dsh-home-paths']?.optional).toBe(true)
  })

  it('the patch inserts exactly the materialize row of this package', async () => {
    const patch = load(await readFile(join(packageDir, 'cordis.patch.yml'), 'utf8'), { schema: entryListSchema })
    expect(patch).toEqual([{ insert: [{ id: 'loadout-preset', name: 'dsh-loadout/materialize' }] }])
  })

  it('every shipped file exists', () => {
    for (const file of ['cordis.patch.yml', 'materialize.mjs', 'LICENSE', 'README.md', 'preset/loadout/agent.cordis.yml', 'preset/loadout/preset.yml']) {
      expect(existsSync(join(packageDir, file)), file).toBe(true)
    }
  })

  it('the package README is the repository README, byte for byte', async () => {
    const [packageReadme, rootReadme] = await Promise.all([
      readFile(join(packageDir, 'README.md'), 'utf8'),
      readFile(resolve(packageDir, '../../README.md'), 'utf8'),
    ])
    expect(packageReadme).toBe(rootReadme)
  })

  it('pins the peer to the exact DSH version this repository is built against', async () => {
    const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as Manifest
    const homePaths = JSON.parse(await readFile(resolve(packageDir, '../../../deepseek-harness-0.1.5/packages/util/home-paths/package.json'), 'utf8')) as { version: string }
    expect(manifest.peerDependencies['@deepseek-ai/dsh-home-paths']).toBe(homePaths.version)
  })
})
