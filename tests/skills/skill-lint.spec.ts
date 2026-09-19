// Per-skill contract for the bundled skills: DSH frontmatter grammar, the
// catalog budget for descriptions, the on-demand budget for bodies, one
// example at most, no foreign vocabulary, references only within the set.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  BANNED_TOKENS,
  BUNDLED_SKILLS,
  SKILL_BODY_MAX_CHARACTERS,
  SKILL_DESCRIPTION_MAX_CHARACTERS,
  SKILL_MAX_EXAMPLES,
  SKILL_NAME,
} from '../contract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const skillsRoot = resolve(here, '../../packages/dsh-loadout/preset/loadout/skills')

interface ParsedSkill {
  readonly name: string
  readonly description: string
  readonly body: string
}

/** Parse one SKILL.md body; tolerant of CRLF so a checkout without .gitattributes still lints. */
export function parseSkillText(text: string, label: string): ParsedSkill {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (match === null) throw new Error(label + ': SKILL.md must open with a YAML frontmatter block')
  const frontmatter = load(match[1]!) as Record<string, unknown>
  return { name: String(frontmatter.name), description: String(frontmatter.description), body: match[2]!.replace(/\r\n/g, '\n') }
}

function parseSkill(dir: string): ParsedSkill {
  return parseSkillText(readFileSync(join(skillsRoot, dir, 'SKILL.md'), 'utf8'), dir)
}

const present = existsSync(skillsRoot) ? readdirSync(skillsRoot).sort() : []

describe('Loadout bundled skills', () => {
  for (const dir of present) {
    describe(dir, () => {
      const skill = parseSkill(dir)

      it('has a kebab-case name equal to its directory', () => {
        expect(dir).toMatch(SKILL_NAME)
        expect(skill.name).toBe(dir)
      })

      it('has a trigger-carrying description within the catalog budget', () => {
        expect(skill.description).toMatch(/^Use /)
        expect(skill.description.length).toBeGreaterThan(40)
        expect(skill.description.length).toBeLessThanOrEqual(SKILL_DESCRIPTION_MAX_CHARACTERS)
      })

      it('keeps the body within the on-demand budget', () => {
        expect(skill.body.trim().length).toBeLessThanOrEqual(SKILL_BODY_MAX_CHARACTERS)
      })

      it('carries at most one fenced example', () => {
        const fences = (skill.body.match(/^```/gm) ?? []).length
        expect(fences % 2).toBe(0)
        expect(fences / 2).toBeLessThanOrEqual(SKILL_MAX_EXAMPLES)
      })

      it('carries no vocabulary from another harness', () => {
        for (const token of BANNED_TOKENS) {
          expect(skill.description + '\n' + skill.body, String(token)).not.toMatch(token)
        }
      })

      it('references only bundled skills', () => {
        // Every cross-reference is phrased "the <name> skill"; the article keeps
        // phrases like "every skill" out, and the name may be a single word.
        const refs = [...skill.body.matchAll(/\bthe ([a-z0-9]+(?:-[a-z0-9]+)*) skill\b/g)].map(match => match[1]!)
        for (const ref of refs) expect(BUNDLED_SKILLS, ref).toContain(ref)
      })
    })
  }

  it('ships exactly the bundled set the persona names', () => {
    expect(present).toEqual([...BUNDLED_SKILLS].sort())
  })

  it('parses a CRLF checkout the same as an LF one', () => {
    const lf = '---\nname: sample\ndescription: Use when sampling.\n---\n# Sample\n\nBody line.\n'
    const crlf = lf.replace(/\n/g, '\r\n')
    expect(parseSkillText(crlf, 'sample')).toEqual(parseSkillText(lf, 'sample'))
  })
})
