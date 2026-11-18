# dsh-loadout

A DeepSeek Harness bundle that adds **Loadout**: the current Standard coding composition, task-first instructions, Stop Slop writing rules in the system prompt, and six bundled skills.

## Compatibility and installation

Version 0.2.0 targets **DSH 0.2.2-rc.4**, the newest official release checked on 2026-11-18 (a prerelease). The npm `latest` tag still points to 0.2.2-rc.1; install the explicit version when testing this bundle. Upstream source: tag `dsh-v0.2.2-rc.4`, commit `3f321d32bfe382212a8ed8785c1d47a5a300aa23`.

```powershell
npx @deepseek-ai/dsh@0.2.2-rc.4 plugin --profile web add https://github.com/darrien1998/dsh-loadout/releases/download/v0.2.0/dsh-loadout-0.2.0.tgz
npx @deepseek-ai/dsh@0.2.2-rc.4 web
```

Select **Loadout** for a new chat. This installs the public GitHub Release tarball; npm publication is not required. For a checkout build, use the local tarball below.

DSH now registers presets through `@deepseek-ai/dsh-agent-preset` declarations in the bundle patch. It no longer discovers directories under `<dshHome>/.agent-presets`. This release replaces the old boot-time materializer with a `preset-loadout` declaration whose `config.id` remains `loadout`.

## Upgrade from 0.1.0

Back up any custom edits in `<dshHome>/.agent-presets/loadout` before upgrading. Those legacy files remain on disk and are not imported, overwritten, or deleted by this package. Reapply desired edits through DSH's preset editor or the profile patch on `preset-loadout.config.plugins`. Old generation markers no longer control upgrades.

Update/install the bundle in each profile where you want Loadout, restart the host if required, then create a new chat with Loadout selected. Profiles own declarations independently; installation on `web` does not register it in other profiles. Existing Agents retain the composition revision they started with. Saved profile overrides can also keep old instructions active; review those overrides when upgrading.

## What ships

The composition copies the exact 0.2.2-rc.4 Standard declaration, retaining its scheduling, time context, office tools, plugin management, current subagent settings, and PTC workflow. Only the persona and skill roots differ. Loadout preserves Standard's documentation skill root and appends its own packaged skills using package resolution from the profile. `tests/preset/capability-parity.spec.ts` checks all rows, configuration, nesting, platform gates, and ordering against the exact published Standard YAML.

The persona prefix routes to skills and uses the supported `{{model}}` variable. The old `{{cwd}}` variable is removed; DSH supplies working-directory information through its own runtime context. Its suffix contains the task rules and an always-active adaptation of Stop Slop's eight core writing rules: cut filler, avoid formulaic structures, prefer active voice, name specifics, address the reader, vary rhythm, trust readers, and remove manufactured slogans. These apply to authored prose across languages, while preserving technical accuracy, code, quotations, and the user's requested style. They do not require loading the skill first.

| Skill | Use |
|---|---|
| `brainstorming` | Design choices that materially affect the result |
| `grill-me` | Unclear development requirements |
| `systematic-debugging` | Bugs and failing tests |
| `test-driven-development` | Changes where a regression test adds evidence |
| `verification-before-completion` | Before claiming completion |
| `stop-slop` | Drafting, editing, and reviewing prose |

The adapted Stop Slop skill adds a review procedure and the original five scoring dimensions. It keeps scores internal unless requested. Source: [Hardik Pandya's stop-slop](https://github.com/hardikpandya/stop-slop), pinned at `8da1f030185bdfe8471220585162991eaeb970e9`; attribution and the MIT license are in [THIRD_PARTY_NOTICES.md](https://github.com/darrien1998/dsh-loadout/blob/main/packages/dsh-loadout/THIRD_PARTY_NOTICES.md) in this repository and at the package root in the tarball.

The combined persona stays under 2,600 characters; each skill body stays under 3,000. Project skill precedence and filesystem watching remain controlled by DSH.

## Development and local install

Requires Node >=24.9 and pnpm. Published DSH runtime dependencies are pinned to 0.2.2-rc.4; no sibling source checkout or full Harness build is needed.

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run test:dsh-smoke
pnpm --filter dsh-loadout pack --pack-destination dist
npx @deepseek-ai/dsh@0.2.2-rc.4 plugin --profile web add (Resolve-Path dist/dsh-loadout-0.2.0.tgz).Path
```

The smoke test packs and installs the actual tarball into a temporary DSH home, boots the real web profile without opening a browser or making model requests, verifies preset activation, skill isolation and Stop Slop loading, then removes the bundle and checks the declaration disappears. It uses the pinned installed CLI by default; `DSH_SOURCE_DIR` may select an equivalent built source checkout.

## Remove

```powershell
npx @deepseek-ai/dsh@0.2.2-rc.4 plugin --profile web remove dsh-loadout
```

Removing the bundle removes its declaration after reload. Legacy `.agent-presets/loadout` files and profile overrides remain user-owned and are not deleted.
