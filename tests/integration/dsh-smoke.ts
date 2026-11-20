// Exercise the installed tarball and native bundle toggle on the real DSH web profile.
import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strict as assert } from 'node:assert'
import { BUNDLED_SKILLS } from '../contract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')
const dshBin = process.env.DSH_SOURCE_DIR
  ? resolve(process.env.DSH_SOURCE_DIR, 'apps/cli/lib/bin.js')
  : fileURLToPath(import.meta.resolve('@deepseek-ai/dsh/lib/bin.js'))
const dshRoot = projectRoot
const pnpm = process.env.LOADOUT_PNPM ?? (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
const profile = 'web'

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

async function prepareDriver(profileDirectory: string, removed: boolean): Promise<void> {
  await copyFile(join(here, 'overlay-driver.mjs'), join(profileDirectory, 'loadout-verify.mjs'))
  await writeFile(join(profileDirectory, 'cordis.patch.yml'), [
    '- insert:',
    '    - id: loadout-verify',
    '      name: ./loadout-verify.mjs',
    '      config:',
    '        removed: ' + removed,
    '        bundledSkills: ' + JSON.stringify(BUNDLED_SKILLS),
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
  const packageTarball = await tarball(packDirectory, 'dsh-loadout-')

  expectSuccess('dsh web plugin add', await executeDsh(['plugin', '--profile', profile, 'add', packageTarball], dshRoot, env))

  const dump = await executeDsh(['--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after add', dump)
  assert.match(dump.output, /id: loadout-prompt/)
  assert.doesNotMatch(dump.output, /id: preset-loadout/)
  assert.match(dump.output, /id: agent-preset-registry/)

  const profileDirectory = join(dshHome, 'profiles', profile)
  await prepareDriver(profileDirectory, false)
  const boot = await executeDsh(['--profile', profile, '--port', '0', '--no-open'], dshRoot, env)
  expectSuccess('dsh web profile boot with Loadout', boot)
  assert.match(boot.output, /\[loadout-smoke\] on\/off\/on preserved the native modes/)

  expectSuccess('dsh web plugin remove', await executeDsh(['plugin', '--profile', profile, 'remove', 'dsh-loadout'], dshRoot, env))
  await prepareDriver(profileDirectory, true)
  expectSuccess('dsh web profile boot after removal', await executeDsh(['--profile', profile, '--port', '0', '--no-open'], dshRoot, env))

  await writeFile(join(profileDirectory, 'cordis.patch.yml'), '# Your patch layer for this dsh profile, applied after every bundle layer:\n[]\n')
  const afterRemove = await executeDsh(['--profile', profile, '--dump-config'], dshRoot, env)
  expectSuccess('dsh web dump-config after remove', afterRemove)
  assert.doesNotMatch(afterRemove.output, /loadout/)
  assert.match(afterRemove.output, /id: agent-preset-registry/)

  process.stdout.write('Loadout DSH smoke passed: install, live on/off/on, persona and skill restoration, mode parity, and removal.\n')
} finally {
  await rm(scratch, { force: true, recursive: true })
}
