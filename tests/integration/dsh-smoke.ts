// One Loadout bundle install on the REAL pinned DSH web profile.
//
// pack the package -> 'dsh plugin --profile web add' the tarball ->
// dump-config -> boot the web profile ('--port 0') with a verification driver
// that reads the native roster, cold-mounts the loadout composition, lists the
// bundled skills through the skill registry in the preset's scope, loads one,
// and proves nothing leaked into the global layer -> remove -> boot a
// post-remove driver that performs the supported preset deletion.
//
// Requires a BUILT checkout: DSH_SOURCE_DIR (default: the sibling
// ../deepseek-harness-0.1.5). Uses a temporary DSH_HOME and removes it afterward.
// Boots with --no-open so no browser tab opens.
import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strict as assert } from 'node:assert'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')
const dshRoot = process.env.DSH_SOURCE_DIR ?? resolve(projectRoot, '../deepseek-harness-0.1.5')
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

/** Boot-time verification driver for the REAL web profile. */
async function prepareVerifyDriver(profileDirectory: string, dshHome: string): Promise<void> {
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
    '  // rejects unless every row activates.',
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
    "  if (loaded.provider !== 'filesystem') throw new Error('skill served by provider ' + loaded.provider + ', expected filesystem')",
    "  if (loaded.source !== 'custom') throw new Error('skill source ' + loaded.source + ', expected custom (the preset-local root)')",
    "  const presetDir = " + JSON.stringify(join(dshHome, '.agent-presets', 'loadout')) + "",
    "  if (typeof loaded.path !== 'string' || !loaded.path.startsWith(presetDir)) throw new Error('skill loaded from ' + loaded.path + ', expected under ' + presetDir)",
    "  if (!loaded.content.includes('Phase 1')) throw new Error('loaded body is not the shipped skill')",
    '  // Isolation: with hermetic homes, the global layer (no scope) must not resolve any bundled skill at all.',
    '  for (const bundled of ' + JSON.stringify(SKILLS) + ') {',
    "    if (await ctx.skills.get(bundled, { cwd }) !== undefined) throw new Error('bundled skill reachable from the global layer: ' + bundled)",
    '  }',
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
  // Filter by path, not name: a directory filter can only ever match this
  // package, whatever the workspace root is called.
  expectSuccess('package pack', await execute(pnpm, ['--filter', './packages/dsh-loadout', 'pack', '--pack-destination', packDirectory], projectRoot, env))
  const packageTarball = await tarball(packDirectory, 'dsh-loadout-0.1.0')

  expectSuccess('dsh web plugin add', await execute(process.execPath, [dshBin, 'plugin', '--profile', profile, 'add', packageTarball], dshRoot, env))

  const dump = await execute(process.execPath, [dshBin, '--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after add', dump)
  assert.match(dump.output, /id: loadout-preset/)
  assert.match(dump.output, /name: dsh-loadout\/materialize/)
  assert.match(dump.output, /id: agent-presets/)

  const profileDirectory = join(dshHome, 'profiles', profile)
  await prepareVerifyDriver(profileDirectory, dshHome)
  const boot = await execute(process.execPath, [dshBin, '--profile', profile, '--port', '0', '--no-open'], dshRoot, env)
  expectSuccess('dsh web profile boot with Loadout', boot)
  assert.match(boot.output, /\[loadout-smoke\] roster ok/)

  const presetDir = join(dshHome, '.agent-presets', 'loadout')
  assert.equal(existsSync(join(presetDir, 'agent.cordis.yml')), true)
  assert.equal(existsSync(join(presetDir, 'preset.yml')), true)
  assert.equal(existsSync(join(presetDir, '.loadout-materialized.json')), true)
  for (const skill of SKILLS) assert.equal(existsSync(join(presetDir, 'skills', skill, 'SKILL.md')), true, skill + ' materialized')

  expectSuccess('dsh web plugin remove', await execute(process.execPath, [dshBin, 'plugin', '--profile', profile, 'remove', 'dsh-loadout'], dshRoot, env))
  await preparePostRemoveDriver(profileDirectory)
  expectSuccess('dsh web profile boot after removal', await execute(process.execPath, [dshBin, '--profile', profile, '--port', '0', '--no-open'], dshRoot, env))
  assert.equal(existsSync(presetDir), false, 'the supported authoring delete removed the preset directory')

  await writeFile(join(profileDirectory, 'cordis.patch.yml'), '# Your patch layer for this dsh profile, applied after every bundle layer:\n[]\n')
  const afterRemove = await execute(process.execPath, [dshBin, '--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after remove', afterRemove)
  assert.doesNotMatch(afterRemove.output, /loadout/)
  assert.match(afterRemove.output, /id: agent-presets/)

  process.stdout.write('Loadout DSH smoke passed: one bundle install on the real web profile, roster + cold full-preset mount, five bundled skills served from the preset\'s own root and unreachable from the global layer, clean two-stage removal.\n')
} finally {
  await rm(scratch, { force: true, recursive: true })
}
