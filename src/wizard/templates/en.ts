export const GETTING_STARTED = `# Getting Started with Minimal Agent

Your agent lives entirely inside this vault. Its personality, memory, and knowledge about you are stored as plain Markdown files you can read and edit at any time.

## Vault structure

\`\`\`
_agent/
  souls/          ← agent personalities (editable)
  user.md         ← how the agent models you (editable)
  taxonomy.md     ← authorized tag vocabulary
  memory/
    active.md     ← working memory (updated each session)
    episodes/     ← session summaries
    items/        ← confirmed long-term memory
_system/          ← reference docs and raw traces (read-only)
\`\`\`

## Memory flow

Each conversation follows this cycle:

1. **Context assembly** — the agent reads \`active.md\`, recent episodes, and high-scored memory items within a token budget.
2. **During the session** — \`active.md\` is updated after each exchange.
3. **Finalize** — click *Finalize and memorize* (or let the idle timer fire) to extract memory candidates from the transcript.
4. **Review** — candidates appear in \`memory/items/\` with [[pending]] state. Confirm the ones worth keeping by changing state to [[active]], or delete to discard.

## Context layers

| Layer | Source | Budget |
|-------|--------|--------|
| [[working\\|Working]] | \`active.md\` + soul + \`user.md\` | Always included (~700 tokens) |
| Episodic | Last 1–2 episode files | Always included (~400 tokens) |
| [[semantic\\|Semantic]] | Confirmed items, ranked by score | Remaining budget |

## Memory item lifecycle

[[pending]] → [[active]] → [[stale]] / [[archived]]

Items are scored by importance, tier, and recency. See [[semantic]] for how scores affect context inclusion.

## Memory item kinds

| Kind | Use when… |
|------|-----------|
| [[decision]] | a choice with lasting implications |
| [[insight]] | a pattern or realization |
| [[constraint]] | a hard limit or non-negotiable |
| [[risk]] | an open threat or uncertainty |
| [[summary]] | a compressed account of a topic |
| [[pattern]] | a recurring behavior or tendency |

## Tips

- Edit \`user.md\` freely — it shapes every conversation.
- The agent never writes to \`soul.md\` or \`user.md\` directly; those are yours.
- Adjust \`taxonomy.md\` to control what tags the agent can assign.
- Browse \`_system/\` to understand the vocabulary used in memory item frontmatter.
`;

export const SYSTEM_NOTES: [string, string][] = [
	['_system/memory_tiers/working.md', `# Working Memory

The agent's short-term state, stored in \`_agent/memory/active.md\`. Updated section-by-section after each conversation turn and always included in context, regardless of token budget.

Contains current focus, recent decisions, blockers, and next step. Old content is gradually replaced as new sessions update each section.`],

	['_system/memory_tiers/semantic.md', `# Semantic Memory

The long-term knowledge layer, made up of confirmed memory items in \`_agent/memory/items/\`. Each item has a score computed from importance, tier bonus, and staleness penalty.

During context assembly, the highest-scoring items are included until the remaining token budget is exhausted. Items with state [[stale]] or [[archived]] are excluded.`],

	['_system/memory_kinds/decision.md', `# Decision

A choice made with deliberate intent, with implications that persist across sessions. Use this to remember why something was decided: strategy shifts, personal commitments, architectural choices.`],

	['_system/memory_kinds/insight.md', `# Insight

A pattern or realization derived from experience. Use this when a session surfaces something non-obvious: a connection between ideas, a lesson learned, a model update about how something works.`],

	['_system/memory_kinds/constraint.md', `# Constraint

A hard limit that shapes what is possible. Captures things the agent should never forget: time limits, resource constraints, rules, non-negotiables.`],

	['_system/memory_kinds/risk.md', `# Risk

An open threat, uncertainty, or potential problem worth monitoring. Unlike a [[constraint]] (which is certain), a risk is probabilistic — something that might happen.`],

	['_system/memory_kinds/summary.md', `# Summary

A compressed account of events, context, or a topic. Use for complex subjects that would take too many tokens to store in full — distill the key points.`],

	['_system/memory_kinds/pattern.md', `# Pattern

A recurring behavior, structure, or tendency worth naming. Useful for habits, workflows, or dynamics that appear across multiple sessions.`],

	['_system/states/pending.md', `# Pending

Extracted by the agent and awaiting your review. Items in this state are stored in \`_agent/memory/items/\` but **not included in context** until confirmed.

To confirm: change the state to [[active]] in the file's frontmatter.`],

	['_system/states/active.md', `# Active

Confirmed and eligible for context assembly. Items with this state are included in the [[semantic\\|semantic]] layer based on their score.`],

	['_system/states/stale.md', `# Stale

Expired: the \`expires_at\` date has passed. The plugin automatically marks items stale on load (if *Auto-archive expired items* is enabled in settings). Stale items are excluded from context but remain in the vault.`],

	['_system/states/archived.md', `# Archived

Manually retired. Excluded from context but kept for reference. Use for items that are no longer relevant but you don't want to permanently delete.`],

	['_system/states/confirmed.md', `# Confirmed

Episode state: the session summary has been accepted as part of the permanent record. Confirmed episodes are included in the episodic context layer.`],

	['_system/origins/agent.md', `# Agent

Created by the LLM during session finalization. Memory candidates with this origin are proposals from the agent based on transcript content.`],

	['_system/origins/human.md', `# Human

Created directly by the user. Files edited manually in the vault carry this origin.`],

	['_system/origins/hybrid.md', `# Hybrid

Created collaboratively between user and agent — for example, setup wizard files that combine user input with LLM generation.`],

	['_system/kinds/memory_item.md', `# Memory Item

A discrete piece of long-term memory. Stored as a Markdown file in \`_agent/memory/items/\` with structured frontmatter: state, kind, importance, confidence, tags, expiry date, and origin.`],

	['_system/kinds/memory_episode.md', `# Memory Episode

A session summary generated when a conversation is finalized. Stored in \`_agent/memory/episodes/\` and includes session ID, soul used, token cost, and a compressed transcript.`],

	['_system/kinds/agent_soul.md', `# Agent Soul

Personality and identity definition for an agent. Stored in \`_agent/souls/\` as an editable Markdown file. Includes purpose, values, voice, and optional loading phrases.`],
];
