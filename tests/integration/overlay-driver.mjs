import assert from 'node:assert/strict'
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt'

export const name = 'loadout-verify'
export const inject = ['agentPresets', 'pluginManager', 'skills', 'systemPrompt']

const bundleName = 'dsh-loadout'
const personaNames = new Set(['deployment:persona-prefix', 'deployment:persona-suffix'])
const context = {
  cwd: process.cwd(),
  modelSelection: { provider: 'smoke', model: 'loadout-smoke' },
}

async function verifyToggle(ctx, bundledSkills) {
  const bundle = () => ctx.pluginManager.listBundles().then(bundles => bundles.find(item => item.name === bundleName))

  async function toggle(enabled) {
    const result = await ctx.pluginManager.setBundleEnabled(bundleName, enabled)
    assert.equal(result.application, 'applied', JSON.stringify(result))
    const current = await bundle()
    assert.equal(current?.installed, true)
    assert.equal(current?.enabled, enabled)
  }

  const roster = await ctx.agentPresets.list()
  assert.equal(roster.some(preset => preset.id === 'loadout'), false, 'Loadout must not register a mode')
  assert.equal((await bundle())?.enabled, true, 'CLI install should enable the bundle')

  await using leases = new AsyncDisposableStack()
  const modeIds = ['standard', 'ptc', 'cordis', 'minimal']
  const modes = await Promise.all(modeIds.map(async id => {
    const lease = leases.use(await ctx.agentPresets.acquireScope(id))
    const options = { ...context, scope: lease.key }
    return {
      id,
      options,
      assembly: await ctx.systemPrompt.assemble(options),
      document: await ctx.agentPresets.readDocument(id),
    }
  }))

  await toggle(false)
  assert.deepEqual(await ctx.agentPresets.list(), roster)
  for (const mode of modes) {
    const original = await ctx.systemPrompt.assemble(mode.options)
    const originalPrompt = renderPrompt(original)
    const activePrompt = renderPrompt(mode.assembly)
    assert.deepEqual(await ctx.agentPresets.readDocument(mode.id), mode.document)
    assert.deepEqual(mode.assembly.tools, original.tools, mode.id + ' tools changed')
    assert.deepEqual(mode.assembly.variables, original.variables, mode.id + ' variables changed')
    assert.deepEqual(mode.assembly.contexts.map(item => item.name), original.contexts.map(item => item.name))
    assert.deepEqual(
      mode.assembly.sections.filter(section => !personaNames.has(section.name)),
      original.sections.filter(section => !personaNames.has(section.name)),
      mode.id + ' non-persona sections changed',
    )
    assert.doesNotMatch(originalPrompt, /Writing rules \(Stop Slop\)/)
    if (mode.id === 'minimal') {
      assert.equal(activePrompt, originalPrompt, 'DSH protects complete prompts')
    } else {
      assert.notEqual(activePrompt, originalPrompt)
      assert.match(activePrompt, /Model: loadout-smoke\./)
      for (const heading of ['Task execution:', 'Code changes:', 'Delivery:', 'Writing rules (Stop Slop):']) {
        assert.ok(activePrompt.includes(heading), mode.id + ' missing ' + heading)
      }
    }
    const snapshot = await ctx.skills.snapshot(mode.options)
    assert.ok(snapshot.complete)
    mode.originalSkills = snapshot.skills.map(skill => skill.name)
    for (const name of bundledSkills) assert.ok(!mode.originalSkills.includes(name), name + ' still available while off')
  }

  await toggle(true)
  assert.deepEqual(await ctx.agentPresets.list(), roster)
  for (const mode of modes) {
    const active = await ctx.systemPrompt.assemble(mode.options)
    assert.deepEqual(active.sections, mode.assembly.sections, 're-enabling changed the prompt for ' + mode.id)
    assert.deepEqual(active.tools, mode.assembly.tools)
    const snapshot = await ctx.skills.snapshot(mode.options)
    assert.ok(snapshot.complete)
    const names = new Set(snapshot.skills.map(skill => skill.name))
    for (const name of [...mode.originalSkills, ...bundledSkills]) {
      assert.ok(names.has(name), name + ' missing while on')
    }
  }

  const options = modes[0].options
  for (const name of bundledSkills) {
    const skill = await ctx.skills.get(name, options)
    assert.equal(skill?.provider, 'loadout')
    assert.equal(skill?.source, 'custom')
    assert.match(skill.content, /^##? /m, name + ' should load its text from the installed package')
  }
  console.log('[loadout-smoke] on/off/on preserved the native modes, tools and skill catalogs')
}

export function apply(ctx, { removed = false, bundledSkills = [] }) {
  const ready = ctx.get('appReady')
  const exit = ctx.get('appExit')
  if (!ready || !exit) throw new Error('missing launcher lifecycle')

  async function run() {
    if (removed) {
      const bundles = await ctx.pluginManager.listBundles()
      assert.ok(!bundles.some(bundle => bundle.name === bundleName))
      assert.doesNotMatch(renderPrompt(await ctx.systemPrompt.assemble(context)), /Writing rules \(Stop Slop\)/)
    } else {
      await verifyToggle(ctx, bundledSkills)
    }
  }

  ctx.effect(() => ready.onReady(() => {
    void run().then(() => exit(0), error => {
      console.error(error)
      exit(1)
    })
  }), 'loadout verification')
}
