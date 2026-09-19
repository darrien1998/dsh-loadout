# dsh-loadout v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `dsh plugin add` installs the `loadout` agent preset into DeepSeek Harness: the shipped Standard composition, a task-first persona, and five bundled engineering skills.

**Architecture:** Two npm packages. `@loadout/dsh-preset` carries the preset directory (`agent.cordis.yml`, `preset.yml`, `skills/*/SKILL.md`) plus a boot-time `materialize.mjs` row that copies the directory into `<dshHome>/.agent-presets/loadout` and never overwrites a user edit. `@loadout/dsh` is the DSH bundle whose `cordis.patch.yml` inserts that row into the host composition. Skills reach the model through a second, isolated `@deepseek-ai/dsh-skill-filesystem` row inside the preset, so they live in the preset's own layer and no other preset sees them. No TypeScript packages, no build step, no runtime code beyond the one materialize module.

**Tech Stack:** DeepSeek Harness 0.1.0-rc.5 (pinned sibling checkout at `../deepseek-harness`, commit `47f943859bef60e4160492346772ded9b24f765a`, already built: `apps/cli/lib/bin.js` exists), Node 22, pnpm 11.7.0, vitest 4, oxlint, js-yaml, tsx.

## Global Constraints

- Repository: `C:\Users\user\Desktop\dsh-loadout`, branch `main`. The pinned DSH checkout is the sibling `../deepseek-harness` (a symlink to `C:\Users\user\deepseek-harness`); every DSH import in tests resolves against it, never against npm.
- Preset id `loadout` (must match `/^[a-z0-9][a-z0-9-]*$/` and not be `standard`, `code`, `minimal`, `cordis`). Display name `Loadout`.
- Package names: `@loadout/dsh` (bundle), `@loadout/dsh-preset` (preset + materialize). Both `0.1.0`, `"type": "module"`, `"license": "MIT"`.
- `agent.cordis.yml` is the pinned Standard composition copied verbatim. The only tolerated deltas, machine-checked: the `persona` row's `text`, and one ADDED row `loadout-skills`. No `tool-presentation` row (Standard has none; presentation stays native).
- Persona: first line exactly `Model: {{model}}. Working directory: {{cwd}}.`; total length <= 1,200 characters; references only the prompt variables `model` and `cwd`; names all five bundled skills; contains none of the banned tokens below and none of `You are`, `senior`, `expert`, `world-class`.
- Skills: exactly five directories under `packages/preset/preset/loadout/skills/`: `brainstorming`, `grill-me`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`. Each `SKILL.md`: YAML frontmatter with `name` (equal to the directory) and `description` (starts with `Use `, <= 300 characters, carries the trigger); body <= 3,000 characters; at most one fenced code block; English; cross-references only to the five names; no banned tokens.
- Banned tokens (regex, applied to persona and skill text): `superpowers:`, `\bClaude\b`, `\bTodoWrite\b`, `\bAskUserQuestion\b`, `\bTask tool\b` (case-insensitive), `\bSkill tool\b`, `\bEnterPlanMode\b`, `\bExitPlanMode\b`, `your human partner` (case-insensitive), `docs/superpowers`.
- DSH model-facing tool names the prose may use: `read`, `write`, `edit`, `glob`, `grep`, `bash`, `pwsh`, `todo_write`, `ask_user_question`, `skill`, `exit_plan_mode`. Plan mode is entered by the user (`/plan` command), never by the model; prose must not tell the model to "enter plan mode".
- Materialization: `<dshHome>/.agent-presets/loadout/`, marker `.loadout-materialized.json`, `COMPOSITION_VERSION = 1`, preset and skills are ONE generation unit; a user edit anywhere in the directory freezes upgrades (`present-outdated`, never overwritten).
- Commit messages in English, professional, with a descriptive subject in the KeepGate style (`type(scope): what the change establishes`, a statement rather than a command); every commit ends with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Out of scope for v1: KeepGate runtime/governance/journal, design skills, planning/subagent skills, a session-start bootstrap plugin, npm publishing, and any per-model behaviour claim. v1 is done when `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run test:dsh-smoke` all pass.

---

## File Structure

```
dsh-loadout/
  package.json                      workspace root: scripts + dev deps only
  pnpm-workspace.yaml               packages/*, autoInstallPeers: false
  tsconfig.json                     typecheck tests + .d.mts against the pinned checkout types
  vitest.config.ts                  alias every @deepseek-ai import to the pinned checkout
  .oxlintrc.json                    lint config
  .gitignore
  README.md                         install / remove / what ships / observed-models table
  docs/superpowers/plans/2026-09-18-dsh-loadout-v1.md   this plan
  packages/preset/
    package.json                    @loadout/dsh-preset
    materialize.mjs                 boot-time materialization row (host plane)
    materialize.d.mts               types for the tests
    preset/loadout/
      preset.yml                    display name / description / order
      agent.cordis.yml              Standard verbatim + persona + loadout-skills row
      skills/<five>/SKILL.md
  packages/bundle/
    package.json                    @loadout/dsh, dsh.bundle.patch
    cordis.patch.yml                inserts the materialize row
  tests/
    contract.ts                     shared constants: bundled skill names, banned tokens, budgets
    preset/parity.ts                composition analyzer (helper, not a test)
    preset/preset-files.spec.ts     id, display name, discovery, shipped presets untouched
    preset/capability-parity.spec.ts  every Standard row present; exact delta
    preset/persona.spec.ts          persona budget, variables, vocabulary, skill names
    preset/materialize.spec.ts      create / present / present-outdated / claimed / upgraded
    skills/skill-lint.spec.ts       per-skill frontmatter, budgets, vocabulary, references
    bundle/bundle-manifest.spec.ts  manifest + patch contract
    integration/dsh-smoke.ts        real install on the pinned checkout (script, not vitest)
```

---

### Task 1: Workspace scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.oxlintrc.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run test:dsh-smoke` scripts; vitest aliases `@deepseek-ai/dsh-agent-presets`, `@deepseek-ai/dsh-home-paths`, `@deepseek-ai/cordis-plugin-loader`, `@deepseek-ai/cordis-plugin-include` that every later test imports.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "dsh-loadout",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.7.0",
  "engines": {
    "node": "^22.19.0 || >=24.0.0"
  },
  "scripts": {
    "typecheck": "tsc --noEmit --project tsconfig.json",
    "lint": "oxlint .",
    "test": "vitest run",
    "test:dsh-smoke": "tsx tests/integration/dsh-smoke.ts"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.20.0",
    "js-yaml": "^4.1.1",
    "oxlint": "1.76.0",
    "tsx": "^4.22.4",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - packages/*

# rc.5 DSH packages are host-provided peers pinned by the harness checkout.
# Never let pnpm replace that pin during installation.
autoInstallPeers: false

# vitest depends on esbuild, whose postinstall build pnpm 10+ refuses to run
# unless allowed here; without this `pnpm test` fails with ERR_PNPM_IGNORED_BUILDS.
allowBuilds:
  esbuild: true
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "baseUrl": ".",
    "ignoreDeprecations": "6.0",
    "types": ["node"],
    "paths": {
      "@deepseek-ai/dsh-agent-presets": ["../deepseek-harness/packages/preset/agent-presets/lib/types/index.d.ts"],
      "@deepseek-ai/dsh-home-paths": ["../deepseek-harness/packages/util/home-paths/lib/types/index.d.ts"],
      "@deepseek-ai/cordis-plugin-loader": ["../deepseek-harness/vendor/loader/lib/types/index.d.ts"],
      "@deepseek-ai/cordis-plugin-include": ["../deepseek-harness/vendor/include/lib/types/index.d.ts"]
    }
  },
  "include": ["tests/**/*.ts", "packages/*/*.d.mts"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dsh = (relative: string): string => fileURLToPath(new URL(`../deepseek-harness/${relative}`, import.meta.url))

// Every DSH import resolves against the pinned sibling checkout, never an
// npm canary: the analyzer parses compositions with the loader's own YAML
// dialect, discovery uses the roster's own scanner, and the materialize row
// reads the harness home the launcher itself uses.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@deepseek-ai/dsh-agent-presets': dsh('packages/preset/agent-presets/lib/index.js'),
      '@deepseek-ai/dsh-home-paths': dsh('packages/util/home-paths/lib/index.js'),
      '@deepseek-ai/cordis-plugin-loader': dsh('vendor/loader/lib/index.js'),
      '@deepseek-ai/cordis-plugin-include': dsh('vendor/include/lib/index.js'),
    },
  },
})
```

- [ ] **Step 5: Write `.oxlintrc.json` and `.gitignore`**

`.oxlintrc.json`:

```json
{
  "env": {
    "builtin": true,
    "node": true
  },
  "rules": {
    "no-unused-vars": "error"
  }
}
```

`.gitignore`:

```
node_modules/
.pnpm-store/
dist/
```

- [ ] **Step 6: Install and lint**

Run (PowerShell, in `C:\Users\user\Desktop\dsh-loadout`): `pnpm install`
Expected: exit 0, `node_modules/` created, `pnpm-lock.yaml` written.

Run: `pnpm run lint`
Expected: exit 0 (no files yet is fine).

- [ ] **Step 7: Commit**

```powershell
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json vitest.config.ts .oxlintrc.json .gitignore docs/superpowers/plans/2026-09-18-dsh-loadout-v1.md
git commit -m @'
chore: scaffold the dsh-loadout workspace

Root scripts and dev dependencies only. Every DSH import resolves against
the pinned sibling checkout through tsconfig paths and vitest aliases.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 2: Preset identity and the Standard-parity composition

**Files:**
- Create: `packages/preset/package.json`
- Create: `packages/preset/preset/loadout/preset.yml`
- Create: `packages/preset/preset/loadout/agent.cordis.yml`
- Create: `tests/preset/parity.ts`
- Test: `tests/preset/preset-files.spec.ts`
- Test: `tests/preset/capability-parity.spec.ts`

**Interfaces:**
- Produces: `loadComposition(path): Promise<CompositionRow[]>` and `analyzeParity(standardPath, targetPath): Promise<ParityReport>` in `tests/preset/parity.ts` (used by Task 3); the preset directory `packages/preset/preset/loadout/` (used by Tasks 4, 5, 7).
- The persona in this task is STILL the Standard persona. Task 3 replaces it under its own test.

- [ ] **Step 1: Write the analyzer helper `tests/preset/parity.ts`**

```ts
// Capability-parity analyzer.
//
// rc.5 has no preset-level patch semantics, so the loadout composition is a
// deliberate full copy of the shipped Standard composition (the same cost
// upstream accepts for code and cordis). This module makes the copy
// auditable instead of a hidden fork: it parses both files with the loader's
// own YAML dialect (entryListSchema, the one carrying !!js) and classifies
// every row PRESENT / INTENTIONALLY DIFFERENT / ADDED / MISSING. The parity
// tests fail the moment upstream Standard gains a row this copy lacks.
import { readFile } from 'node:fs/promises'
import { load } from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

export interface CompositionRow {
  readonly id: string
  readonly name?: string
  readonly disabled?: unknown
  readonly config?: unknown
  readonly group?: boolean
  readonly isolate?: Record<string, boolean>
}

export type CapabilityClassification = 'PRESENT' | 'INTENTIONALLY DIFFERENT' | 'ADDED' | 'MISSING'

export interface CapabilityRow {
  readonly id: string
  readonly classification: CapabilityClassification
  readonly note?: string
}

export interface ParityReport {
  readonly full: boolean
  readonly standardIds: readonly string[]
  readonly targetIds: readonly string[]
  readonly rows: readonly CapabilityRow[]
}

function flattenRows(rows: unknown): Map<string, CompositionRow> {
  const map = new Map<string, CompositionRow>()
  if (!Array.isArray(rows)) return map
  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue
    const record = raw as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : undefined
    if (id === undefined) continue
    let entry: CompositionRow = { id }
    if (typeof record.name === 'string') entry = { ...entry, name: record.name }
    if (record.disabled !== undefined) entry = { ...entry, disabled: record.disabled }
    if (record.config !== undefined) entry = { ...entry, config: record.config }
    if (record.group === true) entry = { ...entry, group: true }
    if (typeof record.isolate === 'object' && record.isolate !== null) entry = { ...entry, isolate: record.isolate as Record<string, boolean> }
    map.set(id, entry)
    for (const [nestedId, nestedRow] of flattenRows(record.config)) map.set(nestedId, nestedRow)
  }
  return map
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, stable(record[key])]))
  }
  return value
}

export async function loadComposition(path: string): Promise<CompositionRow[]> {
  const text = await readFile(path, 'utf8')
  const rows = load(text, { schema: entryListSchema })
  return [...flattenRows(rows).values()]
}

export async function analyzeParity(standardPath: string, targetPath: string): Promise<ParityReport> {
  const standard = await loadComposition(standardPath)
  const target = await loadComposition(targetPath)
  const standardById = new Map(standard.map(row => [row.id, row]))
  const targetById = new Map(target.map(row => [row.id, row]))
  const rows: CapabilityRow[] = []
  for (const id of [...standardById.keys()].sort()) {
    const source = standardById.get(id)
    const copy = targetById.get(id)
    if (source === undefined) continue
    if (copy === undefined) {
      rows.push({ id, classification: 'MISSING' })
      continue
    }
    const sameName = source.name === copy.name
    const sameConfig = JSON.stringify(stable(source.config)) === JSON.stringify(stable(copy.config))
    const sameDisabled = JSON.stringify(stable(source.disabled)) === JSON.stringify(stable(copy.disabled))
    if (sameName && sameConfig && sameDisabled) {
      rows.push({ id, classification: 'PRESENT' })
    } else if (id === 'persona') {
      rows.push({ id, classification: 'INTENTIONALLY DIFFERENT', note: 'Loadout persona text; template variables preserved' })
    } else {
      rows.push({ id, classification: 'MISSING', note: 'same id but different name/config/disabled - capability drift' })
    }
  }
  for (const id of [...targetById.keys()].sort()) {
    if (!standardById.has(id)) rows.push({ id, classification: 'ADDED' })
  }
  return {
    full: rows.every(row => row.classification !== 'MISSING'),
    standardIds: [...standardById.keys()].sort(),
    targetIds: [...targetById.keys()].sort(),
    rows: rows.sort((left, right) => left.id.localeCompare(right.id)),
  }
}
```

- [ ] **Step 2: Write the failing tests**

`tests/preset/preset-files.spec.ts`:

```ts
// Stable preset identity, display name, discovery through the supported DSH
// mechanism, and the shipped presets left intact.
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scanRoot } from '@deepseek-ai/dsh-agent-presets'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const harnessRoot = resolve(repoRoot, '../deepseek-harness')
const PRESET_ID = 'loadout'
// The containment pattern a preset id must match (packages/preset/agent-presets/src/preset.ts).
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const userRoot = resolve(repoRoot, 'packages/preset/preset')
const shippedRoot = resolve(harnessRoot, 'apps/cli/config/agent-presets')

describe('Loadout preset identity and discovery', () => {
  it('has the stable preset id loadout, valid as a preset directory name and not a shipped id', () => {
    expect(PRESET_ID).toMatch(PRESET_ID_PATTERN)
    expect(['standard', 'code', 'minimal', 'cordis']).not.toContain(PRESET_ID)
  })

  it('declares the display name Loadout and a description', async () => {
    const metadata = await readFile(resolve(userRoot, PRESET_ID, 'preset.yml'), 'utf8')
    expect(metadata).toContain('name: Loadout')
    expect(metadata).toContain('description:')
  })

  it('is discoverable through the supported DSH user-root mechanism, healthy and trusted user', async () => {
    const found = await scanRoot({ path: userRoot, trust: 'user' })
    expect(found.map(preset => preset.id)).toEqual([PRESET_ID])
    const preset = found[0]!
    expect(preset.trust).toBe('user')
    expect(preset.name).toBe('Loadout')
    expect(preset.broken).toBeUndefined()
    expect(preset.path).toBe(resolve(userRoot, PRESET_ID, 'agent.cordis.yml'))
  })

  it('keeps the shipped presets discoverable and unchanged', async () => {
    const found = await scanRoot({ path: shippedRoot, trust: 'system' })
    expect(found.map(preset => preset.id)).toEqual(['standard', 'code', 'minimal', 'cordis'])
    expect(found.every(preset => preset.broken === undefined)).toBe(true)
  })
})
```

`tests/preset/capability-parity.spec.ts`:

```ts
// Capability parity between the loadout composition and the pinned Standard
// composition: every Standard row present with identical name/config/disabled,
// the added skills row exactly as designed. (Task 3 adds the persona delta.)
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzeParity, loadComposition } from './parity.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const standardPath = resolve(repoRoot, '../deepseek-harness/apps/cli/config/agent-presets/standard/agent.cordis.yml')
const loadoutPath = resolve(repoRoot, 'packages/preset/preset/loadout/agent.cordis.yml')

// Capability groups mapped to the rows that carry them.
const CAPABILITIES: Readonly<Record<string, readonly string[]>> = {
  'filesystem/read': ['tool-fs'],
  'filesystem mutation': ['tool-fs'],
  search: ['tool-fs-search'],
  shell: ['tool-bash', 'tool-pwsh'],
  skills: ['skill-filesystem', 'tool-skill'],
  goals: ['tool-goal'],
  planning: ['plan-mode'],
  'background jobs': ['tool-jobs'],
  compaction: ['compaction-basic', 'command-compact', 'tool-result-pruner'],
  subagents: ['tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent', 'tool-subagent-fork'],
  workflow: ['workflow-worker-thread', 'tool-workflow', 'tool-ralph'],
}

describe('Loadout capability parity with the pinned Standard composition', () => {
  it('keeps every Standard row PRESENT with identical composition', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.full).toBe(true)
    for (const row of report.rows) {
      expect(row.classification, row.id).not.toBe('MISSING')
    }
    expect(report.standardIds).toEqual(report.rows.filter(row => row.classification !== 'ADDED').map(row => row.id))
  })

  it('adds exactly one row: loadout-skills', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.rows.filter(row => row.classification === 'ADDED').map(row => row.id)).toEqual(['loadout-skills'])
    // Standard carries no presentation row and neither does loadout: presentation stays native.
    expect(report.targetIds).not.toContain('tool-presentation')
  })

  it('the loadout-skills row is an isolated second skill-filesystem provider over the materialized skills root', async () => {
    const row = (await loadComposition(loadoutPath)).find(candidate => candidate.id === 'loadout-skills')
    expect(row?.name).toBe('@deepseek-ai/dsh-skill-filesystem')
    const config = row?.config as Record<string, unknown>
    expect(config.providerName).toBe('loadout')
    expect(config.includeDefaultRoots).toBe(false)
    expect(config.watch).toBe(false)
    expect(JSON.stringify(config.bundledSkillDir)).toContain("dshHomePath('.agent-presets', 'loadout', 'skills')")
  })

  it('covers every capability group', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    const present = new Set(report.rows.filter(row => row.classification === 'PRESENT').map(row => row.id))
    for (const [capability, rows] of Object.entries(CAPABILITIES)) {
      for (const row of rows) {
        expect(present.has(row), capability + ' -> ' + row).toBe(true)
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
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test -- tests/preset`
Expected: FAIL — `preset-files.spec.ts` with ENOENT on `packages/preset/preset/loadout/preset.yml`; `capability-parity.spec.ts` with ENOENT on `agent.cordis.yml`.

- [ ] **Step 4: Write `packages/preset/package.json`**

```json
{
  "name": "@loadout/dsh-preset",
  "version": "0.1.0",
  "description": "The Loadout agent preset for DeepSeek Harness (DSH Standard + task-first persona + bundled engineering skills) and its boot-time materialization row",
  "license": "MIT",
  "type": "module",
  "exports": {
    "./materialize": "./materialize.mjs",
    "./package.json": "./package.json"
  },
  "files": [
    "materialize.mjs",
    "preset"
  ],
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

- [ ] **Step 5: Write `packages/preset/preset/loadout/preset.yml`**

```yaml
name: Loadout
description: 'DSH Standard with a task-first persona and five bundled engineering skills: brainstorming, systematic-debugging, test-driven-development, verification-before-completion, grill-me.'
order: 5
```

- [ ] **Step 6: Copy the pinned Standard composition verbatim**

Run (PowerShell):

```powershell
New-Item -ItemType Directory -Force packages/preset/preset/loadout | Out-Null
Copy-Item ../deepseek-harness/apps/cli/config/agent-presets/standard/agent.cordis.yml packages/preset/preset/loadout/agent.cordis.yml
```

- [ ] **Step 7: Replace the file header comment (lines 1-18 of the copy)**

Replace the block that begins `# The \`standard\` agent preset: the full coding agent, mounted once per process.` and ends `# same realm symbol; labels join REALMS, and are not what this file needs.)` with:

```yaml
# The `loadout` agent preset: the shipped Standard composition, a task-first
# persona, and the bundled Loadout skills.
#
# rc.5 has NO patch/inheritance semantics at the preset layer, so this file
# is a deliberate full copy of the shipped `standard` composition - the same
# cost upstream accepts for `code` and `cordis`. tests/preset/capability-
# parity.spec.ts machine-checks that every Standard row is present here with
# identical name/config/disabled, and that the delta is exactly: the persona
# text, plus the `loadout-skills` row at the end. Do not edit capability rows
# here without updating that contract.
#
# Everything from the first row onward is Standard verbatim (Standard's own
# in-body comments preserved), except the persona text and the final row.
#
# This file is an AGENT-PLANE composition. The roster mounts it ONCE under a
# standing scope; every session naming it joins by scope parentage, so the
# tools and prompt sections registered here cover each joined agent while a
# session's own state stays keyed per Session/Agent inside the plugins. The
# host composition (`base.cordis.yml` + `web.cordis.yml`) keeps everything a
# preset must not own: the registries themselves, the sandbox and approval
# stack, persistence, and the model route.
#
# A service row here MUST sit inside a group carrying an `isolate` realm.
# Without one it publishes into the root realm, where it is process-global -
# another preset publishing the same name collides, and a host reader would
# resolve one preset's instance for every session; `dsh-agent-presets` rejects
# that at mount. `true` means an entry-local realm: this standing mount's own
# private instance, apart from every other preset's.
```

Leave the `persona` row exactly as copied (Standard's `You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.`). Task 3 replaces it.

- [ ] **Step 8: Append the `loadout-skills` row at the end of the file**

Append after the final `tool-web` row (the file currently ends with `    searchTimeoutMs: 60000`):

```yaml

# ── loadout ─────────────────────────────────────────────────────────────────

# The bundled Loadout skills. A second skill-filesystem provider, isolated to
# its explicit root (`includeDefaultRoots: false`), so the project and user
# skill roots are scanned once, by the Standard `skill-filesystem` row above,
# and this row only adds the skills that ship with the preset. The root is the
# `skills/` directory materialized next to this file under the harness home;
# `dshHomePath` is the resolver app-boot provides to `!!js` config expressions.
# Registered from the preset's standing composition, the skills live in THIS
# preset's layer and no other preset sees them. Provider names are unique per
# layer, so `loadout` sits beside Standard's default `filesystem` provider.
- id: loadout-skills
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    providerName: loadout
    includeDefaultRoots: false
    watch: false
    bundledSkillDir: !!js dshHomePath('.agent-presets', 'loadout', 'skills')
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm test -- tests/preset`
Expected: PASS — 4 tests in `preset-files.spec.ts`, 5 tests in `capability-parity.spec.ts`.

Run: `pnpm run typecheck` and `pnpm run lint`
Expected: both exit 0.

- [ ] **Step 10: Commit**

```powershell
git add packages/preset tests/preset
git commit -m @'
feat(preset): the loadout composition is Standard verbatim plus one skills row

A deliberate full copy of the pinned Standard preset (rc.5 has no preset
inheritance), audited by a parity analyzer that classifies every row. The
only addition is an isolated second skill-filesystem provider over the
skills root materialized next to the preset.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 3: The persona

**Files:**
- Create: `tests/contract.ts`
- Modify: `packages/preset/preset/loadout/agent.cordis.yml` (persona row only)
- Modify: `tests/preset/capability-parity.spec.ts` (add the persona delta assertion)
- Test: `tests/preset/persona.spec.ts`

**Interfaces:**
- Produces: `BUNDLED_SKILLS`, `BANNED_TOKENS`, `ROLE_PLAY_TOKENS`, `PERSONA_MAX_CHARACTERS`, `SKILL_DESCRIPTION_MAX_CHARACTERS`, `SKILL_BODY_MAX_CHARACTERS`, `SKILL_MAX_EXAMPLES`, `SKILL_NAME` from `tests/contract.ts` (used by Task 4).
- Consumes: `loadComposition`, `analyzeParity` from Task 2.

- [ ] **Step 1: Write `tests/contract.ts`**

```ts
// The shipped-content contract shared by the persona and skill lint suites.

/** The five skills the Loadout preset ships, in catalog order. */
export const BUNDLED_SKILLS: readonly string[] = Object.freeze([
  'brainstorming',
  'grill-me',
  'systematic-debugging',
  'test-driven-development',
  'verification-before-completion',
])

