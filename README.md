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
