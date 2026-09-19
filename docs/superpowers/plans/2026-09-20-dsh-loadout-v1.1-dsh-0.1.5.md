# dsh-loadout v1.1 — DSH 0.1.5-rc.2, one package, npm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dsh plugin --profile web add dsh-loadout` works against the DSH people actually install (0.1.5-rc.2 on npm), from one published package.

**Architecture:** v1 shipped against the pinned rc.5 (`0.1.0-rc.5`) source checkout as two packages (`@loadout/dsh-preset` + `@loadout/dsh`). v1.1 (a) merges them into one unscoped package `dsh-loadout` that carries the bundle patch, the materialize row, and the preset directory; (b) re-pins every test and the smoke to a built worktree of tag `dsh-v0.1.5-rc.2` at the sibling `../deepseek-harness-0.1.5`; (c) re-copies 0.1.5's Standard composition and wires the bundled skills the way 0.1.5's own `cordis` preset does — the Standard `skill-filesystem` row gains `customSkillDirs` pointing at `skills/` beside the composition through `baseUrl`, so there is no second provider and no hard-coded preset id; (d) adapts the persona to 0.1.5's `prefix`/`suffix` persona rows; (e) publishes to npm and switches the README to the one-line install. The v1 materialize semantics (stage-then-rename create, whole-generation swap upgrade, never overwrite a user edit) are unchanged.