/**
 * Vocabulary from the harness these skills were ported from. A rule that
 * names an action DSH does not have is skipped by the model, not obeyed, so
 * none of these may appear in shipped prose.
 */
export const BANNED_TOKENS: readonly RegExp[] = Object.freeze([
  /superpowers:/,
  /\bClaude\b/,
  /\bTodoWrite\b/,
  /\bAskUserQuestion\b/,
  /\bTask tool\b/i,
  /\bSkill tool\b/,
  /\bEnterPlanMode\b/,
  /\bExitPlanMode\b/,
  /your human partner/i,
  /docs\/superpowers/,
])

/** Role-play the persona must not carry: an identity claim or a competence adjective. */
export const ROLE_PLAY_TOKENS: readonly RegExp[] = Object.freeze([
  /\bYou are\b/,
  /\bsenior\b/i,
  /\bexpert\b/i,
  /\bworld-class\b/i,
])

/** Standing persona text is paid on every request; keep it small. */
export const PERSONA_MAX_CHARACTERS = 1_200

/** DSH shows the model only name + description; the description carries the trigger. */
export const SKILL_DESCRIPTION_MAX_CHARACTERS = 300

/** A skill body is loaded on demand; short and dense beats long and persuasive. */
export const SKILL_BODY_MAX_CHARACTERS = 3_000

