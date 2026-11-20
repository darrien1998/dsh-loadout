# dsh-loadout

Loadout adds task-focused prompts, the Stop Slop writing rules, and six engineering skills to the DeepSeek Harness profile you already use.

## Install and switch

Version 0.3.0 supports **DSH 0.2.2-rc.3 and 0.2.2-rc.4**, including the Windows Desktop runtime on rc.3. Download the `dsh-loadout` artifact from a successful [CI run](https://github.com/darrien1998/dsh-loadout/actions/workflows/ci.yml) and extract the `.tgz`, or build it from this checkout.

```powershell
pnpm --filter dsh-loadout pack --pack-destination dist
npx @deepseek-ai/dsh@0.2.2-rc.4 plugin --profile web add (Resolve-Path dist/dsh-loadout-0.3.0.tgz).Path
npx @deepseek-ai/dsh@0.2.2-rc.4 web
```

In Desktop, install the tarball through **Plugins** in the Desktop profile. In either interface, open **Plugins → dsh-loadout** and use its enable switch. Installing with the CLI enables the bundle. The switch applies to the entire active profile and affects subsequent model requests, including in existing chats on that profile. Restart DSH after changing the switch if profile hot reload is disabled.

| Switch | Effect |
| --- | --- |
| On | Uses Loadout's persona prefix and suffix and adds its six skills. Keep using your chosen mode. |
| Off | Restores the selected mode's own persona and removes the Loadout skill provider. The package stays installed. |

The overlay applies to **Standard**, **PTC**, **Cordis**, and custom modes with ordinary persona sections. It preserves mode selection, tool definitions, workflow configuration, Plan Mode, and runtime context. DSH protects complete system prompts from overlays, including the one used by **Minimal**. The bundled skills use DSH's normal discovery and precedence rules and can be invoked in modes that provide the skill tool.

### Upgrade from the Loadout mode in 0.2.1

Install the 0.3.0 tarball in the profile where you use Loadout, then start a chat in a native mode such as Standard. Existing sessions store their original mode ID. To resume a session saved under the retired `loadout` mode, restore 0.2.1 in that profile first. The update leaves saved chats, profile overrides, and legacy `.agent-presets/loadout` files on disk.

## Prompts and skills

The always-active persona routes to skills, defines when to act or ask, requires fresh verification, and has the agent write a self-contained final answer. For optimization, it asks the agent to measure against a baseline and protect the primary metric within agreed trade-offs. For code changes, it favors readable code and preserves existing behavior and valid inputs.

| Skill | Method |
| --- | --- |
| `grill-me` | Inspect facts and resolve one user-owned requirement at a time |
| `brainstorming` | Compare material trade-offs and proceed with authorized implementation |
| `systematic-debugging` | Reproduce, compare working and failing paths, test one hypothesis, fix the cause |
| `test-driven-development` | Red, verify red, green, verify green, refactor |
| `verification-before-completion` | Match fresh evidence to each acceptance condition |
| `stop-slop` | Review prose against eight writing rules and five internal scoring dimensions |

The persona stays under 2,600 characters and each on-demand skill body stays under 3,000. The task, delivery, and coding guidance adapts the [OpenAI GPT-6.2 prompting guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6.2-astra). The Stop Slop writing rules and skill adapt [Hardik Pandya's Stop Slop](https://github.com/hardikpandya/stop-slop) at revision `8da1f030185bdfe8471220585162991eaeb970e9`. Attribution and the MIT notice ship in `THIRD_PARTY_NOTICES.md`.

## Development

Requires Node ≥24.9 and pnpm. The workspace pins the DSH CLI to 0.2.2-rc.4.

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run test:dsh-smoke
```

The smoke test installs the packed tarball into a temporary DSH profile, exercises the same bundle switch that the Plugins page uses, and verifies mode, tool, prompt and skill behavior through on, off, on, and removal. It runs without model requests. Set `LOADOUT_DSH` to the Desktop CLI carrier to repeat the test on rc.3, or `DSH_SOURCE_DIR` to use a built DSH checkout.

## Remove

Remove the bundle through **Plugins** or run the following for the web profile.

```powershell
npx @deepseek-ai/dsh@0.2.2-rc.4 plugin --profile web remove dsh-loadout
```
