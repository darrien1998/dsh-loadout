// One Loadout bundle install on the REAL pinned DSH web profile.
//
// pack the package -> 'dsh plugin --profile web add' the tarball ->
// dump-config -> boot the web profile ('--port 0') with a verification driver
// that reads the native roster, cold-mounts the loadout composition, lists the
// bundled skills through the skill registry in the preset's scope, loads one,
// and proves nothing leaked into the global layer -> remove -> boot a
// post-remove driver that checks declaration removal.
//
// Uses the published runtime by default; DSH_SOURCE_DIR selects a built checkout. Uses a temporary DSH_HOME and removes it afterward.
// Boots with --no-open so no browser tab opens.
import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strict as assert } from 'node:assert'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')
const dshBin = process.env.DSH_SOURCE_DIR
  ? resolve(process.env.DSH_SOURCE_DIR, 'apps/cli/lib/bin.js')
  : fileURLToPath(import.meta.resolve('@deepseek-ai/dsh/lib/bin.js'))
const dshRoot = projectRoot
const pnpm = process.env.LOADOUT_PNPM ?? (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
const profile = 'web'
const SKILLS = ['brainstorming', 'grill-me', 'systematic-debugging', 'test-driven-development', 'verification-before-completion', 'stop-slop']

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
    const executable = shell && /\s/.test(command) ? '"' + command + '"' : command
    const child = spawn(executable, spawnArgs, {
      cwd,
      env,
      shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const timeout = setTimeout(() => { output += '\nCommand exceeded 120 seconds'; child.kill() }, 120_000)
    child.stdout.on('data', chunk => { output += String(chunk) })
    child.stderr.on('data', chunk => { output += String(chunk) })
    child.once('error', error => { clearTimeout(timeout); reject(error) })
    child.once('close', code => { clearTimeout(timeout); resolveResult({ code: code ?? 1, output }) })
  })
}