/** One example is a safety net for a weak model; two start to dilute. */
export const SKILL_MAX_EXAMPLES = 1

/** DSH skill-name grammar (packages/skill/skill/src/index.ts isSkillName). */
export const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

- [ ] **Step 2: Write the failing persona test `tests/preset/persona.spec.ts`**

```ts
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
```

- [ ] **Step 3: Add the persona delta assertion to `tests/preset/capability-parity.spec.ts`**

Add this test inside the existing `describe`, after `'adds exactly one row: loadout-skills'`:

```ts
  it('the persona is the only Standard row that differs, with the template variables intact', async () => {
    const report = await analyzeParity(standardPath, loadoutPath)
    expect(report.rows.filter(row => row.classification === 'INTENTIONALLY DIFFERENT').map(row => row.id)).toEqual(['persona'])
    const [persona] = (await loadComposition(loadoutPath)).filter(row => row.id === 'persona')
    const text = JSON.stringify(persona?.config)
    expect(text).toContain('{{model}}')
    expect(text).toContain('{{cwd}}')
  })
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm test -- tests/preset`
Expected: FAIL — `persona.spec.ts` "opens with the environment statement" (Standard's line reads `You are a coding agent...`), "names every bundled skill", "no role-play" (`You are`); `capability-parity.spec.ts` persona delta (`[]` instead of `['persona']`).

- [ ] **Step 5: Replace the persona row in `packages/preset/preset/loadout/agent.cordis.yml`**

Replace exactly:

```yaml
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: >-
      You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.
```

with:

```yaml
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: |-
      Model: {{model}}. Working directory: {{cwd}}.

      Before acting, check the skill catalog; when one matches, load it with the `skill` tool and follow it.
      New feature or unclear requirement: brainstorming or grill-me. Bug or failing test: systematic-debugging.
      Writing code: test-driven-development. About to say done: verification-before-completion.

      Standing rules:
      - Inspect before uncertain mutation: read the code and tests around the change first.
      - Non-trivial work: state the plan (files, steps, how it will be verified) and get approval before editing; todo_write tracks the approved steps.
      - Smallest coherent patch. Unrelated improvements are raised, never done silently.
      - Every added condition excludes valid input: name the case it rejects, or do not add it.
      - Claim only what you ran. "Tests pass" and "the change is correct" are different sentences.
      - Conclusion first; cite code as path:line. Ask only for decisions that are the user's to make.
      - Complete output. No placeholders, no "rest unchanged".
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test -- tests/preset`
Expected: PASS — 6 tests in `persona.spec.ts`, 6 in `capability-parity.spec.ts`, 4 in `preset-files.spec.ts`.

Run: `pnpm run typecheck` and `pnpm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```powershell
git add tests/contract.ts tests/preset packages/preset/preset/loadout/agent.cordis.yml
git commit -m @'
feat(preset): a persona that states the environment and the rules, not a role

Environment line, skill routing, seven standing rules; under 1,200
characters. No identity claim and no competence adjective: persona
prompting does not improve objective-task accuracy and can degrade
reasoning, so the standing text carries only instruction. The lint pins
the budget, the variables, the skill names, and the banned vocabulary.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 4: The five bundled skills

**Files:**
- Test: `tests/skills/skill-lint.spec.ts`
- Create: `packages/preset/preset/loadout/skills/brainstorming/SKILL.md`
- Create: `packages/preset/preset/loadout/skills/systematic-debugging/SKILL.md`
- Create: `packages/preset/preset/loadout/skills/test-driven-development/SKILL.md`
- Create: `packages/preset/preset/loadout/skills/verification-before-completion/SKILL.md`
- Create: `packages/preset/preset/loadout/skills/grill-me/SKILL.md`

**Interfaces:**
- Consumes: `tests/contract.ts` constants from Task 3.
- Produces: the `skills/` directory the materialize row (Task 5) copies and the smoke (Task 7) reads through `ctx.skills`.

The lint suite validates every skill directory that exists and, separately, that the full set is present; so each skill turns its own block green and the set assertion turns green with the fifth. Write each skill and run the suite after it; commit ONCE at the end, when the suite is fully green (never commit with the set assertion red).

- [ ] **Step 1: Write the failing lint suite `tests/skills/skill-lint.spec.ts`**

```ts
// Per-skill contract for the bundled skills: DSH frontmatter grammar, the
// catalog budget for descriptions, the on-demand budget for bodies, one
// example at most, no foreign vocabulary, references only within the set.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  BANNED_TOKENS,
  BUNDLED_SKILLS,
  SKILL_BODY_MAX_CHARACTERS,
  SKILL_DESCRIPTION_MAX_CHARACTERS,
  SKILL_MAX_EXAMPLES,
  SKILL_NAME,
} from '../contract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const skillsRoot = resolve(here, '../../packages/preset/preset/loadout/skills')

interface ParsedSkill {
  readonly name: string
  readonly description: string
  readonly body: string
}

function parseSkill(dir: string): ParsedSkill {
  const text = readFileSync(join(skillsRoot, dir, 'SKILL.md'), 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (match === null) throw new Error(dir + ': SKILL.md must open with a YAML frontmatter block')
  const frontmatter = load(match[1]!) as Record<string, unknown>
  return { name: String(frontmatter.name), description: String(frontmatter.description), body: match[2]! }
}

const present = existsSync(skillsRoot) ? readdirSync(skillsRoot).sort() : []

describe('Loadout bundled skills', () => {
  for (const dir of present) {
    describe(dir, () => {
      const skill = parseSkill(dir)

      it('has a kebab-case name equal to its directory', () => {
        expect(dir).toMatch(SKILL_NAME)
        expect(skill.name).toBe(dir)
      })

      it('has a trigger-carrying description within the catalog budget', () => {
        expect(skill.description).toMatch(/^Use /)
        expect(skill.description.length).toBeGreaterThan(40)
        expect(skill.description.length).toBeLessThanOrEqual(SKILL_DESCRIPTION_MAX_CHARACTERS)
      })

      it('keeps the body within the on-demand budget', () => {
        expect(skill.body.trim().length).toBeLessThanOrEqual(SKILL_BODY_MAX_CHARACTERS)
      })

      it('carries at most one fenced example', () => {
        const fences = (skill.body.match(/^```/gm) ?? []).length
        expect(fences % 2).toBe(0)
        expect(fences / 2).toBeLessThanOrEqual(SKILL_MAX_EXAMPLES)
      })

      it('carries no vocabulary from another harness', () => {
        for (const token of BANNED_TOKENS) {
          expect(skill.description + '\n' + skill.body, String(token)).not.toMatch(token)
        }
      })

      it('references only bundled skills', () => {
        // Every cross-reference is phrased "the <name> skill"; the article keeps
        // phrases like "every skill" out, and the name may be a single word.
        const refs = [...skill.body.matchAll(/\bthe ([a-z0-9]+(?:-[a-z0-9]+)*) skill\b/g)].map(match => match[1]!)
        for (const ref of refs) expect(BUNDLED_SKILLS, ref).toContain(ref)
      })
    })
  }

  it('ships exactly the bundled set the persona names', () => {
    expect(present).toEqual([...BUNDLED_SKILLS].sort())
  })
})
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `pnpm test -- tests/skills`
Expected: FAIL — 'ships exactly the bundled set' with `[]` received.

- [ ] **Step 3: Write `skills/brainstorming/SKILL.md`**

````markdown
---
name: brainstorming
description: Use before any creative work - a new feature, component, behavior change, or anything with more than one reasonable design. Turns a vague request into an approved design through one-question-at-a-time dialogue. No code until the user has approved a design.
---

# Brainstorming

Turn an idea into an approved design before any implementation.

HARD GATE: no code, no scaffolding, no file changes until you have presented a design and the user approved it. "Too simple to need a design" is where unexamined assumptions waste the most work; a simple request gets a short design, not no design.

## Steps

