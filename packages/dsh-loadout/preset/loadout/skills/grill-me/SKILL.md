---
name: grill-me
description: Use when the user asks for development but the requirements, scope, constraints, or success criteria are unclear. Inspect context, ask one decision at a time with a recommendation, then summarize the agreed requirements.
---

# Grill Me

Turn an incomplete development request into agreed requirements before building.

## Rules

1. **Map the missing requirements.** Identify the outcome, users, scope, constraints, success criteria, and meaningful edge cases. Ask only about gaps that could change the delivered result.
2. **Facts are not questions.** Anything the repository, config, database, or history can answer, look up yourself first. Only decisions that are the user's to make reach the user.
3. **One question per message.** Wait for the answer before the next. Several questions at once get one vague answer.
4. **Every question carries a recommendation and its reason**, grounded in what you looked up, so the user can answer "yes, that".
5. **Stop when the request is actionable.** Do not delay on reversible implementation details. "Do it your way" authorizes your recommendation for remaining user-owned choices.

## Closing

1. Summarize the agreed requirements in 2-5 sentences: intended outcome, scope, constraints, and verification.
2. If the request is to implement, continue with the brainstorming skill only when material design choices remain; otherwise implement.

## Example

User: "Build a page where customers can track their orders."

Facts first: inspect the existing app, data model, and customer flows. Then, one at a time:

- "I found orders but no customer order view. I recommend a signed-in customer's list with status, total, and detail link as the first scope. Is that the intended user and scope?"
- (after the answer) "Should customers only view orders, or can they cancel eligible orders? I recommend view-only for this change because cancellation needs fulfilment rules."

## Why

An incomplete request invites guesses about the product. Resolving the choices that affect the delivered result before work avoids rework while leaving routine implementation decisions to the agent.