**Tech Stack:** DeepSeek Harness 0.1.5-rc.2 (git worktree at `C:\Users\user\deepseek-harness-0.1.5`, commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`, built; junction `C:\Users\user\Desktop\deepseek-harness-0.1.5`), Node 22, pnpm 11.7.0, vitest 4, oxlint, js-yaml, tsx. npm registry (login required for Task 5 only).

## Global Constraints

- Repository `C:\Users\user\Desktop\dsh-loadout`, branch `main`, HEAD `b74b541` at plan time. Remote `origin` = `https://github.com/darrien1998/dsh-loadout` (private). Never modify `C:\Users\user\Desktop\KeepGate`, `C:\Users\user\Desktop\deepseek-harness` (the rc.5 pin KeepGate uses), or the 0.1.5 worktree.
- The pin moves to `../deepseek-harness-0.1.5` (relative to the repo root) at commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`. In that tree: shipped presets live at `packages/preset/agent-presets/presets/{standard,ptc,minimal,cordis}/`; the built CLI is `apps/cli/lib/bin.js`; the lib/types layouts used by `tsconfig.json`/`vitest.config.ts` are unchanged from rc.5 (verified: `packages/preset/agent-presets/lib/{index.js,types/index.d.ts}`, `packages/util/home-paths/lib/...`, `vendor/{include,loader}/lib/...`).
- One package: `packages/dsh-loadout/` = `package.json` (name `dsh-loadout`, version `0.1.0`, unscoped, `"type": "module"`, `"license": "MIT"`, `dsh.bundle.patch: ./cordis.patch.yml`), `cordis.patch.yml`, `materialize.mjs`, `materialize.d.mts`, `LICENSE`, `preset/loadout/{agent.cordis.yml,preset.yml,skills/<five>/SKILL.md}`. `packages/preset` and `packages/bundle` cease to exist. The bundle row is `{ id: loadout-preset, name: 'dsh-loadout/materialize' }`.
- `agent.cordis.yml` = 0.1.5-rc.2 Standard (`packages/preset/agent-presets/presets/standard/agent.cordis.yml`, 255 lines) copied verbatim. Tolerated deltas, machine-checked: the file header comment; the `persona` row's config differing in `prefix`/`suffix` only; the `skill-filesystem` row gaining a config whose ONLY key is `customSkillDirs` with ONE `!!js` element `process.getBuiltinModule('node:url').fileURLToPath(new URL('skills/', baseUrl))`. No added rows; top-level order identical to Standard. (0.1.5 Standard has two rows rc.5 lacked, `command-goal` and `present`, and `tool-web.fetch` is now `true` — all copied as-is.)
- Persona (0.1.5 shape): `prefix` = environment line + skill routing, `suffix` = the seven standing rules. `prefix` first line exactly `Model: {{model}}. Working directory: {{cwd}}.`; `prefix.length + suffix.length <= 1,200`; variables across both exactly `{model, cwd}`; prefix names all five bundled skills and the `` `skill` tool ``; suffix contains `todo_write`; no banned tokens, no role-play tokens, no "plan mode" in either; the persona config has exactly the keys `prefix` and `suffix`.
- Skill precedence changes with the upstream idiom and is documented: `customSkillDirs` is rank 300, between project roots (100/200) and user roots (400/500), so a project skill still overrides a bundled one, but a bundled one now overrides a same-named user skill. Skills served from it report `provider: 'filesystem'`, `source: 'custom'`.
- `materialize.mjs`: unchanged semantics; marker `source` becomes `dsh-loadout`; peer `@deepseek-ai/dsh-home-paths` pinned `0.1.5-rc.2`, optional.
- Smoke: same flow on the 0.1.5 worktree, ONE tarball, boots with `--no-open` (0.1.5's flag; the web profile otherwise opens a browser tab on every boot), hermetic `DSH_HOME` + `DSH_AGENTS_HOME`, temp path without spaces.
- Gate for every task: `pnpm run typecheck`, `pnpm run lint`, `pnpm test` green; Tasks 3–5 also `pnpm run test:dsh-smoke` exit 0.
- Commit style: English, descriptive KeepGate-style subject, trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` last line. Push only in Task 5 (after publish).
- Out of scope: any change to skill texts, the materialize algorithm, or KeepGate.

---

## File Structure (after v1.1)

```
dsh-loadout/
  .gitattributes .gitignore .oxlintrc.json package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json vitest.config.ts
  LICENSE                                   MIT (copy inside the package too)
  README.md
  docs/superpowers/plans/…                  v1 plan (record) + this plan
  packages/dsh-loadout/
    package.json cordis.patch.yml materialize.mjs materialize.d.mts LICENSE
    preset/loadout/{agent.cordis.yml, preset.yml, skills/<five>/SKILL.md}
  tests/
    contract.ts
    preset/{parity.ts, preset-files.spec.ts, capability-parity.spec.ts, persona.spec.ts, materialize.spec.ts}
    skills/skill-lint.spec.ts
    package/package-manifest.spec.ts        (replaces tests/bundle/bundle-manifest.spec.ts)
    integration/dsh-smoke.ts
```

---

### Task 1: One package — `dsh-loadout`

**Files:**
- Move: `packages/preset/` → `packages/dsh-loadout/` (git mv, history preserved)
- Move: `packages/bundle/cordis.patch.yml` → `packages/dsh-loadout/cordis.patch.yml`
- Delete: `packages/bundle/package.json` (and the untracked `packages/bundle/node_modules`)
- Modify: `packages/dsh-loadout/package.json`, `packages/dsh-loadout/cordis.patch.yml`, `packages/dsh-loadout/materialize.mjs`
- Move+rewrite: `tests/bundle/bundle-manifest.spec.ts` → `tests/package/package-manifest.spec.ts`
- Modify (paths only): `tests/preset/preset-files.spec.ts`, `tests/preset/capability-parity.spec.ts`, `tests/preset/persona.spec.ts`, `tests/preset/materialize.spec.ts`, `tests/skills/skill-lint.spec.ts`, `tests/integration/dsh-smoke.ts`
- Regenerate: `pnpm-lock.yaml`

**Interfaces:**
- Produces: package name `dsh-loadout`, bundle row name `dsh-loadout/materialize`, preset dir `packages/dsh-loadout/preset/loadout/` — every later task and the README use these.
- The pin stays rc.5 in this task; the suite must be green on the old pin before the pin moves (Task 2).

- [ ] **Step 1: Write the failing manifest test `tests/package/package-manifest.spec.ts`** (delete `tests/bundle/bundle-manifest.spec.ts` in the same step)

```ts
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
  repository: { type: string; url: string }
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
    expect(manifest.files).toEqual(['cordis.patch.yml', 'materialize.mjs', 'preset', 'LICENSE'])
    expect(manifest.repository).toEqual({ type: 'git', url: 'git+https://github.com/darrien1998/dsh-loadout.git' })
    expect(Object.keys(manifest.peerDependencies)).toEqual(['@deepseek-ai/dsh-home-paths'])
    expect(manifest.peerDependenciesMeta['@deepseek-ai/dsh-home-paths']?.optional).toBe(true)
  })

  it('the patch inserts exactly the materialize row of this package', async () => {
    const patch = load(await readFile(join(packageDir, 'cordis.patch.yml'), 'utf8'), { schema: entryListSchema })
    expect(patch).toEqual([{ insert: [{ id: 'loadout-preset', name: 'dsh-loadout/materialize' }] }])
  })

  it('every shipped file exists', () => {
    for (const file of ['cordis.patch.yml', 'materialize.mjs', 'LICENSE', 'preset/loadout/agent.cordis.yml', 'preset/loadout/preset.yml']) {
      expect(existsSync(join(packageDir, file)), file).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/package`
Expected: FAIL — ENOENT on `packages/dsh-loadout/package.json`.

- [ ] **Step 3: Move the package**

Run (PowerShell, repo root):

```powershell
git mv packages/preset packages/dsh-loadout
git mv packages/bundle/cordis.patch.yml packages/dsh-loadout/cordis.patch.yml
git rm -q packages/bundle/package.json
Remove-Item -Recurse -Force packages/bundle
```

- [ ] **Step 4: Write `packages/dsh-loadout/package.json`**

```json
{
  "name": "dsh-loadout",
  "version": "0.1.0",
  "description": "One install gives DeepSeek Harness the loadout agent preset: DSH Standard, a task-first persona, and five bundled engineering skills",
  "license": "MIT",
  "type": "module",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/darrien1998/dsh-loadout.git"
  },
  "homepage": "https://github.com/darrien1998/dsh-loadout#readme",
  "keywords": [
    "deepseek-harness",
    "dsh",
    "agent-preset",
    "skills"
  ],
  "exports": {
    "./materialize": "./materialize.mjs",
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": [
    "cordis.patch.yml",
    "materialize.mjs",
    "preset",
    "LICENSE"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "peerDependencies": {
    "@deepseek-ai/dsh-home-paths": "0.1.0-rc.5"
  },
  "peerDependenciesMeta": {
    "@deepseek-ai/dsh-home-paths": {
      "optional": true
    }
  }
}
```

- [ ] **Step 5: Write `packages/dsh-loadout/cordis.patch.yml`**

```yaml
# dsh-loadout composes ONE host-plane row: the boot-time materialization of
# the `loadout` agent preset (composition + skills) into the harness-home
# preset root. Everything the model sees is inside that preset; the host
# composition is otherwise untouched.
- insert:
    - id: loadout-preset
      name: 'dsh-loadout/materialize'
```

- [ ] **Step 6: Write `packages/dsh-loadout/LICENSE` and `LICENSE` at the repo root (identical)**

```
MIT License

Copyright (c) 2026 darrien1998

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Edit `packages/dsh-loadout/materialize.mjs`**

- Line 1 comment `// Boot-time preset materialization for the Loadout bundle.` → `// Boot-time preset materialization for the dsh-loadout package.`
- `// A plugin row on the HOST plane (inserted by the @loadout/dsh bundle patch):` → `// A plugin row on the HOST plane (inserted by the package's own bundle patch):`
- `const SOURCE_PACKAGE = '@loadout/dsh-preset'` → `const SOURCE_PACKAGE = 'dsh-loadout'`
- No other change. (`materialize.d.mts` is unchanged.)

- [ ] **Step 8: Update every test path**

In each file, replace `packages/preset/` with `packages/dsh-loadout/` (paths only):
- `tests/preset/preset-files.spec.ts` (`userRoot`)
- `tests/preset/capability-parity.spec.ts` (`loadoutPath`)
- `tests/preset/persona.spec.ts` (`loadoutPath`)
- `tests/preset/materialize.spec.ts` (`sourceDir` and the `materialize.mjs` import)
- `tests/skills/skill-lint.spec.ts` (`skillsRoot`)

In `tests/preset/materialize.spec.ts`, the marker assertion `expect(marker.source).toBe('@loadout/dsh-preset')` → `expect(marker.source).toBe('dsh-loadout')`.

In `tests/integration/dsh-smoke.ts`:
- Delete `createLocalBundleFixture` and its `BundleManifest` interface entirely (one package: nothing to rewrite).
- Replace the pack/add block (from `expectSuccess('preset pack', ...` through the `dsh web plugin add` line) with:
  ```ts
  expectSuccess('package pack', await execute(pnpm, ['--filter', 'dsh-loadout', 'pack', '--pack-destination', packDirectory], projectRoot, env))
  const packageTarball = await tarball(packDirectory, 'dsh-loadout-0.1.0')

  expectSuccess('dsh web plugin add', await execute(process.execPath, [dshBin, 'plugin', '--profile', profile, 'add', packageTarball], dshRoot, env))
  ```
- Dump assertions: `/name: '@loadout\/dsh-preset\/materialize'/` → `/name: 'dsh-loadout\/materialize'/`.
- Remove: `'remove', '@loadout/dsh', '@loadout/dsh-preset'` → `'remove', 'dsh-loadout'`.
- Final assertion `assert.doesNotMatch(afterRemove.output, /loadout/)` stays.
- The header comment's "pack preset + bundle" → "pack the package".

- [ ] **Step 9: Refresh the lockfile and run the gate**

Run: `pnpm install` — expected: the `packages/bundle` importer disappears and `packages/dsh-loadout` appears in `pnpm-lock.yaml`; `packages/dsh-loadout/node_modules` is not created (no deps).
Run: `pnpm test` (expected 66 passed: 65 − 2 bundle + 3 package), `pnpm run typecheck`, `pnpm run lint` — all exit 0.

- [ ] **Step 10: Commit**

```powershell
git add -A packages tests pnpm-lock.yaml LICENSE
git commit -m @'
refactor(package): one package, dsh-loadout, carries the patch, the row, and the preset

The @loadout scope is taken on npm and nothing here needs a second
package: the bundle patch names the materialize row of the same package
that ships the preset, so an install is one name.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 2: Re-pin to 0.1.5-rc.2 and port the composition

**Files:**
- Modify: `tsconfig.json`, `vitest.config.ts` (four paths each)
- Modify: `tests/preset/preset-files.spec.ts`, `tests/preset/capability-parity.spec.ts`, `tests/preset/persona.spec.ts`, `tests/preset/parity.ts`
- Rewrite: `packages/dsh-loadout/preset/loadout/agent.cordis.yml`
- Modify: `packages/dsh-loadout/package.json` (peer version)

**Interfaces:**
- Consumes: the built worktree at `../deepseek-harness-0.1.5`.
- Produces: the 0.1.5 composition and the parity rules the README describes.

- [ ] **Step 1: Move the pin**

`tsconfig.json`: replace every `../deepseek-harness/` with `../deepseek-harness-0.1.5/` (4 paths). `vitest.config.ts`: `new URL(`../deepseek-harness/${relative}`, ...)` → `new URL(`../deepseek-harness-0.1.5/${relative}`, ...)`.

`tests/preset/preset-files.spec.ts`:
- `const harnessRoot = resolve(repoRoot, '../deepseek-harness-0.1.5')`
- `const shippedRoot = resolve(harnessRoot, 'packages/preset/agent-presets/presets')`
- the id test: `expect(['standard', 'ptc', 'minimal', 'cordis']).not.toContain(PRESET_ID)`
- the shipped-presets test body becomes:
  ```ts
    const found = await scanRoot({ path: shippedRoot, trust: 'system' })
    const ids = found.map(preset => preset.id)
    expect(ids).toEqual(['standard', 'ptc', 'minimal', 'cordis'])
    expect(ids).not.toContain(PRESET_ID)
    expect(found.every(preset => preset.broken === undefined)).toBe(true)
  ```
  (0.1.5's `scanRoot` reads each `preset.yml` `order`; if the returned order differs from this list, sort both sides before comparing and say so in the report — the SET is the requirement.)

`tests/preset/capability-parity.spec.ts`: `const standardPath = resolve(repoRoot, '../deepseek-harness-0.1.5/packages/preset/agent-presets/presets/standard/agent.cordis.yml')`.

`packages/dsh-loadout/package.json`: `"@deepseek-ai/dsh-home-paths": "0.1.5-rc.2"`.

- [ ] **Step 2: Rewrite the parity rules — write the failing tests first**

Replace the body of `tests/preset/capability-parity.spec.ts` from `describe('Loadout capability parity ...` to the end of the file with:

```ts
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
```

Keep the file's imports and the `CAPABILITIES` map as they are (add `'goals': ['command-goal', 'tool-goal']` in place of `goals: ['tool-goal']`, and add `presentation: ['present']`).

Replace the body of `tests/preset/persona.spec.ts` from `async function persona()` to the end with:

```ts
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
```

- [ ] **Step 3: Run the preset suites to verify they fail**

Run: `pnpm test -- tests/preset`
Expected: FAIL — parity: Standard 0.1.5 has rows the rc.5 copy lacks (`command-goal`, `present` MISSING), the persona has `text` not `prefix`/`suffix`, `loadout-skills` is ADDED; persona spec: `prefix` is not a string.

- [ ] **Step 4: Rewrite `tests/preset/parity.ts`'s classification**

Replace the whole `analyzeParity` function with:

```ts
/** The one !!js expression the skill root may carry: the preset's own skills/ directory, resolved from the composition's baseUrl. */
const SKILL_ROOT_EXPRESSION = "process.getBuiltinModule('node:url').fileURLToPath(new URL('skills/', baseUrl))"

/** Rows that may differ from Standard, each with the exact delta it may carry. */
const INTENTIONAL: Readonly<Record<string, { readonly note: string; readonly allowed: (source: CompositionRow, copy: CompositionRow) => boolean }>> = {
  persona: {
    note: 'Loadout persona prefix and suffix; every other key identical',
    allowed: (source, copy) => {
      const keys = (row: CompositionRow): string[] => Object.keys((row.config ?? {}) as Record<string, unknown>).sort()
      return same(keys(source), ['prefix', 'suffix']) && same(keys(copy), ['prefix', 'suffix'])
    },
  },
  'skill-filesystem': {
    note: 'the preset-local skills root, the way the shipped cordis preset wires it',
    allowed: (source, copy) => {
      if (source.config !== undefined) return false
      const config = copy.config as { customSkillDirs?: unknown } | undefined
      if (config === undefined || !same(Object.keys(config), ['customSkillDirs'])) return false
      const dirs = config.customSkillDirs
      return Array.isArray(dirs) && dirs.length === 1 && same(dirs[0], { __jsExpr: SKILL_ROOT_EXPRESSION })
    },
  },
}

export async function analyzeParity(standardPath: string, targetPath: string): Promise<ParityReport> {
  const standard = await readComposition(standardPath)
  const target = await readComposition(targetPath)
  const standardById = standard.rows
  const targetById = target.rows
  const rows: CapabilityRow[] = []
  for (const id of [...standardById.keys()].sort()) {
    const source = standardById.get(id)
    const copy = targetById.get(id)
    if (source === undefined) continue
    if (copy === undefined) {
      rows.push({ id, classification: 'MISSING' })
      continue
    }
    const sameShape = same(omit(source, 'config'), omit(copy, 'config'))
    const sameConfig = same(source.config, copy.config)
    const intentional = INTENTIONAL[id]
    if (sameShape && sameConfig) {
      rows.push({ id, classification: 'PRESENT' })
    } else if (intentional !== undefined && sameShape && intentional.allowed(source, copy)) {
      rows.push({ id, classification: 'INTENTIONALLY DIFFERENT', note: intentional.note })
    } else {
      rows.push({ id, classification: 'MISSING', note: 'same id but a different shape or config - capability drift' })
    }
  }
  for (const id of [...targetById.keys()].sort()) {
    if (!standardById.has(id)) rows.push({ id, classification: 'ADDED' })
  }
  return {
    full: rows.every(row => row.classification !== 'MISSING'),
    standardIds: [...standardById.keys()].sort(),
    targetIds: [...targetById.keys()].sort(),
    standardTopLevelIds: standard.topLevelIds,
    targetTopLevelIds: target.topLevelIds,
    rows: rows.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
  }
}
```

Update the module doc comment: "the persona is INTENTIONALLY DIFFERENT only when its shape matches and its config differs in `text` alone" → "two rows may differ: the persona (its config is exactly `prefix` and `suffix`) and `skill-filesystem` (its config is exactly the preset-local skills root); no row may be added and the top-level order is Standard's".

- [ ] **Step 5: Copy 0.1.5 Standard and apply the three edits**

Run (PowerShell):
```powershell
Copy-Item ../deepseek-harness-0.1.5/packages/preset/agent-presets/presets/standard/agent.cordis.yml packages/dsh-loadout/preset/loadout/agent.cordis.yml
```

(a) Replace the header block — from line 1 `# The \`standard\` agent preset: the full coding agent, mounted once per process.` through the line `# same realm symbol; labels join REALMS, and are not what this file needs.)` — with:

```yaml
# The `loadout` agent preset: the shipped Standard composition, a task-first
# persona, and the bundled Loadout skills.
#
# DSH has NO patch/inheritance semantics at the preset layer, so this file is
# a deliberate full copy of the shipped `standard` composition (DSH 0.1.5) -
# the same cost upstream accepts for `ptc` and `cordis`.
# tests/preset/capability-parity.spec.ts machine-checks that every Standard
# row is present here with an identical shape and config, in Standard's
# order, and that the delta is exactly: the persona prefix/suffix, and the
# `skill-filesystem` row's preset-local skills root. Do not edit capability
# rows here without updating that contract.
#
# Everything from the first row onward is Standard verbatim (Standard's own
# in-body comments preserved), except the persona text and the skills root.
#
# This file is an AGENT-PLANE composition. The roster mounts it ONCE under a
# standing scope; every session naming it joins by scope parentage, so the
# tools and prompt sections registered here cover each joined agent while a
# session's own state stays keyed per Session/Agent inside the plugins. The
# host composition keeps everything a preset must not own: the registries
# themselves, the sandbox and approval stack, persistence, and the model route.
#
# A service row here MUST sit inside a group carrying an `isolate` realm.
# Without one it publishes into the root realm, where it is process-global -
# another preset publishing the same name collides, and a host reader would
# resolve one preset's instance for every session; `dsh-agent-presets` rejects
# that at mount. `true` means an entry-local realm: this standing mount's own
# private instance, apart from every other preset's.
```

(b) Replace the persona row — exactly:

```yaml
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    suffix: Your working directory is {{cwd}}.
    prefix: >-
      You are a coding agent powered by the {{model}} model.
```

with:

```yaml
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: |-
      Model: {{model}}. Working directory: {{cwd}}.

      Before acting, check the skill catalog; when one matches, load it with the `skill` tool and follow it.
      New feature or unclear requirement: brainstorming or grill-me. Bug or failing test: systematic-debugging.
      Writing code: test-driven-development. About to say done: verification-before-completion.
    suffix: |-
      Standing rules:
      - Inspect before uncertain mutation: read the code and tests around the change first.
      - Non-trivial work: state the plan (files, steps, how it will be verified) and get approval before editing; todo_write tracks the approved steps.
      - Smallest coherent patch. Unrelated improvements are raised, never done silently.
      - Every added condition excludes valid input: name the case it rejects, or do not add it.
      - Claim only what you ran. "Tests pass" and "the change is correct" are different sentences.
      - Conclusion first; cite code as path:line. Ask only for decisions that are the user's to make.
      - Complete output. No placeholders, no "rest unchanged".
```

(c) Replace the skill-filesystem row — exactly:

```yaml
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
```

with:

```yaml
# The bundled Loadout skills travel with this preset rather than living in the
# user's skill root: `baseUrl` is the composition's own directory, so the root
# resolves wherever the preset is installed - the same wiring the shipped
# `cordis` preset uses for its own skills. A custom root ranks between the
# project roots and the user roots: a project skill still overrides a bundled
# one, and a bundled one overrides a same-named user skill.
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    customSkillDirs:
      - !!js "process.getBuiltinModule('node:url').fileURLToPath(new URL('skills/', baseUrl))"
```

Nothing else changes; verify with `git diff --no-index ../deepseek-harness-0.1.5/packages/preset/agent-presets/presets/standard/agent.cordis.yml packages/dsh-loadout/preset/loadout/agent.cordis.yml --stat` (expect exactly three hunks) and paste the stat in the report.

- [ ] **Step 6: Run the gate**

Run: `pnpm test -- tests/preset` — expected PASS (preset-files 4, parity 7 + 5 mutation, persona 6, materialize 11). Then `pnpm test` (all), `pnpm run typecheck`, `pnpm run lint` — exit 0.

- [ ] **Step 7: Commit**

```powershell
git add tsconfig.json vitest.config.ts tests packages/dsh-loadout
git commit -m @'
feat(preset): the composition is DSH 0.1.5-rc.2 Standard, skills wired the way upstream wires them

0.1.5 ships presets with their own skills through a customSkillDirs root
resolved from the composition's baseUrl; loadout adopts that instead of a
second provider keyed on its own id. The persona takes 0.1.5's
prefix/suffix shape: environment and routing first, the standing rules
after first-party guidance. The parity guard now tolerates exactly those
two deltas and nothing else.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 3: The smoke on 0.1.5

**Files:**
- Modify: `tests/integration/dsh-smoke.ts`

- [ ] **Step 1: Edit the script**

- Header comment: "(default: the sibling ../deepseek-harness)" → "(default: the sibling ../deepseek-harness-0.1.5)"; add a line "Boots with --no-open so no browser tab opens."
- `const dshRoot = process.env.DSH_SOURCE_DIR ?? resolve(projectRoot, '../deepseek-harness-0.1.5')`
- Both boots: `[dshBin, '--profile', profile, '--port', '0']` → `[dshBin, '--profile', profile, '--port', '0', '--no-open']`.
- In `prepareVerifyDriver`, replace the lines from `"  const loaded = await ctx.skills.get('systematic-debugging', { scope, cwd })"` through the leak check with:
  ```ts
    "  const loaded = await ctx.skills.get('systematic-debugging', { scope, cwd })",
    "  if (loaded === undefined) throw new Error('systematic-debugging did not load')",
    "  if (loaded.provider !== 'filesystem') throw new Error('skill served by provider ' + loaded.provider + ', expected filesystem')",
    "  if (loaded.source !== 'custom') throw new Error('skill source ' + loaded.source + ', expected custom (the preset-local root)')",
    "  const presetDir = " + JSON.stringify(join(dshHome, '.agent-presets', 'loadout')) + "",
    "  if (typeof loaded.path !== 'string' || !loaded.path.startsWith(presetDir)) throw new Error('skill loaded from ' + loaded.path + ', expected under ' + presetDir)",
    "  if (!loaded.content.includes('Phase 1')) throw new Error('loaded body is not the shipped skill')",
    '  // Isolation: with hermetic homes, the global layer (no scope) must not resolve any bundled skill at all.',
    '  for (const bundled of ' + JSON.stringify(SKILLS) + ') {',
    "    if (await ctx.skills.get(bundled, { cwd }) !== undefined) throw new Error('bundled skill reachable from the global layer: ' + bundled)",
    '  }',
  ```
  (`prepareVerifyDriver` needs `dshHome` — pass it as a second parameter: `prepareVerifyDriver(profileDirectory, dshHome)`; `join` is already imported.)
- The final `process.stdout.write('Loadout DSH smoke passed: ...` line: replace "five bundled skills in the preset scope with no global leak" with "five bundled skills served from the preset's own root and unreachable from the global layer".

- [ ] **Step 2: Run typecheck, lint, then the smoke**

Run: `pnpm run typecheck`, `pnpm run lint` — exit 0.
Run (PowerShell): `$env:DSH_SOURCE_DIR = (Resolve-Path ..\deepseek-harness-0.1.5).Path; pnpm run test:dsh-smoke` (10-minute timeout).
Expected: exit 0, final `Loadout DSH smoke passed: ...` line, and NO browser tab opened. If `dsh plugin add` fails to resolve `@deepseek-ai/dsh-home-paths` from the installed package (`materialize.mjs` imports it; it is an optional peer), report BLOCKED with the exact error — the fallback is to inline `resolveDshHome` (DSH_HOME env, else `~/.dsh`, `~` expanded) into `materialize.mjs` and drop the peer; do not apply it without the controller's go-ahead.

- [ ] **Step 3: Commit**

```powershell
git add tests/integration/dsh-smoke.ts
git commit -m @'
test(integration): the smoke installs one package on DSH 0.1.5-rc.2 and opens no browser

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 4: README and the plan record

**Files:**
- Rewrite: `README.md`
- Modify: `docs/superpowers/plans/2026-09-18-dsh-loadout-v1.md` (append one line under Post-v1 follow-ups: "Superseded by 2026-09-20-dsh-loadout-v1.1-dsh-0.1.5.md: pin moved to 0.1.5-rc.2, one package, skills via customSkillDirs.")

- [ ] **Step 1: Write `README.md`**

````markdown
# dsh-loadout

One install gives a DeepSeek Harness (DSH) deployment the `loadout` agent
preset: the shipped Standard coding composition, a task-first persona, and
five bundled engineering skills.

```powershell
dsh plugin --profile web add dsh-loadout
dsh --profile web
```

The first boot materializes the preset into `<dshHome>/.agent-presets/loadout/`
and it appears in the preset picker as **Loadout**. Built and tested against
DSH 0.1.5-rc.2.

## What ships

**Composition** — DSH's own Standard preset copied verbatim; the only
differences, machine-checked by `tests/preset/capability-parity.spec.ts`, are
the persona text and the `skill-filesystem` row's preset-local skills root
(the same wiring DSH's `cordis` preset uses for its own skills). No row is
added, no row is reordered, presentation stays native.

**Persona** — under 1,200 characters, no identity claim, no competence
adjectives: persona prompting does not improve objective-task accuracy and can
degrade reasoning, so the standing text carries instruction only. The prefix
(read first) states the environment — `Model: {{model}}. Working directory:
{{cwd}}.` — and routes to the skills; the suffix (rendered after DSH's own tool
guidance) carries seven standing rules.

**Skills** — loaded on demand through the `skill` tool; the model sees only
name + description until it loads one:

| skill | trigger |
|---|---|
| `brainstorming` | before creative work: turn a request into an approved design, one question at a time |
| `grill-me` | the user proposes a plan and wants it examined: decision tree, one question per message, each with a recommendation |
| `systematic-debugging` | any bug or failing test: root cause first, one hypothesis at a time, failing test before the fix |
| `test-driven-development` | any feature or fix: red, verify red, green, verify green, refactor |
| `verification-before-completion` | before any "done": run the proving command, read it, claim only what it shows |

Every skill body is under 3,000 characters, carries at most one example, and
names no tool DSH does not have; `tests/skills/skill-lint.spec.ts` enforces it.
A project skill (`.dsh/skills`, `.agents/skills`) with the same name overrides
a bundled one; a bundled one overrides a same-named skill in your user roots.

## Editing and upgrading

The materialized directory is yours: edit it freely. An edited directory is
never overwritten by a later version (the boot log reports `present-outdated`);
an untouched one is upgraded by swapping in the new generation whole, so a
crash mid-upgrade cannot leave a half-updated preset. The preset lands in the
profile-independent `<dshHome>/.agent-presets`, so installing on `web` makes
it available to every profile.

## Remove

Two stages, on purpose (DSH gives removed bundles no teardown hook, and
automatic deletion would destroy user edits):

```powershell
dsh plugin --profile web remove dsh-loadout
```

then delete the preset from the Web UI, or through `ctx.agentPresets.remove('loadout')`.

## Development

Requires a built DSH checkout at tag `dsh-v0.1.5-rc.2` (commit
`fb2c4b9e698e30edb738bca4cf0618587db7d203`) as the sibling directory
`../deepseek-harness-0.1.5`.

```powershell
pnpm install
pnpm run typecheck
pnpm run lint
pnpm test
$env:DSH_SOURCE_DIR = (Resolve-Path ..\deepseek-harness-0.1.5).Path
pnpm run test:dsh-smoke
```

`test:dsh-smoke` packs the package, installs it into a temporary DSH home on
the real web profile, boots it without opening a browser, reads the bundled
skills through the skill registry in the preset's scope, and removes
everything afterward.

To install from a checkout instead of npm:

```powershell
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
pnpm --filter dsh-loadout pack --pack-destination dist
dsh plugin --profile web add (Get-ChildItem dist\dsh-loadout-*.tgz).FullName
```

Known limitation (upstream): on Windows, `dsh plugin add` spawns pnpm through
the shell without quoting, so a `DSH_HOME` or temp path containing a space
breaks the install step inside DSH itself. Use paths without spaces.
````

- [ ] **Step 2: Gate and commit**

Run: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` — exit 0.

```powershell
git add README.md docs/superpowers/plans/2026-09-18-dsh-loadout-v1.md
git commit -m @'
docs: one-line install, the 0.1.5 pin, and what changed in skill precedence

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 5: Publish, verify from the registry, tag, push

Precondition: `npm whoami` prints a username (the user logs in with `npm login`; the registry returned 503 on 2026-09-19 — retry). Do NOT proceed past Step 1 without it.

- [ ] **Step 1: Confirm login and the free name**

Run: `npm whoami` (a username), `npm view dsh-loadout version` (expected: E404 — the name is free).

- [ ] **Step 2: Dry-run the tarball contents**

Run: `pnpm --filter dsh-loadout pack --pack-destination dist` then list the tarball: `tar -tzf dist/dsh-loadout-0.1.0.tgz`
Expected entries: `package/package.json`, `package/README.md`, `package/cordis.patch.yml`, `package/materialize.mjs`, `package/LICENSE`, `package/preset/loadout/agent.cordis.yml`, `package/preset/loadout/preset.yml`, five `package/preset/loadout/skills/<name>/SKILL.md` — nothing else (no `.d.mts`, no tests).

- [ ] **Step 3: Publish**

Run: `pnpm --filter dsh-loadout publish --access public --no-git-checks`
Expected: `+ dsh-loadout@0.1.0`. Then `npm view dsh-loadout version` → `0.1.0`.

- [ ] **Step 4: Install from the registry, for real**

In PowerShell, with a fresh temp home without spaces:
```powershell
$env:DSH_HOME = "C:\Users\user\AppData\Local\Temp\loadout-npm-check"
$env:DSH_AGENTS_HOME = "$env:DSH_HOME\agents"
node ..\deepseek-harness-0.1.5\apps\cli\lib\bin.js plugin --profile web add dsh-loadout
node ..\deepseek-harness-0.1.5\apps\cli\lib\bin.js --profile web --dump-config | Select-String "loadout"
```
Expected: the dump shows `id: loadout-preset` and `name: 'dsh-loadout/materialize'`. Then boot once with `--port 0 --no-open` in the background for ~20 s, confirm `$env:DSH_HOME\.agent-presets\loadout\agent.cordis.yml` exists, stop it, and `Remove-Item -Recurse -Force $env:DSH_HOME`. Record the observations in the report.

- [ ] **Step 5: Tag and push**

```powershell
git tag -a v0.1.0 -m "dsh-loadout 0.1.0: DSH 0.1.5-rc.2, one package, five skills"
git push origin main --follow-tags
```

---

## Self-review

**Spec coverage.** One package (Task 1). Pin to 0.1.5 + Standard verbatim + persona prefix/suffix + skills via `customSkillDirs` + parity rules (Task 2). Smoke on 0.1.5 without a browser (Task 3). README one-line install, precedence note, dev pin (Task 4). Publish, verify from registry, tag, push (Task 5). Global constraints all have a task.

**Placeholder scan.** Every file has content or an exact edit; every run step has an expected outcome; the two known risks (peer resolution in the profile; `scanRoot` order) have explicit fallbacks that require the controller's go-ahead rather than silent workarounds.

**Type consistency.** `analyzeParity`'s report shape is unchanged (`standardTopLevelIds`/`targetTopLevelIds` from v1); `loadComposition` unchanged; `SKILLS` in the smoke and `BUNDLED_SKILLS` in `tests/contract.ts` carry the same five names; `presetSourceDir()` still resolves `preset/loadout` beside `materialize.mjs` after the move.

---

## Amendments during execution (2026-09-20)

- Task 3: `pnpm --filter dsh-loadout` matched the private workspace root too (same name) — the smoke filters by path; Task 4 renamed the root to `dsh-loadout-workspace`. 0.1.5's dump-config prints the row name unquoted; the smoke's regex follows.
- Task 2: 0.1.5's `scanRoot(root, harnessBase)` requires a base; the tests pass the worktree's `apps/cli/`, which resolves the same packages the profile mirror does and is stricter where they differ.
- Final review fix wave: the package ships its own `README.md` (byte-identical to the root README, test-enforced); `COMPOSITION_VERSION` bumped to 2 (generation 1 = the rc.5 composition, never published); the peer pin is checked against the pinned checkout's `home-paths` version; `repository.directory` declared; README wording (prefix placement, `present` row, live skill edits, the narrowed upstream limitation).
- Task 6 (added after the final review): the persona suffix grows from seven to nine standing rules — the model-neutral subset of Anthropic's Claude Fable 5.1 prompting guidance (act when information suffices; a described problem wants an assessment; validate at boundaries; surgical edits; faithful failure/skip reporting; shorten by selection; never end a turn on a promise). `PERSONA_MAX_CHARACTERS` 1,200 → 1,800 (the nine rules total 1,666 characters; the first estimate of 1,500 was a miscount). Unattended-only and DSH-specific guidance (sub-agents, memory files, "the user is not watching") deliberately left out.
- Task 5 (publish, tag, push) deferred to the next session (npm registry returned 503 on the login attempt).