1. **Explore context first.** Read the relevant files, docs, and recent commits before asking anything. Never ask the user something the repository can answer.
2. **Check scope.** If the request spans several independent subsystems, say so and decompose it; brainstorm the first piece only.
3. **Ask one question per message.** Purpose, constraints, success criteria. Prefer multiple choice. Stop when you can state what you are building and how you will know it works.
4. **Propose 2-3 approaches** with trade-offs. Lead with your recommendation and the reason. YAGNI: strip every feature the goal does not need.
5. **Present the design in sections** scaled to complexity (a few sentences to ~250 words each): architecture, components, data flow, error handling, testing. Ask after each section whether it looks right.
6. **Self-review** before asking for approval: placeholders (TBD/TODO), contradictions between sections, requirements that can be read two ways, scope too large for one implementation pass. Fix inline.
7. **Get explicit approval.** Then implement with the test-driven-development skill. If the user wants a written spec, save it where they say and commit it.

## Design rules

- Units with one purpose, clear interfaces, testable alone. For each unit you can answer: what it does, how it is used, what it depends on.
- In existing code, follow existing patterns. Fold in a targeted improvement only where an existing problem blocks the work; no unrelated refactoring.

## Red flags

| Thought | Reality |
|---|---|
| "This is obvious, I'll just build it" | Obvious to you is an unexamined assumption to the user. Present it; approval takes one message. |
| "I'll ask three questions at once" | Three questions get one vague answer. One at a time. |
| "Let me ask where the code lives" | The repository answers that. Read it. |
````

- [ ] **Step 4: Run the suite**

Run: `pnpm test -- tests/skills`
Expected: the `brainstorming` block PASSES (6 tests); 'ships exactly the bundled set' still FAILS.

- [ ] **Step 5: Write `skills/systematic-debugging/SKILL.md`**

````markdown
---
name: systematic-debugging
description: Use for any bug, failing test, build failure, or unexpected behavior, before proposing a fix. Root cause first, one hypothesis at a time, a failing test before the fix. Use especially under time pressure, when a quick fix looks obvious, or when a previous fix did not work.
---

# Systematic Debugging

No fix without a root cause. A symptom fix is a failure.

## Phase 1 - Root cause

1. Read the whole error: message, stack, line numbers, exit code. It often names the answer.
2. Reproduce reliably. Not reproducible: gather more data, do not guess.
3. Check what changed: diff, recent commits, dependencies, config, environment.
4. Trace backward from where the bad value is observed to where it is first produced, and fix at the source. Where a defect becomes visible is downstream of where it is created.
5. Multi-component systems: log what enters and leaves each boundary, run once, and let the evidence name the failing component before you touch anything.

## Phase 2 - Pattern

Find working code in this repository that does the same thing. List every difference from the broken path, however small. Read reference implementations completely; do not skim.

## Phase 3 - Hypothesis

State one hypothesis - "X is the cause because Y" - and what would falsify it. Test it with the smallest possible change, one variable at a time. Wrong: form a new hypothesis; do not stack fixes. Unsure: say so and investigate more.

## Phase 4 - Fix

1. Write a failing test that reproduces the defect (load the test-driven-development skill). A check that was green before your change cannot show your change did anything.
2. One fix, at the root cause. No "while I'm here" edits.
3. Verify with the verification-before-completion skill: the new test passes, nothing else broke, the original symptom is gone.
4. Fix failed: back to Phase 1 with the new information. Three fixes failed: stop and question the design with the user; each fix surfacing a new problem elsewhere means the structure is wrong, not the hypothesis.

## Red flags - stop, return to Phase 1

| Thought | Reality |
|---|---|
| "Quick fix now, investigate later" | The first fix sets the pattern. |
| "Just try changing X" | A guess that works is a bug you have not found yet. |
| "Change several things, run tests" | You cannot tell which one worked. |
| "It's probably X" | Probably is a hypothesis; test it. |
| "One more attempt" (after 2+) | Three failures is a design problem. |
| "The issue is simple, skip the process" | Simple bugs have root causes too, and the process is fast for them. |

No root cause after a full investigation: document what was checked, add handling (retry, timeout, clear error) and logging. Most "no root cause" cases are incomplete investigation.
````

- [ ] **Step 6: Run the suite**

Run: `pnpm test -- tests/skills`
Expected: `brainstorming` and `systematic-debugging` blocks PASS; set assertion still FAILS.

- [ ] **Step 7: Write `skills/test-driven-development/SKILL.md`**

````markdown
---
name: test-driven-development
description: Use when implementing any feature or bug fix, before writing production code. One failing test, watched to fail for the right reason, then the minimum code to pass, then refactor while green. Also how a bug fix is proven - the reproducing test is red before the fix.
---

# Test-Driven Development

No production code without a failing test first. If you did not watch the test fail, you do not know it tests the right thing.

## Cycle

1. **RED** - one minimal test for one behavior, named for the behavior, against real code (mock only what is unavoidable).
2. **Verify red** - run it. It must fail, not error, and fail because the behavior is missing. Passes immediately: it tests existing behavior; fix the test. Errors: fix the error, rerun until it fails correctly.
3. **GREEN** - the simplest code that passes. No extra options, no refactoring of other code.
4. **Verify green** - run it. The new test passes, every other test still passes, output is clean. Fails: fix the code, not the test.
5. **REFACTOR** - only while green: remove duplication, improve names, extract helpers. No new behavior.
6. Next test.

Wrote code before the test? Delete it and start from the test. Keeping it "as reference" is testing after.

Exceptions, and only with the user's agreement: throwaway prototypes, generated code, configuration files.

## Example - bug: empty email accepted

```ts
// RED
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' })
  expect(result.error).toBe('Email required')
})
// run: FAIL - expected 'Email required', got undefined

// GREEN
function submitForm(data) {
  if (!data.email?.trim()) return { error: 'Email required' }
  // ...
}
// run: PASS
```

## Good tests

- One behavior per test; "and" in the name means split it.
- The name says the behavior, not "test1".
- Before writing a test, name the production change that would make it fail. None: the test proves nothing.
- Assert on real behavior, never on whether a mock was called.

## Red flags

| Excuse | Reality |
|---|---|
| "Too simple to test" | Simple code breaks; the test takes a minute. |
| "I'll test after" | A test written after passes immediately and proves nothing. |
| "Already tested manually" | No record, no rerun, no edge cases. |
| "Delete hours of work?" | Sunk cost; code you cannot trust is the waste. |
| "The test is hard to write" | The design is hard to use. Simplify the interface. |
| "I must mock everything" | The code is too coupled. Inject the dependency. |

Stuck on how to test: write the API you wish you had, write the assertion first, ask the user.
````

- [ ] **Step 8: Run the suite**

Run: `pnpm test -- tests/skills`
Expected: three blocks PASS; set assertion still FAILS.

- [ ] **Step 9: Write `skills/verification-before-completion/SKILL.md`**

````markdown
---
name: verification-before-completion
description: Use before claiming anything is done, fixed, passing, or ready - before committing, opening a PR, or moving to the next task. Run the command that proves the claim, read its full output, then claim exactly what the output shows.
---

# Verification Before Completion

No completion claim without fresh evidence from this turn.

## Gate

Before any status claim or expression of satisfaction:

1. IDENTIFY the command that proves the claim.
2. RUN it, fresh and complete. Not the earlier run; not a subset.
3. READ the full output: exit code, failure count, warnings.
4. COMPARE: does the output support the claim? No: report the actual state with the evidence. Yes: make the claim with the evidence.

Skipping a step is asserting, not verifying.

## What each claim needs

| Claim | Requires | Not enough |
|---|---|---|
| Tests pass | test output: 0 failures | an earlier run, "should pass" |
| Lint clean | linter: 0 errors | a partial check |
| Build passes | build: exit 0 | lint passing, logs that "look fine" |
| Bug fixed | the original symptom re-tested | code changed, assumed fixed |
| Regression test works | seen red before the fix, green after | passes once |
| Requirements met | each requirement checked against the diff | tests passing |

## Words that mean you have not verified

"should work", "probably", "seems to", "Great!", "Done!" before running anything. Confidence is not evidence. Tiredness is not an exemption. A partial check proves nothing about the rest.

## Say what you observed

"The suite passes" and "the change is correct" are different sentences; the first has a receipt. Name the paths your checks exercised: a path you did not exercise is unverified whatever the suite says. Ask what the evidence would look like if you were wrong; if it would look the same, it is not evidence yet.
````

- [ ] **Step 10: Run the suite**

Run: `pnpm test -- tests/skills`
Expected: four blocks PASS; set assertion still FAILS.

- [ ] **Step 11: Write `skills/grill-me/SKILL.md`**

````markdown
---
name: grill-me
description: Use when the user proposes a plan, feature, architecture, or multi-file change and wants it examined before building - "grill me", "does this design make sense". Decision tree, one question per message, each with a recommended answer. Not for single fully specified actions.
---

# Grill Me

Turn an unexamined plan into agreed decisions before anything is built.

## Rules

1. **Map the decision tree.** Break the plan into decision points, including branches and edge cases below the level the user described. For each one ask: what does this decision force next?
2. **Facts are not questions.** Anything the repository, config, database, or history can answer, look up yourself first. Only decisions that are the user's to make reach the user.
3. **One question per message.** Wait for the answer before the next. Several questions at once get one vague answer.
4. **Every question carries a recommendation and its reason**, grounded in what you looked up, so the user can answer "yes, that".
5. **No work before consensus.** No code, no file changes, no tasks until every branch is settled. "Stop asking, do it your way" authorizes your recommendation for every remaining branch.

## Closing

1. Summarize the agreed plan in 2-5 sentences: each decision and why. Ask the user to confirm.
2. On confirmation, continue with the normal flow: the brainstorming skill for design, the test-driven-development skill for implementation.

## Example

User: "The DRE category name in the plan-categories table needs to change."

Facts first: read the table definition, the requirement document, and the change-marker convention. Then, one at a time:

- "DRE is currently 'Dream Plan'; the document says 'Goal Plan'. I recommend the document's name, since it is the latest confirmed one. Use it?"
- (after the answer) "Only DRE this time? CP reads 'Home Plan' here but 'Car Plan' in the document, which collides with HP. Fix it together?"

## Why

A model treats the first sentence as the whole spec and fills the rest with confident guesses. A guess found before work costs one message; a guess found after costs the rework.
````

- [ ] **Step 12: Run the suite; verify the set is complete; commit the lint and all five skills**

Run: `pnpm test -- tests/skills`
Expected: PASS — five blocks of 6 tests each and 'ships exactly the bundled set the persona names'.

Run: `pnpm test`
Expected: PASS — every suite (preset + skills).

```powershell
git add tests/skills packages/preset/preset/loadout/skills
git commit -m @'
feat(skills): five bundled skills, and the lint every one of them must pass

brainstorming, systematic-debugging, test-driven-development,
verification-before-completion, grill-me: rewritten short and dense in
DSH's own tool vocabulary, each within the catalog and on-demand budgets,
referencing only each other.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 5: Boot-time materialization

**Files:**
- Create: `packages/preset/materialize.mjs`
- Create: `packages/preset/materialize.d.mts`
- Test: `tests/preset/materialize.spec.ts`

**Interfaces:**
- Produces: `materializePreset({ home, sourceDir, presetId?, now? }): MaterializeReport`, `presetSourceDir(presetId?)`, `readMaterializationMarker(dir)`, `PRESET_ID = 'loadout'`, `MARKER_FILE = '.loadout-materialized.json'`, `COMPOSITION_VERSION = 1`, and the Cordis plugin exports `name = 'loadout-preset'`, `inject = []`, `apply(ctx)` — consumed by the bundle patch (Task 6) and the smoke (Task 7).

- [ ] **Step 1: Write the failing test `tests/preset/materialize.spec.ts`**

```ts
// Boot-time preset materialization semantics: create-if-absent under the
// harness-home preset root, provenance marker, user-owned directories never
// rewritten, an untouched older generation upgraded in place.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { COMPOSITION_VERSION, MARKER_FILE, PRESET_ID, materializePreset, presetSourceDir } from '../../packages/preset/materialize.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = resolve(here, '../../packages/preset/preset/loadout')
const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

