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
// Preset and skills are one generation unit on purpose: a user who edits a
// skill keeps that edit forever, at the cost of freezing the whole preset at
// that generation until they migrate by hand.
//
// Removal is NOT this plugin's job: rc.5 provides no uninstall hook for
// removed bundles, and automatic deletion would destroy user edits. The
// supported deletion is DSH's own authoring delete (ctx.agentPresets.remove,
// the same method the Web UI calls).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
 * @returns the materialization report: action 'created' | 'upgraded' | 'present' | 'present-outdated' | 'claimed'.
 */
export function materializePreset({ home, sourceDir, presetId = PRESET_ID, now = () => new Date().toISOString() }) {
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
  try {
    // Non-recursive claim: the preset directory itself is the creation lock.
    // A concurrent boot losing the race fails EEXIST and reports `claimed`.
    mkdirSync(target)
  } catch (error) {
    if (existsSync(target)) {
      return { action: 'claimed', presetDir: target, markerPath, note: 'another boot materialized this preset first' }
    }
    throw error
  }
  try {
    copyTree(sourceDir, target)
    writeFileSync(markerPath, marker(presetId, sourceHash, now))
    return { action: 'created', presetDir: target, markerPath, sourceHash }
  } catch (error) {
    // A half-copied directory would occupy the id while discovery lists
    // nothing mountable - roll the claim back so the next boot retries cleanly.
    rmSync(target, { recursive: true, force: true })
    throw error
  }
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
