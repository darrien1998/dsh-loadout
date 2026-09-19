// The shipped-content contract shared by the persona and skill lint suites.

/** The five skills the Loadout preset ships, in catalog order. */
export const BUNDLED_SKILLS: readonly string[] = Object.freeze([
  'brainstorming',
  'grill-me',
  'systematic-debugging',
  'test-driven-development',
  'verification-before-completion',
])

/**
 * Vocabulary from the harness these skills were ported from. A rule that
 * names an action DSH does not have is skipped by the model, not obeyed, so
 * none of these may appear in shipped prose.
 */
export const BANNED_TOKENS: readonly RegExp[] = Object.freeze([
  /superpowers:/,
  /\bClaude\b/,
  /\bTodoWrite\b/,
  /\bAskUserQuestion\b/,
  /\bTask tool\b/i,
  /\bSkill tool\b/,
  /\bEnterPlanMode\b/,
  /\bExitPlanMode\b/,
  /your human partner/i,
  /docs\/superpowers/,
])

/** Role-play the persona must not carry: an identity claim or a competence adjective. */
export const ROLE_PLAY_TOKENS: readonly RegExp[] = Object.freeze([
  /\bYou are\b/,
  /\bsenior\b/i,
  /\bexpert\b/i,
  /\bworld-class\b/i,
])

/** Standing persona text is paid on every request; keep it small. Nine rules fit in 1,800. */
export const PERSONA_MAX_CHARACTERS = 1_800

/** DSH shows the model only name + description; the description carries the trigger. */
export const SKILL_DESCRIPTION_MAX_CHARACTERS = 300

/** A skill body is loaded on demand; short and dense beats long and persuasive. */
export const SKILL_BODY_MAX_CHARACTERS = 3_000

/** One example is a safety net for a weak model; two start to dilute. */
export const SKILL_MAX_EXAMPLES = 1

/** DSH skill-name grammar (packages/skill/skill/src/index.ts isSkillName). */
export const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
