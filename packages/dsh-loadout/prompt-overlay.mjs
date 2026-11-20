export const name = 'loadout-prompt'
export const inject = ['systemPrompt']

export function apply(ctx, { prefix, suffix }) {
  const persona = new Map([
    ['deployment:persona-prefix', prefix],
    ['deployment:persona-suffix', suffix],
  ])

  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const presentation = await next()
    return {
      ...presentation,
      // The host still owns section order, complete prompts, tools, and runtime context.
      sections: presentation.sections.map(section => (
        persona.has(section.name)
          ? { ...section, text: persona.get(section.name), interpolate: true }
          : section
      )),
    }
  })
}