async function freshHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'loadout-preset-home-'))
  homes.push(home)
  return home
}

/** Deterministic tree hash (relative paths, sorted, marker excluded) - mirrors materialize.mjs. */
function hashTree(dir: string): string {
  const hash = createHash('sha256')
  const entries: Array<[string, Buffer]> = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const target = join(current, entry)
      if (statSync(target).isDirectory()) walk(target)
      else if (entry !== MARKER_FILE) entries.push([relative(dir, target).split('\\').join('/'), readFileSync(target)])
    }
  }
  walk(dir)
  for (const [path, content] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(path); hash.update('\u0000'); hash.update(content); hash.update('\u0000')
  }
  return hash.digest('hex')
}

interface Marker { presetId: string; version: number; sourceHash: string; materializedAt: string; source: string }

describe('Loadout preset materialization', () => {
  it('ships its own preset source directory with the skills inside it', () => {
    expect(PRESET_ID).toBe('loadout')
    expect(MARKER_FILE).toBe('.loadout-materialized.json')
    expect(COMPOSITION_VERSION).toBe(1)
    expect(existsSync(join(presetSourceDir(), 'agent.cordis.yml'))).toBe(true)
    expect(existsSync(join(presetSourceDir(), 'skills', 'grill-me', 'SKILL.md'))).toBe(true)
  })

  it('creates the preset under the harness-home preset root with a provenance marker, skills included', async () => {
    const home = await freshHome()
    const report = materializePreset({ home, sourceDir, now: () => '2026-01-01T00:00:00.000Z' })
    expect(report.action).toBe('created')
    expect(report.presetDir).toBe(join(home, '.agent-presets', PRESET_ID))
    expect(existsSync(join(report.presetDir, 'agent.cordis.yml'))).toBe(true)
    expect(existsSync(join(report.presetDir, 'preset.yml'))).toBe(true)
    expect(existsSync(join(report.presetDir, 'skills', 'systematic-debugging', 'SKILL.md'))).toBe(true)
    const marker = JSON.parse(readFileSync(report.markerPath, 'utf8')) as Marker
    expect(marker.presetId).toBe(PRESET_ID)
    expect(marker.version).toBe(COMPOSITION_VERSION)
    expect(marker.materializedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(marker.source).toBe('@loadout/dsh-preset')
    expect(marker.sourceHash).toBe(report.sourceHash)
    expect(hashTree(report.presetDir)).toBe(report.sourceHash)
  })

  it('a user edit anywhere in the directory - a skill included - is detected as present-outdated and never overwritten', async () => {
    const home = await freshHome()
    const first = materializePreset({ home, sourceDir })
    expect(first.action).toBe('created')
    const edited = join(first.presetDir, 'skills', 'grill-me', 'SKILL.md')
    await writeFile(edited, '---\nname: grill-me\ndescription: Use when edited.\n---\nmine\n')
    const second = materializePreset({ home, sourceDir })
    expect(second.action).toBe('present-outdated')
    expect(second.note).toContain('never overwritten')
    expect(await readFile(edited, 'utf8')).toContain('mine')
    const third = materializePreset({ home, sourceDir })
    expect(third.action).toBe('present-outdated')
    expect(await readFile(edited, 'utf8')).toContain('mine')
  })

  it('treats a pre-existing directory without a marker as user-owned (it cannot be a sibling boot mid-copy) and never repairs it', async () => {
    const home = await freshHome()
    const target = join(home, '.agent-presets', PRESET_ID)
    mkdirSync(target, { recursive: true })
    await writeFile(join(target, 'agent.cordis.yml'), '[]\n')
    const report = materializePreset({ home, sourceDir })
    expect(report.action).toBe('present')
    expect(await readFile(join(target, 'agent.cordis.yml'), 'utf8')).toBe('[]\n')
    expect(existsSync(join(target, MARKER_FILE))).toBe(false)
  })

  it('the concurrent-boot race settles as claimed for the loser and leaves the winner complete', async () => {
    const home = await freshHome()
    let winner: ReturnType<typeof materializePreset> | undefined
    const loser = materializePreset({
      home,
      sourceDir,
      // The other boot completes while this one has staged but not yet claimed.
      onStaged: () => { winner = materializePreset({ home, sourceDir }) },
    })
    expect(winner?.action).toBe('created')
    expect(loser.action).toBe('claimed')
    // The loser's staging directory is gone; only the winner's preset remains.
    expect(readdirSync(join(home, '.agent-presets'))).toEqual([PRESET_ID])
    expect(hashTree(loser.presetDir)).toBe(winner?.sourceHash)
    expect(existsSync(join(loser.presetDir, MARKER_FILE))).toBe(true)
    // A later boot sees a complete current-generation materialization, not a user-owned directory.
    const later = materializePreset({ home, sourceDir })
    expect(later.action).toBe('present')
    expect(later.markerVersion).toBe(COMPOSITION_VERSION)
    // The staging name can never be mistaken for a preset by DSH discovery.
    expect('.' + PRESET_ID + '-staging-abc').not.toMatch(/^[a-z0-9][a-z0-9-]*$/)
  })

  it('leaves an untouched current-generation materialization as present', async () => {
    const home = await freshHome()
    expect(materializePreset({ home, sourceDir }).action).toBe('created')
    const again = materializePreset({ home, sourceDir })
    expect(again.action).toBe('present')
    expect(again.markerVersion).toBe(COMPOSITION_VERSION)
  })

  it('upgrades an untouched OLDER generation in place and re-stamps the marker', async () => {
    const home = await freshHome()
    const first = materializePreset({ home, sourceDir })
    expect(first.action).toBe('created')
    // Rewrite the marker as an older generation with the same content hash: the
    // exact state an untouched previous install leaves behind.
    const previous = JSON.parse(readFileSync(first.markerPath, 'utf8')) as Marker
    writeFileSync(first.markerPath, JSON.stringify({ ...previous, version: COMPOSITION_VERSION - 1 }, null, 2) + '\n')
    const upgraded = materializePreset({ home, sourceDir })
    expect(upgraded.action).toBe('upgraded')
    expect(upgraded.markerVersion).toBe(COMPOSITION_VERSION - 1)
    expect(upgraded.sourceVersion).toBe(COMPOSITION_VERSION)
    const marker = JSON.parse(readFileSync(first.markerPath, 'utf8')) as Marker
    expect(marker.version).toBe(COMPOSITION_VERSION)
    expect(hashTree(first.presetDir)).toBe(marker.sourceHash)
  })

  it('never downgrades: a marker from a future generation is present', async () => {
    const home = await freshHome()
    const first = materializePreset({ home, sourceDir })
    const previous = JSON.parse(readFileSync(first.markerPath, 'utf8')) as Marker
    writeFileSync(first.markerPath, JSON.stringify({ ...previous, version: COMPOSITION_VERSION + 1 }, null, 2) + '\n')
    expect(materializePreset({ home, sourceDir }).action).toBe('present')
  })

  it('produces deterministic content hashes across homes', async () => {
    const first = materializePreset({ home: await freshHome(), sourceDir })
    const second = materializePreset({ home: await freshHome(), sourceDir })
    expect(first.sourceHash).toBe(second.sourceHash)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/preset/materialize`
Expected: FAIL — cannot resolve `../../packages/preset/materialize.mjs`.

- [ ] **Step 3: Write `packages/preset/materialize.mjs`**

```js
// Boot-time preset materialization for the Loadout bundle.
//
// A plugin row on the HOST plane (inserted by the @loadout/dsh bundle patch):
// it runs once per boot and materializes the `loadout` preset - composition,
// metadata, and the bundled skills - into DSH's public writable preset root
// (<dshHome>/.agent-presets). Discovery re-reads that root on every list(),
// so the preset is visible to the roster (and the Web picker) in the same
// boot, and the `loadout-skills` row inside the composition reads the
// `skills/` directory this copy created.
//
// Versioned upgrade. An existing directory is NEVER rewritten blindly. The
// provenance marker records which shipped generation was materialized
// (sourceHash of the source tree at that time, plus COMPOSITION_VERSION). On
// every boot:
//
//   marker absent            -> user-authored or foreign directory: 'present',
//                               never touched (DSH authoring owns it).
//   dir hash != marker hash  -> the directory diverged from what we shipped
//                               (user edits, anywhere - a skill included):
//                               'present-outdated', reported, NEVER overwritten.
//   version >= current       -> up to date: 'present'.
//   version <  current AND dir hash == marker hash -> byte-identical to the
//                               generation we materialized and never edited:
//                               safe in-place refresh: 'upgraded'.
//
// A crash before the claiming rename leaves only a dot-prefixed staging
// directory beside the presets, invisible to discovery, and no target; the
// next boot creates cleanly. Stale staging directories are not swept
// automatically.
//
// Preset and skills are one generation unit on purpose: a user who edits a
// skill keeps that edit forever, at the cost of freezing the whole preset at
// that generation until they migrate by hand.
//
// Removal is NOT this plugin's job: rc.5 provides no uninstall hook for
// removed bundles, and automatic deletion would destroy user edits. The
// supported deletion is DSH's own authoring delete (ctx.agentPresets.remove,
// the same method the Web UI calls).
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

export const name = 'loadout-preset'
export const inject = []

/** Stable preset identity materialized under the harness-home preset root. */
export const PRESET_ID = 'loadout'

/** Provenance marker written inside the materialized preset directory. */
export const MARKER_FILE = '.loadout-materialized.json'

/** Package name recorded in the marker. */
const SOURCE_PACKAGE = '@loadout/dsh-preset'

/**
 * Composition generation of the shipped preset tree. Bump on every shipped
 * change (composition OR skills) that existing untouched materializations
 * must adopt; markers without a version field read as 1.
 */
export const COMPOSITION_VERSION = 1

const here = dirname(fileURLToPath(import.meta.url))

/** The shipped preset directory this package carries (relative to its own install location). */
export function presetSourceDir(presetId = PRESET_ID) {
  return join(here, 'preset', presetId)
}

/** Sorted, content-addressed fingerprint of a directory tree (relative paths, marker excluded). */
function hashTree(dir) {
  const hash = createHash('sha256')
  const entries = []
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const target = join(current, entry)
      const stat = statSync(target)
      if (stat.isDirectory()) walk(target)
      else if (stat.isFile() && entry !== MARKER_FILE) entries.push([relative(dir, target).split('\\').join('/'), readFileSync(target)])
    }
  }
  walk(dir)
  for (const [path, content] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(path); hash.update('\u0000'); hash.update(content); hash.update('\u0000')
  }
  return hash.digest('hex')
}

/** The marker of one materialized preset directory, or undefined when absent/unreadable. */
export function readMaterializationMarker(presetDir) {
  const markerPath = join(presetDir, MARKER_FILE)
  if (!existsSync(markerPath)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(markerPath, 'utf8'))
    return {
      presetId: typeof parsed.presetId === 'string' ? parsed.presetId : undefined,
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      sourceHash: typeof parsed.sourceHash === 'string' ? parsed.sourceHash : undefined,
      materializedAt: typeof parsed.materializedAt === 'string' ? parsed.materializedAt : undefined,
    }
  } catch {
    return undefined
  }
}

/** Copy one tree over another; directories merge, files overwrite. Used only after the no-edits proof. */
function copyTree(from, to) {
  for (const entry of readdirSync(from).sort()) {
    const source = join(from, entry)
    const destination = join(to, entry)
    if (statSync(source).isDirectory()) {
      if (!existsSync(destination)) mkdirSync(destination)
      copyTree(source, destination)
    } else {
      copyFileSync(source, destination)
    }
  }
}

function marker(presetId, sourceHash, now) {
  return JSON.stringify({ presetId, version: COMPOSITION_VERSION, materializedAt: now(), sourceHash, source: SOURCE_PACKAGE }, null, 2) + '\n'
}

/**
 * Materialize (or safely upgrade) the preset under the harness-home preset
 * root. See the module doc for the decision table.
 *
 * @param home - resolved DeepSeek Harness home (the caller passes resolveDshHome()).
 * @param sourceDir - directory holding the preset files to copy.
 * @param presetId - preset id; defaults to `loadout`.
 * @param now - clock for the marker timestamp; tests pin it.
 * @param onStaged - test seam: invoked after the tree is staged and before the claiming rename.
 * @returns the materialization report: action 'created' | 'upgraded' | 'present' | 'present-outdated' | 'claimed'.
 */
export function materializePreset({ home, sourceDir, presetId = PRESET_ID, now = () => new Date().toISOString(), onStaged }) {
  const presetRoot = join(home, '.agent-presets')
  const target = join(presetRoot, presetId)
  const markerPath = join(target, MARKER_FILE)
  if (existsSync(target)) {
    const existing = readMaterializationMarker(target)
    if (existing === undefined) {
      return {
        action: 'present',
        presetDir: target,
        markerPath,
        note: 'existing directory carries no Loadout marker - treated as user-owned, never rewritten (DSH authoring owns this preset)',
      }
    }
    const dirHash = hashTree(target)
    if (dirHash !== existing.sourceHash) {
      return {
        action: 'present-outdated',
        presetDir: target,
        markerPath,
        markerVersion: existing.version,
        sourceVersion: COMPOSITION_VERSION,
        note: 'existing materialized preset was edited or diverged from the shipped generation - never overwritten; migrate manually (DSH authoring owns this preset)',
      }
    }
    if (existing.version >= COMPOSITION_VERSION) {
      return {
        action: 'present',
        presetDir: target,
        markerPath,
        markerVersion: existing.version,
        note: 'existing directory is at the current composition generation and untouched - left as is',
      }
    }
    // Byte-identical to an older shipped generation and never edited: the one
    // safe in-place refresh. Overwrite the shipped files, remove anything the
    // current generation no longer ships (at any depth), and re-stamp.
    const sourceHash = hashTree(sourceDir)
    copyTree(sourceDir, target)
    const sourcePaths = new Set()
    const collectSource = (current) => {
      for (const entry of readdirSync(current).sort()) {
        const path = join(current, entry)
        sourcePaths.add(relative(sourceDir, path).split('\\').join('/'))
        if (statSync(path).isDirectory()) collectSource(path)
      }
    }
    collectSource(sourceDir)
    const pruneTarget = (current) => {
      for (const entry of readdirSync(current).sort()) {
        if (entry === MARKER_FILE) continue
        const path = join(current, entry)
        const rel = relative(target, path).split('\\').join('/')
        if (!sourcePaths.has(rel)) rmSync(path, { recursive: true, force: true })
        else if (statSync(path).isDirectory()) pruneTarget(path)
      }
    }
    pruneTarget(target)
    writeFileSync(markerPath, marker(presetId, sourceHash, now))
    return {
      action: 'upgraded',
      presetDir: target,
      markerPath,
      markerVersion: existing.version,
      sourceVersion: COMPOSITION_VERSION,
      sourceHash,
      note: 'untouched generation-' + existing.version + ' materialization refreshed in place to generation-' + COMPOSITION_VERSION,
    }
  }
  const sourceHash = hashTree(sourceDir)
  mkdirSync(presetRoot, { recursive: true })
  // Stage the complete tree - files AND marker - beside the target, then claim
  // the id with one rename. The target therefore never exists without its
  // marker: a boot that finds a marker-less directory has found a
  // user-authored one, never a sibling boot mid-copy, and two boots racing
  // for the id are settled by the rename - the loser's rename fails against
  // the winner's completed directory and reports `claimed`. The dot-prefixed
  // staging name fails DSH's preset-id pattern, so discovery never lists it.
  const stage = mkdtempSync(join(presetRoot, '.' + presetId + '-staging-'))
  try {
    copyTree(sourceDir, stage)
    writeFileSync(join(stage, MARKER_FILE), marker(presetId, sourceHash, now))
  } catch (error) {
    // Nothing reached the target; drop the partial stage so nothing occupies the root.
    rmSync(stage, { recursive: true, force: true })
    throw error
  }
  onStaged?.()
  try {
    renameSync(stage, target)
  } catch (error) {
    rmSync(stage, { recursive: true, force: true })
    if (existsSync(target)) {
      return { action: 'claimed', presetDir: target, markerPath, note: 'another boot materialized this preset first' }
    }
    throw error
  }
  return { action: 'created', presetDir: target, markerPath, sourceHash }
}

/** Cordis plugin entry: materialize once per boot, then stay silent. */
export function apply(ctx) {
  const home = resolveDshHome()
  const report = materializePreset({ home, sourceDir: presetSourceDir() })
  if (report.action === 'present-outdated' || report.action === 'upgraded') {
    const line = 'loadout-preset: ' + report.action + ' - ' + report.note
    if (ctx?.logger?.warn) ctx.logger.warn(line)
    else console.warn(line)
  }
}
```

- [ ] **Step 4: Write `packages/preset/materialize.d.mts`**

```ts
/** Boot-time preset materialization row for the Loadout bundle. See materialize.mjs. */
export declare const name: string
export declare const inject: readonly []
export declare const PRESET_ID: string
export declare const MARKER_FILE: string
export declare const COMPOSITION_VERSION: number

export interface MaterializedMarker {
  readonly presetId?: string
  readonly version: number
  readonly sourceHash?: string
  readonly materializedAt?: string
}

export interface MaterializeReport {
  readonly action: 'created' | 'upgraded' | 'present' | 'present-outdated' | 'claimed'
  readonly presetDir: string
  readonly markerPath: string
  readonly sourceHash?: string
  readonly markerVersion?: number
  readonly sourceVersion?: number
  readonly note?: string
}

export interface MaterializeOptions {
  readonly home: string
  readonly sourceDir: string
  readonly presetId?: string
  readonly now?: () => string
  /** Test seam: invoked after the tree is staged and before the claiming rename. */
  readonly onStaged?: () => void
}

export declare function presetSourceDir(presetId?: string): string
export declare function readMaterializationMarker(presetDir: string): MaterializedMarker | undefined
export declare function materializePreset(options: MaterializeOptions): MaterializeReport
export declare function apply(ctx?: unknown): void
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- tests/preset/materialize`
Expected: PASS — 9 tests.

Run: `pnpm run typecheck` and `pnpm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```powershell
git add packages/preset/materialize.mjs packages/preset/materialize.d.mts tests/preset/materialize.spec.ts
git commit -m @'
feat(preset): materialize the preset and its skills at boot, never over a user edit

Create-if-absent under the harness-home preset root with a provenance
marker; an edited directory is reported and left alone; an untouched
older generation is refreshed in place. Preset and skills are one
generation unit.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 6: The bundle

**Files:**
- Create: `packages/bundle/package.json`
- Create: `packages/bundle/cordis.patch.yml`
- Test: `tests/bundle/bundle-manifest.spec.ts`

**Interfaces:**
- Consumes: `@loadout/dsh-preset/materialize` (Task 5).
- Produces: the `@loadout/dsh` package `dsh plugin add` installs (Task 7).

- [ ] **Step 1: Write the failing test `tests/bundle/bundle-manifest.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/bundle`
Expected: FAIL — ENOENT on `packages/bundle/package.json`.

- [ ] **Step 3: Write `packages/bundle/package.json`**

```json
{
  "name": "@loadout/dsh",
  "version": "0.1.0",
  "description": "DeepSeek Harness bundle for Loadout: installs the loadout agent preset and its bundled engineering skills",
  "license": "MIT",
  "type": "module",
  "exports": {
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": [
    "cordis.patch.yml"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "dependencies": {
    "@loadout/dsh-preset": "workspace:^"
  }
}
```

- [ ] **Step 4: Write `packages/bundle/cordis.patch.yml`**

```yaml
# Loadout composes ONE host-plane row: the boot-time materialization of the
# `loadout` agent preset (composition + skills) into the harness-home preset
# root. Everything the model sees is inside that preset; the host composition
# is otherwise untouched.
- insert:
    - id: loadout-preset
      name: '@loadout/dsh-preset/materialize'
```

- [ ] **Step 5: Install the workspace link and run the test**

Run: `pnpm install`
Expected: exit 0; `packages/bundle/node_modules/@loadout/dsh-preset` is a workspace link.

Run: `pnpm test -- tests/bundle`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```powershell
git add packages/bundle tests/bundle pnpm-lock.yaml
git commit -m @'
feat(bundle): @loadout/dsh inserts the materialize row into the host composition

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 7: Real installation smoke on the pinned checkout

**Files:**
- Create: `tests/integration/dsh-smoke.ts`

**Interfaces:**
- Consumes: both packages; the built pinned checkout (`DSH_SOURCE_DIR`, default `../deepseek-harness`).
- Proves: `dsh plugin add` installs the bundle; boot materializes the preset; the roster lists `loadout` healthy; the standing composition mounts; the five skills are visible in the preset's scope through `ctx.skills` and served by the `loadout` provider; they do NOT leak into the global layer; removal is clean.

This is the step that also proves `dshHomePath(...)` resolves inside a preset's `!!js` config expression. If the boot fails with `dshHomePath is not defined` (or the loadout-skills row reports broken), apply the fallback in Task 7b instead of debugging the expression.

- [ ] **Step 1: Write `tests/integration/dsh-smoke.ts`**

```ts
// One Loadout bundle install on the REAL pinned DSH web profile.
//
// pack preset + bundle -> 'dsh plugin --profile web add' both tarballs ->
// dump-config -> boot the web profile ('--port 0') with a verification driver
// that reads the native roster, cold-mounts the loadout composition, lists the
// bundled skills through the skill registry in the preset's scope, loads one,
// and proves nothing leaked into the global layer -> remove -> boot a
// post-remove driver that performs the supported preset deletion.
//
// Requires a BUILT checkout: DSH_SOURCE_DIR (default: the sibling
// ../deepseek-harness). Uses a temporary DSH_HOME and removes it afterward.
import { spawn } from 'node:child_process'
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strict as assert } from 'node:assert'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')
const dshRoot = process.env.DSH_SOURCE_DIR ?? resolve(projectRoot, '../deepseek-harness')
const pnpm = process.env.LOADOUT_PNPM ?? (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
const profile = 'web'
const SKILLS = ['brainstorming', 'grill-me', 'systematic-debugging', 'test-driven-development', 'verification-before-completion']

interface CommandResult {
  readonly code: number
  readonly output: string
}

function execute(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Promise<CommandResult> {
  // A .cmd target needs the shell on Windows, and the shell joins arguments
  // with spaces and no quoting - a temp path with a space would split. Quote
  // exactly the arguments that carry whitespace, only when the shell is used.
  const shell = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')
  const spawnArgs = shell ? args.map(argument => (/\s/.test(argument) ? '"' + argument + '"' : argument)) : [...args]
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, spawnArgs, {
      cwd,
      env,
      shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', chunk => { output += String(chunk) })
    child.stderr.on('data', chunk => { output += String(chunk) })
    child.once('error', reject)
    child.once('close', code => { resolveResult({ code: code ?? 1, output }) })
  })
}

function expectSuccess(label: string, result: CommandResult): void {
  assert.equal(result.code, 0, label + ' failed:\n' + result.output)
}

async function tarball(packDirectory: string, prefix: string): Promise<string> {
  const names = await readdir(packDirectory)
  const name = names.find(candidate => candidate.startsWith(prefix) && candidate.endsWith('.tgz'))
  assert.ok(name, 'missing ' + prefix + ' tarball in ' + packDirectory)
  return join(packDirectory, name)
}

interface BundleManifest {
  dependencies: Record<string, string>
  dsh: { bundle: { patch: string } }
}

/**
 * The source bundle depends on the preset by workspace protocol, which the
 * profile's package manager cannot resolve; this disposable copy points at
 * the packed tarball instead. The source manifest keeps the publishable form.
 */
async function createLocalBundleFixture(scratch: string, presetTarball: string): Promise<string> {
  const sourceDirectory = join(projectRoot, 'packages', 'bundle')
  const manifest = JSON.parse(await readFile(join(sourceDirectory, 'package.json'), 'utf8')) as BundleManifest
  assert.equal(manifest.dependencies['@loadout/dsh-preset'], 'workspace:^')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  const fixtureDirectory = join(scratch, 'local-bundle')
  await mkdir(fixtureDirectory, { recursive: true })
  await cp(join(sourceDirectory, 'cordis.patch.yml'), join(fixtureDirectory, 'cordis.patch.yml'))
  manifest.dependencies['@loadout/dsh-preset'] = 'file:' + presetTarball.replaceAll('\\', '/')
  await writeFile(join(fixtureDirectory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  return fixtureDirectory
}

/** Boot-time verification driver for the REAL web profile. */
async function prepareVerifyDriver(profileDirectory: string): Promise<void> {
  await writeFile(join(profileDirectory, 'loadout-verify.mjs'), [
    "export const name = 'loadout-verify'",
    "export const inject = ['agentPresets', 'skills']",
    'export async function apply(ctx) {',
    '  const listed = await ctx.agentPresets.list()',
    "  const loadout = listed.find(p => p.id === 'loadout')",
    "  if (loadout === undefined) throw new Error('loadout preset missing from the native roster: ' + listed.map(p => p.id).join(','))",
    "  if (loadout.name !== 'Loadout') throw new Error('display name mismatch: ' + JSON.stringify(loadout.name))",
    "  if (loadout.broken !== undefined) throw new Error('preset reported broken: ' + loadout.broken)",
    "  const standard = listed.find(p => p.id === 'standard')",
    "  if (standard === undefined || standard.trust !== 'system') throw new Error('native Standard preset missing or mistrusted')",
    '  // Cold-mount the FULL loadout composition against the real web host plane:',
    '  // rejects unless every row activates (the loadout-skills row included).',
    "  const scope = await ctx.agentPresets.standingKeyFor('loadout')",
    '  const cwd = process.cwd()',
    '  const snapshot = await ctx.skills.snapshot({ scope, cwd })',
    "  if (!snapshot.complete) throw new Error('skill discovery incomplete in the loadout scope')",
    '  const names = snapshot.skills.map(s => s.name)',
    '  for (const expected of ' + JSON.stringify(SKILLS) + ') {',
    "    if (!names.includes(expected)) throw new Error('bundled skill missing from the loadout scope: ' + expected + '; have ' + names.join(','))",
    '  }',
    "  const loaded = await ctx.skills.get('systematic-debugging', { scope, cwd })",
    "  if (loaded === undefined) throw new Error('systematic-debugging did not load')",
    "  if (loaded.provider !== 'loadout') throw new Error('skill served by provider ' + loaded.provider + ', expected loadout')",
    "  if (loaded.source !== 'bundled') throw new Error('skill source ' + loaded.source + ', expected bundled')",
    "  if (!loaded.content.includes('Phase 1')) throw new Error('loaded body is not the shipped skill')",
    '  // Isolation: the global layer (no scope) must not be served by the loadout provider.',
    '  const leaked = (await ctx.skills.list({ cwd })).filter(s => s.provider === \'loadout\').map(s => s.name)',
    "  if (leaked.length > 0) throw new Error('bundled skills leaked into the global layer: ' + leaked.join(','))",
    "  process.stdout.write('[loadout-smoke] roster ok, composition mounted, ' + names.length + ' skills in scope, isolation ok\\n')",
    "  const exit = ctx.get('appExit')",
    "  if (typeof exit !== 'function') throw new Error('launcher did not provide appExit')",
    '  exit(0)',
    '}',
    '',
  ].join('\n'))
  await writeFile(join(profileDirectory, 'cordis.patch.yml'), [
    '- insert:',
    '    - id: loadout-verify',
    '      name: ./loadout-verify.mjs',
    '',
  ].join('\n'))
}

/** Post-remove driver: the bundle is gone, the preset remains until the supported explicit deletion. */
async function preparePostRemoveDriver(profileDirectory: string): Promise<void> {
  await writeFile(join(profileDirectory, 'loadout-postremove.mjs'), [
    "export const name = 'loadout-postremove'",
    "export const inject = ['agentPresets']",
    'export async function apply(ctx) {',
    '  const before = await ctx.agentPresets.list()',
    "  if (!before.some(p => p.id === 'loadout')) throw new Error('materialized preset should remain until the explicit deletion')",
    "  await ctx.agentPresets.remove('loadout')",
    '  const after = await ctx.agentPresets.list()',
    "  if (after.some(p => p.id === 'loadout')) throw new Error('supported preset removal did not remove loadout')",
    "  const exit = ctx.get('appExit')",
    "  if (typeof exit !== 'function') throw new Error('launcher did not provide appExit')",
    '  exit(0)',
    '}',
    '',
  ].join('\n'))
  await writeFile(join(profileDirectory, 'cordis.patch.yml'), [
    '- insert:',
    '    - id: loadout-postremove',
    '      name: ./loadout-postremove.mjs',
    '',
  ].join('\n'))
}

const dshBin = join(dshRoot, 'apps', 'cli', 'lib', 'bin.js')
await access(dshBin)

const scratch = await mkdtemp(join(tmpdir(), 'loadout-dsh-smoke-'))
const packDirectory = join(scratch, 'packages')
const dshHome = join(scratch, 'dsh-home')
await mkdir(packDirectory, { recursive: true })
// A hermetic home for BOTH skill roots: the developer's real ~/.agents/skills
// may carry same-named skills, which would make the isolation assertion
// ambiguous. Everything the smoke observes comes from the tarballs.
const env = { ...process.env, DSH_HOME: dshHome, DSH_AGENTS_HOME: join(scratch, 'agents-home'), DSH_TELEMETRY_DISABLED: '1' }

try {
  expectSuccess('preset pack', await execute(pnpm, ['--filter', '@loadout/dsh-preset', 'pack', '--pack-destination', packDirectory], projectRoot, env))
  const presetTarball = await tarball(packDirectory, 'loadout-dsh-preset-')
  const localBundle = await createLocalBundleFixture(scratch, presetTarball)
  expectSuccess('local bundle fixture pack', await execute(pnpm, ['pack', '--pack-destination', packDirectory], localBundle, env))
  const bundleTarball = await tarball(packDirectory, 'loadout-dsh-0.1.0')

  expectSuccess('dsh web plugin add', await execute(process.execPath, [dshBin, 'plugin', '--profile', profile, 'add', presetTarball, bundleTarball], dshRoot, env))

  const dump = await execute(process.execPath, [dshBin, '--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after add', dump)
  assert.match(dump.output, /id: loadout-preset/)
  assert.match(dump.output, /name: '@loadout\/dsh-preset\/materialize'/)
  assert.match(dump.output, /id: agent-presets/)

  const profileDirectory = join(dshHome, 'profiles', profile)
  await prepareVerifyDriver(profileDirectory)
  const boot = await execute(process.execPath, [dshBin, '--profile', profile, '--port', '0'], dshRoot, env)
  expectSuccess('dsh web profile boot with Loadout', boot)
  assert.match(boot.output, /\[loadout-smoke\] roster ok/)

  const presetDir = join(dshHome, '.agent-presets', 'loadout')
  assert.equal(existsSync(join(presetDir, 'agent.cordis.yml')), true)
  assert.equal(existsSync(join(presetDir, 'preset.yml')), true)
  assert.equal(existsSync(join(presetDir, '.loadout-materialized.json')), true)
  for (const skill of SKILLS) assert.equal(existsSync(join(presetDir, 'skills', skill, 'SKILL.md')), true, skill + ' materialized')

  expectSuccess('dsh web plugin remove', await execute(process.execPath, [dshBin, 'plugin', '--profile', profile, 'remove', '@loadout/dsh', '@loadout/dsh-preset'], dshRoot, env))
  await preparePostRemoveDriver(profileDirectory)
  expectSuccess('dsh web profile boot after removal', await execute(process.execPath, [dshBin, '--profile', profile, '--port', '0'], dshRoot, env))
  assert.equal(existsSync(presetDir), false, 'the supported authoring delete removed the preset directory')

  await writeFile(join(profileDirectory, 'cordis.patch.yml'), '# Your patch layer for this dsh profile, applied after every bundle layer:\n[]\n')
  const afterRemove = await execute(process.execPath, [dshBin, '--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after remove', afterRemove)
  assert.doesNotMatch(afterRemove.output, /loadout/)
  assert.match(afterRemove.output, /id: agent-presets/)

  process.stdout.write('Loadout DSH smoke passed: one bundle install on the real web profile, roster + cold full-preset mount, five bundled skills in the preset scope with no global leak, clean two-stage removal.\n')
} finally {
  await rm(scratch, { force: true, recursive: true })
}
```

- [ ] **Step 2: Run the smoke**

Run (PowerShell):

```powershell
$env:DSH_SOURCE_DIR = (Resolve-Path ..\deepseek-harness).Path
pnpm run test:dsh-smoke
```

Expected: exit 0 and the final line `Loadout DSH smoke passed: ...`. A run takes a few minutes (two boots of the real web profile).

- [ ] **Step 3: If the boot fails at the loadout-skills row**

Symptoms: `dsh web profile boot with Loadout failed:` with `dshHomePath is not defined`, or `preset reported broken: ...loadout-skills...`. Do NOT patch around it in the expression; go to Task 7b, then return to Step 2.

- [ ] **Step 4: Run every check and commit**

Run: `pnpm run typecheck`, `pnpm run lint`, `pnpm test`
Expected: all exit 0.

```powershell
git add tests/integration/dsh-smoke.ts
git commit -m @'
test(integration): one Loadout install on the real web profile

Pack, add, boot with a verification driver that cold-mounts the loadout
composition and reads the five bundled skills through the skill registry
in the preset scope, then remove and delete cleanly.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 7b (fallback only): a preset-local skill provider row

Apply ONLY if Task 7 Step 3 fired. Replaces the `!!js dshHomePath(...)` configuration with a 50-line provider that resolves the skills directory from its own file location.

**Files:**
- Create: `packages/preset/preset/loadout/skills.mjs`
- Modify: `packages/preset/preset/loadout/agent.cordis.yml` (the `loadout-skills` row)
- Modify: `tests/preset/capability-parity.spec.ts` (the `loadout-skills` row test)

- [ ] **Step 1: Write `packages/preset/preset/loadout/skills.mjs`**

```js
// The bundled Loadout skills as a preset-local provider. Registered from the
// preset's standing composition, so the skills live in THIS preset's layer.
// The skills directory sits beside this file wherever the preset was
// materialized, so no path configuration is needed.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'loadout-skills'
export const inject = ['skills']

const PROVIDER = 'loadout'
const RANK = 600
const root = join(dirname(fileURLToPath(import.meta.url)), 'skills')
const INVOCATION = { modelInvocable: true, userInvocable: true }

function parse(dir) {
  const path = join(root, dir, 'SKILL.md')
  const text = readFileSync(path, 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (match === null) throw new Error('loadout-skills: ' + path + ' has no frontmatter')
  const field = (key) => {
    const line = new RegExp('^' + key + ': (.*)$', 'm').exec(match[1])
    return line === null ? undefined : line[1].trim().replace(/^["']|["']$/g, '')
  }
  return { name: field('name') ?? dir, description: field('description') ?? '', content: match[2], path, dir: join(root, dir) }
}

function candidates() {
  if (!existsSync(root)) return []
  return readdirSync(root).sort().filter(dir => existsSync(join(root, dir, 'SKILL.md'))).map((dir) => {
    const skill = parse(dir)
    return {
      name: skill.name,
      description: skill.description,
      invocation: INVOCATION,
      provider: PROVIDER,
      source: 'bundled',
      rank: RANK,
      locator: dir,
      path: skill.path,
      resourceBase: { kind: 'directory', path: skill.dir },
    }
  })
}

export function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: PROVIDER,
    list: () => Promise.resolve(candidates()),
    get: (candidate) => {
      const skill = parse(String(candidate.locator))
      return Promise.resolve({
        name: skill.name,
        description: skill.description,
        invocation: INVOCATION,
        provider: PROVIDER,
        source: 'bundled',
        resourceBase: { kind: 'directory', path: skill.dir },
        path: skill.path,
        content: skill.content,
      })
    },
  }))
}
```

- [ ] **Step 2: Replace the `loadout-skills` row in `agent.cordis.yml`**

Replace the whole row (from `- id: loadout-skills` to the `bundledSkillDir:` line) with:

```yaml
- id: loadout-skills
  name: ./skills.mjs
```

and replace the row's comment paragraph with:

```yaml
# The bundled Loadout skills: a preset-local provider (./skills.mjs) that
# reads the `skills/` directory beside this file wherever the preset was
# materialized. Registered from the preset's standing composition, the skills
# live in THIS preset's layer and no other preset sees them.
```

- [ ] **Step 3: Replace the row test in `tests/preset/capability-parity.spec.ts`**

Replace the `'the loadout-skills row is an isolated second skill-filesystem provider...'` test with:

```ts
  it('the loadout-skills row is the preset-local provider beside the composition', async () => {
    const row = (await loadComposition(loadoutPath)).find(candidate => candidate.id === 'loadout-skills')
    expect(row?.name).toBe('./skills.mjs')
    expect(row?.config).toBeUndefined()
  })
```

- [ ] **Step 4: Run `pnpm test`, then return to Task 7 Step 2**

Expected: `pnpm test` PASS; the smoke then passes with the provider row. Commit the fallback as part of Task 7 Step 4 with the subject `test(integration): one Loadout install on the real web profile (preset-local skill provider)`.

---

### Task 8: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# dsh-loadout

One install gives a DeepSeek Harness (DSH) deployment the `loadout` agent
preset: the shipped Standard coding composition, a task-first persona, and
five bundled engineering skills.

- `@loadout/dsh` — the DSH bundle (`dsh plugin add` target). Inserts one
  host-plane row.
- `@loadout/dsh-preset` — the preset directory plus the boot-time
  materialization row that copies it into `<dshHome>/.agent-presets/loadout`.

## What ships

**Composition** — the pinned DSH Standard preset copied verbatim; the only
differences, machine-checked by `tests/preset/capability-parity.spec.ts`, are
the persona text and one added `loadout-skills` row. Presentation is native.

**Persona** (system prompt, order 0, under 1,200 characters) — an environment
line (`Model: {{model}}. Working directory: {{cwd}}.`), skill routing, and
seven standing rules. No identity claim, no competence adjectives: persona
prompting does not improve objective-task accuracy and can degrade reasoning,
so the standing text carries instruction only.

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
uses DSH's own tool vocabulary; `tests/skills/skill-lint.spec.ts` enforces it.

## Install

The packages are not on npm yet, so install from packed tarballs. The bundle
depends on the preset by workspace protocol; the profile's package manager
cannot resolve that, so point a copy of the bundle at the preset tarball:

```powershell
pnpm --filter @loadout/dsh-preset pack --pack-destination dist
$preset = (Get-ChildItem dist\loadout-dsh-preset-*.tgz).FullName
Copy-Item -Recurse packages\bundle dist\bundle
(Get-Content dist\bundle\package.json) -replace 'workspace:\^', ('file:' + ($preset -replace '\\', '/')) | Set-Content -Encoding utf8 dist\bundle\package.json
pnpm --dir dist\bundle pack --pack-destination ..
$bundle = (Get-ChildItem dist\loadout-dsh-0.1.0.tgz).FullName
dsh plugin --profile web add $preset $bundle
dsh --profile web
```

The first boot materializes the preset into `<dshHome>/.agent-presets/loadout/`
and it appears in the preset picker as **Loadout**.

The materialized directory is yours: edit it freely. An edited directory is
never overwritten by a later version (the boot log reports `present-outdated`);
an untouched one is upgraded in place.

## Remove

Two stages, on purpose (rc.5 gives removed bundles no teardown hook, and
automatic deletion would destroy user edits):

```powershell
dsh plugin --profile web remove @loadout/dsh @loadout/dsh-preset
```

then delete the preset from the Web UI, or through `ctx.agentPresets.remove('loadout')`.

## Observed models

Whether a model loads a skill unprompted is a per-model, repeatable
observation, not a property of this package. Record what you saw:

| model | reasoning | loads a skill unprompted on a bug task? | notes |
|---|---|---|---|
| _(none yet)_ | | | |

## Development

Requires the pinned DSH checkout, built, as the sibling directory
`../deepseek-harness` (commit `47f943859bef60e4160492346772ded9b24f765a`,
0.1.0-rc.5).

```powershell
pnpm install
pnpm run typecheck
pnpm run lint
pnpm test
$env:DSH_SOURCE_DIR = (Resolve-Path ..\deepseek-harness).Path
pnpm run test:dsh-smoke
```

`test:dsh-smoke` installs the bundle into a temporary DSH home on the real
web profile, boots it, reads the bundled skills through the skill registry in
the preset's scope, and removes everything afterward.

Known limitation (upstream): on Windows, `dsh plugin add` in rc.5 spawns pnpm
through the shell without quoting, so a temp directory whose path contains a
space breaks the install step inside DSH itself. Run the smoke with a
space-free `%TEMP%`. The smoke's own pnpm calls quote their arguments.

## Not in v1

KeepGate runtime and governance, design skills, planning and subagent skills,
a session-start bootstrap plugin, npm publishing.
````

- [ ] **Step 2: Verify the README cites the pinned commit**

Run: `git -C ..\deepseek-harness rev-parse HEAD`
Expected: `47f943859bef60e4160492346772ded9b24f765a` — the same string the README's Development section carries.

- [ ] **Step 3: Run every check one last time**

Run: `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run test:dsh-smoke`
Expected: all exit 0.

- [ ] **Step 4: Commit**

```powershell
git add README.md
git commit -m @'
docs: install, remove, what ships, and the observed-models table

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
'@
```

---

## Self-review

**Spec coverage.** Name/id/packages: Tasks 2, 6. Standard verbatim + exact delta: Task 2 (parity), Task 3 (persona delta). Persona content and budget: Task 3. Five skills, English, budgets, one example, DSH vocabulary, closed references: Task 4. Materialize with never-overwrite and one generation unit: Task 5. One-command install: Tasks 6, 7. v1 done = deterministic checks green: Tasks 7, 8. Per-model behaviour recorded, not gated: Task 8 (table). Out-of-scope items are listed in Global Constraints and the README.

**Placeholder scan.** Every file has its full content; every run step has an expected outcome; Task 7b is a complete fallback, not a "handle it later".

**Type consistency.** `loadComposition` / `analyzeParity` (Task 2) are used unchanged in Tasks 3 and 7b; `BUNDLED_SKILLS` / `BANNED_TOKENS` / budgets (Task 3) are the names Task 4 imports; `PRESET_ID`, `MARKER_FILE`, `COMPOSITION_VERSION`, `materializePreset`, `presetSourceDir` (Task 5) match `materialize.d.mts` and the spec; the bundle row id `loadout-preset` (Task 6) is what the smoke greps (Task 7); the provider name `loadout` and source `bundled` (Task 2 row config) are what the smoke driver asserts.

---

## Post-v1 follow-ups (from the final whole-branch review, 2026-09-18/20)

Not defects in what shipped; recorded so the next change starts from them rather than rediscovering them.

**Before the first `COMPOSITION_VERSION` bump**
- Pin a per-generation hash of the shipped preset tree in a test fixture so a forgotten bump fails loudly instead of silently shipping nothing to untouched installs.
- `materialize.mjs` upgrade failure paths: catch the removal of the retired `-previous-` directory (a locked handle there makes `apply()` log a failure although the upgrade succeeded); in the catch, restore the previous generation BEFORE removing the stage.

**Adding a sixth skill touches** the directory, `tests/contract.ts` `BUNDLED_SKILLS`, the `SKILLS` array in `tests/integration/dsh-smoke.ts` (import it from `contract.ts` instead), the persona routing text, `preset.yml`'s description (not machine-checked), the README table, and the version bump.

**Smaller**
- `materialize.mjs`: a corrupt marker reads as "no marker → user-owned"; report an unreadable marker instead. The hash comparator orders by UTF-16 code unit (deterministic; the comment says "codepoint").
- `tests/integration/dsh-smoke.ts` `execute()` has no timeout; a driver that never reaches `exit(0)` hangs the run. Scratch `mkdtemp` happens before the `try/finally`.
- `agent.cordis.yml` header comment still describes the parity guard as "identical name/config/disabled"; the guard now compares whole rows and top-level order.
- README: `bundledSkillDir` hardcodes `loadout` (a Web-UI copy of the preset shares the original's `skills/`); bundled rank 600 is shadowed by a same-named user or project skill while the persona still routes by name; the preset lands in the profile-independent `<dshHome>/.agent-presets`, so installing on `web` exposes it to every profile.
- rc.6 port checklist: bump the `0.1.0-rc.5` peer in `packages/preset/package.json`, re-copy Standard, re-confirm `dshHomePath` provision and the `bundledSkillDir` / `includeDefaultRoots` semantics in `skill-filesystem`.

**Upstream (DSH rc.5)**: `dsh plugin add` spawns pnpm through the shell without quoting, so a `DSH_HOME`/temp path containing a space breaks installation inside DSH itself.

Superseded by 2026-09-20-dsh-loadout-v1.1-dsh-0.1.5.md: pin moved to 0.1.5-rc.2, one package, skills via customSkillDirs.
