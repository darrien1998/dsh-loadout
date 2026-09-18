---
name: grill-me
description: Use when the user proposes a plan, feature, architecture, or multi-file change and wants it examined before building - "grill me", "does this design make sense". Decision tree, one question per message, each with a recommended answer. Not for single fully specified actions.
---

# Grill Me

Turn an unexamined plan into agreed decisions before anything is built.

## Rules

1. **Map the decision tree.** Break the plan into decision points, including branches and edge cases below the level the user described. For each one ask: what does this decision force next?
2. **Facts are not questions.** Anything the repository, config, database, or history can answer, look up yourself first. Only decisions that are the user's to make reach the user.
3. **One question per message.** Wait for the answer before the next. Several questions at once get one vague answer.
4. **Every question carries a recommendation and its reason**, grounded in what you looked up, so the user can answer "yes, that".
5. **No work before consensus.** No code, no file changes, no tasks until every branch is settled. "Stop asking, do it your way" authorizes your recommendation for every remaining branch.

## Closing

1. Summarize the agreed plan in 2-5 sentences: each decision and why. Ask the user to confirm.
2. On confirmation, continue with the normal flow: the brainstorming skill for design, the test-driven-development skill for implementation.

## Example

User: "The DRE category name in the plan-categories table needs to change."

Facts first: read the table definition, the requirement document, and the change-marker convention. Then, one at a time:

- "DRE is currently 'Dream Plan'; the document says 'Goal Plan'. I recommend the document's name, since it is the latest confirmed one. Use it?"
- (after the answer) "Only DRE this time? CP reads 'Home Plan' here but 'Car Plan' in the document, which collides with HP. Fix it together?"

## Why

A model treats the first sentence as the whole spec and fills the rest with confident guesses. A guess found before work costs one message; a guess found after costs the rework.