/** LOADOUT_DSH selects an installed Desktop carrier for cross-version verification. */
function executeDsh(args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Promise<CommandResult> {
  const carrier = process.env.LOADOUT_DSH
  return execute(carrier ?? process.execPath, carrier ? args : [dshBin, ...args], cwd, env)
}

function expectSuccess(label: string, result: CommandResult): void {
  assert.equal(result.code, 0, label + ' failed:\n' + result.output.replace(/([?&]token=)[^\s]+/g, '$1[redacted]'))
  process.stdout.write('[loadout-smoke] ' + label + ' passed\n')
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
    "import { renderPrompt } from '@deepseek-ai/dsh-system-prompt'",
    "export const name = 'loadout-verify'",
    "export const inject = ['agentPresets', 'skills', 'systemPrompt']",
    'export function apply(ctx) {',
    "  const ready = ctx.get('appReady')",
    "  const exit = ctx.get('appExit')",
    "  if (!ready || !exit) throw new Error('missing launcher lifecycle')",
    '  const run = async () => {',
    '  const listed = await ctx.agentPresets.list()',
    "  const loadout = listed.find(p => p.id === 'loadout')",
    "  if (loadout === undefined) throw new Error('loadout preset missing from the native roster: ' + listed.map(p => p.id).join(','))",
    "  if (loadout.name !== 'Loadout') throw new Error('display name mismatch: ' + JSON.stringify(loadout.name))",
    "  if (loadout.broken !== undefined) throw new Error('preset reported broken: ' + loadout.broken)",
    "  const standard = listed.find(p => p.id === 'standard')",
    "  if (standard === undefined) throw new Error('native Standard preset missing')",
    '  // Cold-mount the FULL loadout composition against the real web host plane:',
    '  // rejects unless every row activates.',
    "  await using lease = await ctx.agentPresets.acquireScope('loadout')",
    '  const scope = lease.key',
    '  const cwd = process.cwd()',
    "  const prompt = renderPrompt(await ctx.systemPrompt.assemble({ scope, cwd, modelSelection: { provider: 'smoke', model: 'loadout-smoke' } }))",
    "  if (!prompt.includes('Writing rules (Stop Slop)') || !prompt.includes('Cut filler')) throw new Error('Stop Slop absent from rendered system prompt before any skill is loaded')",
    "  if (!prompt.includes('Model: loadout-smoke.')) throw new Error('persona template did not render')",
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
    "  const presetDir = " + JSON.stringify(join(dshHome, 'profiles', profile, 'node_modules')) + "",
    "  if (typeof loaded.path !== 'string' || !loaded.path.startsWith(presetDir)) throw new Error('skill loaded from ' + loaded.path + ', expected under ' + presetDir)",
    "  if (!loaded.content.includes('Phase 1')) throw new Error('loaded body is not the shipped skill')",
    "  const stopSlop = await ctx.skills.get('stop-slop', { scope, cwd })",
    "  if (!stopSlop?.content.includes('Core rules')) throw new Error('Stop Slop body missing')",
    "  const document = await ctx.agentPresets.readDocument('loadout')",
    "  if (!document.content.includes('Writing rules (Stop Slop)')) throw new Error('always-active writing rules missing')",
    '  // Isolation: with hermetic homes, the global layer (no scope) must not resolve any bundled skill at all.',
    '  for (const bundled of ' + JSON.stringify(SKILLS) + ') {',
    "    if (await ctx.skills.get(bundled, { cwd }) !== undefined) throw new Error('bundled skill reachable from the global layer: ' + bundled)",
    '  }',
    "  process.stdout.write('[loadout-smoke] roster ok, composition mounted, ' + names.length + ' skills in scope, isolation ok\\n')",
    '  }',
    "  ctx.effect(() => ready.onReady(() => { void run().then(() => exit(0), error => { console.error(error); exit(1) }) }), 'loadout verification')",
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

/** Post-remove driver: the removed bundle no longer declares a preset. */
async function preparePostRemoveDriver(profileDirectory: string): Promise<void> {
  await writeFile(join(profileDirectory, 'loadout-postremove.mjs'), [
    "export const name = 'loadout-postremove'",
    "export const inject = ['agentPresets']",
    'export function apply(ctx) {',
    "  const ready = ctx.get('appReady')",
    "  const exit = ctx.get('appExit')",
    "  if (!ready || !exit) throw new Error('missing launcher lifecycle')",
    '  const run = async () => {',
    '  const before = await ctx.agentPresets.list()',
    "  if (before.some(p => p.id === 'loadout')) throw new Error('removed bundle still declares loadout')",
    '  }',
    "  ctx.effect(() => ready.onReady(() => { void run().then(() => exit(0), error => { console.error(error); exit(1) }) }), 'loadout verification')",
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
  const packageTarball = await tarball(packDirectory, 'dsh-loadout-0.2.1')

  expectSuccess('dsh web plugin add', await executeDsh(['plugin', '--profile', profile, 'add', packageTarball], dshRoot, env))

  const dump = await executeDsh(['--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after add', dump)
  assert.match(dump.output, /id: preset-loadout/)
  assert.match(dump.output, /name:.*dsh-agent-preset/)
  assert.match(dump.output, /id: agent-preset-registry/)

  const profileDirectory = join(dshHome, 'profiles', profile)
  await prepareVerifyDriver(profileDirectory, dshHome)
  const boot = await executeDsh(['--profile', profile, '--port', '0', '--no-open'], dshRoot, env)
  expectSuccess('dsh web profile boot with Loadout', boot)
  assert.match(boot.output, /\[loadout-smoke\] roster ok/)

  expectSuccess('dsh web plugin remove', await executeDsh(['plugin', '--profile', profile, 'remove', 'dsh-loadout'], dshRoot, env))
  await preparePostRemoveDriver(profileDirectory)
  expectSuccess('dsh web profile boot after removal', await executeDsh(['--profile', profile, '--port', '0', '--no-open'], dshRoot, env))

  await writeFile(join(profileDirectory, 'cordis.patch.yml'), '# Your patch layer for this dsh profile, applied after every bundle layer:\n[]\n')
  const afterRemove = await executeDsh(['--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after remove', afterRemove)
  assert.doesNotMatch(afterRemove.output, /loadout/)
  assert.match(afterRemove.output, /id: agent-preset-registry/)

  process.stdout.write('Loadout DSH smoke passed: one bundle install on the real web profile, roster + cold full-preset mount, six bundled skills served from the installed package and unreachable from the global layer, declaration removal.\n')
} finally {
  await rm(scratch, { force: true, recursive: true })
}
