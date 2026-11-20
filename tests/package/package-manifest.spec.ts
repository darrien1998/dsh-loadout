import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageDir = resolve('packages/dsh-loadout')
const manifest = JSON.parse(await readFile(resolve(packageDir, 'package.json'), 'utf8')) as {
  version: string; files: string[]; exports: Record<string, string>;
  dsh: { bundle: { patch: string } }; engines: Record<string, string>;
}

describe('dsh-loadout package', () => {
  it('ships the prompt overlay, patch, and notices for the supported DSH versions', () => {
    expect(manifest.version).toBe('0.3.0')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.exports).toEqual({
      './cordis.patch.yml': './cordis.patch.yml',
      './prompt-overlay': './prompt-overlay.mjs',
      './package.json': './package.json',
    })
    expect(manifest.engines.dsh).toBe('0.2.2-rc.3 || 0.2.2-rc.4')
    for (const target of Object.values(manifest.exports)) expect(existsSync(resolve(packageDir, target)), target).toBe(true)
    for (const file of manifest.files) expect(existsSync(resolve(packageDir, file)), file).toBe(true)
  })

  it('ships identical root and package documentation', async () => {
    expect(await readFile(resolve(packageDir, 'README.md'), 'utf8')).toBe(await readFile(resolve('README.md'), 'utf8'))
  })

  it('retains the Stop Slop attribution, source revision, and MIT permission notice', async () => {
    const notice = await readFile(resolve(packageDir, 'THIRD_PARTY_NOTICES.md'), 'utf8')
    for (const text of ['hardikpandya/stop-slop', '8da1f030185bdfe8471220585162991eaeb970e9', 'Copyright (c) 2025 Hardik Pandya', 'Permission is hereby granted']) expect(notice).toContain(text)
  })
})
