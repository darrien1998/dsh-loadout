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
added and no row is reordered; the `present` row is Standard's own.

**Persona** — under 1,300 characters, no identity claim, no competence
adjectives: persona prompting does not improve objective-task accuracy and can
degrade reasoning, so the standing text carries instruction only. The prefix
(the first section after DSH's own identity line) states the environment —
`Model: {{model}}. Working directory: {{cwd}}.` — and routes to the skills;
the suffix (rendered after DSH's own tool guidance) carries six standing
rules.

**Skills** — loaded on demand through the `skill` tool; the model sees only
name + description until it loads one:

| skill | trigger |
|---|---|
| `brainstorming` | when design choices materially affect the result: inspect context, resolve user-owned choices, recommend a small design |
| `grill-me` | before development when requirements are unclear: inspect context, ask one key decision at a time, then summarize the agreed requirements |
| `systematic-debugging` | any bug or failing test: root cause first, one hypothesis at a time, failing test before the fix |
| `test-driven-development` | when a regression test adds evidence: red, verify red, green, verify green, refactor |
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
it available to every profile. Edits to a materialized skill are picked up
live — the skill root is watched — without restarting DSH.

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
the shell without quoting its arguments, so a tarball or checkout path that
contains a space breaks the install step inside DSH itself. Installing by
package name is unaffected; keep local tarball paths free of spaces.
