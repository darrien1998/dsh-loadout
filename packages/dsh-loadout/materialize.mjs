// Boot-time preset materialization for the dsh-loadout package.
//
// A plugin row on the HOST plane (inserted by the package's own bundle patch):
// it runs once per boot and materializes the `loadout` preset - composition,
// metadata, and the bundled skills - into DSH's public writable preset root
// (<dshHome>/.agent-presets). Discovery re-reads that root on every list(),
// so the preset is visible to the roster (and the Web picker) in the same
// boot, and the composition's `skill-filesystem` row reads the `skills/`
// directory beside it through `baseUrl`.
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
//                               the new generation is staged beside it and
//                               swapped in whole: 'upgraded'.
//
// Both writes go through a staged tree. A crash before the claiming rename
// leaves only a dot-prefixed staging directory beside the presets, invisible
// to discovery, and no target; the next boot creates cleanly. A crash between
// an upgrade's two renames leaves a dot-prefixed `-previous-` directory and
// no target, never a target whose bytes disagree with its marker; the next
// boot creates cleanly. Stale staging and `-previous-` directories are not
// swept automatically.
//
// Preset and skills are one generation unit on purpose: a user who edits a
// skill keeps that edit forever, at the cost of freezing the whole preset at
// that generation until they migrate by hand.
//
// Removal is NOT this plugin's job: rc.5 provides no uninstall hook for
// removed bundles, and automatic deletion would destroy user edits. The
// supported deletion is DSH's own authoring delete (ctx.agentPresets.remove,
// the same method the Web UI calls). And a materialization failure of any
// kind is logged and skipped, never thrown into the boot: the preset is
// absent that boot and the next boot retries.
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
const SOURCE_PACKAGE = 'dsh-loadout'

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
  // Codepoint order, not locale order: the fingerprint must not shift with the machine's locale.
  for (const [path, content] of entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
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

/** Copy one tree into another; directories merge, files overwrite. Only ever aimed at a fresh staging directory. */
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

/** Stage the complete tree - files AND marker - beside the target. Returns the staging path; the caller claims or swaps it. */
function stageTree(presetRoot, presetId, sourceDir, sourceHash, now) {
  const stage = mkdtempSync(join(presetRoot, '.' + presetId + '-staging-'))
  try {
    copyTree(sourceDir, stage)
    writeFileSync(join(stage, MARKER_FILE), marker(presetId, sourceHash, now))
  } catch (error) {
    // Nothing reached the target; drop the partial stage so nothing occupies the root.
    rmSync(stage, { recursive: true, force: true })
    throw error
  }
  return stage
}

/**
 * Materialize (or safely upgrade) the preset under the harness-home preset
 * root. See the module doc for the decision table.
 *
 * @param home - resolved DeepSeek Harness home (the caller passes resolveDshHome()).
 * @param sourceDir - directory holding the preset files to copy.
 * @param presetId - preset id; defaults to `loadout`.
 * @param now - clock for the marker timestamp; tests pin it.
 * @param onStaged - test seam: invoked after the tree is staged and before the claiming rename (create) or the swap (upgrade).
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
    // safe refresh. Stage the new generation beside the target, move the old
    // generation aside under a dot-prefixed name (invisible to discovery), move
    // the stage in, then drop the old one. A crash between the two renames
    // leaves no target and a dot-prefixed leftover, never a target whose hash
    // disagrees with its marker - so the next boot creates cleanly instead of
    // reporting a user edit that never happened.
    const sourceHash = hashTree(sourceDir)
    const stage = stageTree(presetRoot, presetId, sourceDir, sourceHash, now)
    const retired = join(presetRoot, '.' + presetId + '-previous-' + process.pid + '-' + Date.now())
    try {
      onStaged?.()
      renameSync(target, retired)
      renameSync(stage, target)
    } catch (error) {
      rmSync(stage, { recursive: true, force: true })
      if (!existsSync(target) && existsSync(retired)) renameSync(retired, target)
      throw error
    }
    rmSync(retired, { recursive: true, force: true })
    return {
      action: 'upgraded',
      presetDir: target,
      markerPath,
      markerVersion: existing.version,
      sourceVersion: COMPOSITION_VERSION,
      sourceHash,
      note: 'untouched generation-' + existing.version + ' materialization refreshed to generation-' + COMPOSITION_VERSION,
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
  const stage = stageTree(presetRoot, presetId, sourceDir, sourceHash, now)
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

/** Cordis plugin entry: materialize once per boot, then stay silent. A failure is logged and skipped - the preset is absent this boot and the next boot retries; a convenience row must never make the harness unbootable. */
export function apply(ctx) {
  let report
  try {
    report = materializePreset({ home: resolveDshHome(), sourceDir: presetSourceDir() })
  } catch (error) {
    const line = 'loadout-preset: materialization failed - ' + (error instanceof Error ? error.message : String(error)) + ' (the preset is absent this boot; the next boot retries)'
    if (ctx?.logger?.error) ctx.logger.error(line)
    else console.error(line)
    return
  }
  if (report.action === 'present-outdated' || report.action === 'upgraded') {
    const line = 'loadout-preset: ' + report.action + ' - ' + report.note
    if (ctx?.logger?.warn) ctx.logger.warn(line)
    else console.warn(line)
  }
}
