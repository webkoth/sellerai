---
name: autoskill
description: |
  Analyze coding sessions to detect corrections and preferences, then propose targeted improvements to Skills used in the session. Use this skill when the user asks to "learn from this session", "update skills", or "remember this pattern". Extracts durable preferences and codifies them into the appropriate skill files.
---

# Autoskill

Analyze coding sessions to extract durable preferences from corrections and approvals, then propose targeted updates to Skills that were active during the session.

## Activation triggers

- "autoskill", "learn from this session", "update skills from these corrections"
- "remember this pattern", "make sure you do X next time"

Do NOT activate for one-off corrections or when the user declines skill modifications.

## Signal detection

Scan the session for:

| Signal type | Priority | Examples |
|-------------|----------|----------|
| Corrections | Highest | "No, use X instead of Y", "We always do it this way", "Don't do X in this codebase" |
| Repeated patterns | High | Same feedback 2+ times, consistent naming/structure choices |
| Approvals | Supporting | "Yes, that's right", "Perfect, keep doing it this way" |

**Ignore:** Context-specific one-offs, ambiguous feedback, contradictory signals (ask for clarification).

## Signal quality filter

Before proposing any change, verify:

1. Was this correction repeated, or stated as a general rule?
2. Would this apply to future sessions, or just this task?
3. Is it specific enough to be actionable?
4. Is this **new information** I wouldn't already know?

Only propose changes that pass all four.

### New information criteria

**Worth capturing:**
- Project-specific conventions (`cn()` not `clsx()`)
- Custom component/utility locations
- Team preferences that differ from defaults
- Domain-specific terminology
- Non-obvious architectural decisions
- Integration/API quirks specific to this stack

**NOT worth capturing:**
- General best practices (DRY, separation of concerns)
- Language/framework conventions
- Common library usage patterns
- Universal security/accessibility practices

Rule: If I'd give the same advice to any project, it doesn't belong in a skill.

## Mapping signals to Skills

- Signal relates to active Skill → update that Skill's `SKILL.md`
- 3+ related signals don't fit any Skill → propose new Skill
- Signal doesn't map to any active Skill → ignore

## Proposal format

For each edit:

```
File: path/to/SKILL.md
Section: [existing section or "new section: X"]
Confidence: HIGH | MEDIUM

Signal: "[exact user quote or paraphrase]"

Current text (if modifying):
> existing content

Proposed text:
> updated content

Rationale: [one sentence]
```

Group by file. Present HIGH confidence first.

## Review flow

```
## autoskill summary

Detected [N] durable preferences from this session.

### HIGH confidence (recommended to apply)
- [change 1]
- [change 2]

### MEDIUM confidence (review carefully)
- [change 3]

Apply high confidence changes? [y/n/selective]
```

Wait for explicit approval before editing any file.

## Applying changes

When approved:
1. Edit the target file with minimal, focused changes
2. If git available, commit: `chore(autoskill): [brief description]`
3. Report what was changed

## Constraints

- Never delete existing rules without explicit instruction
- Prefer additive changes over rewrites
- One concept per change (easy to revert)
- Preserve existing file structure and tone
- When uncertain, downgrade to MEDIUM confidence and ask
