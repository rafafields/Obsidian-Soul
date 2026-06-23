# Soul — Obsidian AI Agent

A minimal AI agent plugin for Obsidian with transparent, vault-based long-term memory and customizable soul personalities.

All agent state — personality, configuration, memory — lives as human-readable and editable `.md` files directly in your vault. Nothing is hidden. No opaque databases, no embeddings, no black boxes.

## Features

- **Chat sidebar** — talk to your agent from a persistent panel in the right sidebar
- **Soul personalities** — create and switch between distinct agent personalities via the Soul Generator; each soul can pin its own model
- **Long-term memory** — the agent extracts and remembers relevant information across sessions
- **Full transparency** — every memory item, episode summary, and API trace is a readable `.md` file in `_agent/`
- **Human review** — memory candidates are written with `state: pending` so you approve them before they're used in context
- **Configurable context** — token budget, importance threshold, and episode history are all adjustable
- **Multilingual** — response language is configurable per-installation
- **Council mode** — run multiple souls in a single conversation and let them respond together

## Requirements

- An [OpenRouter](https://openrouter.ai) API key
- Obsidian 1.4.0 or later

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Copy them to `<vault>/.obsidian/plugins/obsidian-soul/`
3. Enable the plugin under **Settings → Community plugins**
4. Complete the setup wizard (runs automatically on first load)
5. Add your OpenRouter API key under **Settings → Soul**

### BRAT (beta)

Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) and add `Rafafields/obsidian-soul` as a beta plugin.

## Vault structure

The plugin creates and manages two top-level folders:

```
_agent/
  souls/
    default.md           # Default soul (created by setup wizard)
    *.md                 # Additional souls created with Soul Generator
    _souls.base          # Obsidian Bases view for souls
  user.md                # Your profile — work style, preferences
  taxonomy.md            # Authorized tag vocabulary
  memory/
    active.md            # Current working memory (updated each session)
    episodes/            # Session summaries — one .md file per session
      _episodes.base     # Obsidian Bases view for episodes
    items/               # All memory items (pending + confirmed + archived)
      _memory-items.base # Obsidian Bases view for memory items
_system/
  traces/                # Raw API call traces (auto-deleted per retention setting)
    _traces.base         # Obsidian Bases view for traces
```

## Memory workflow

After you click **Finalize and memorize** (or the idle timer fires), the agent:

1. Writes a session summary to `_agent/memory/episodes/YYYY-MM-DD-HH-MM.md`
2. Sends the transcript to a second LLM call that extracts 0–5 memory candidates
3. Writes candidates to `_agent/memory/items/` with `state: pending`

To review candidates:
- **Edit** the file and change `state: pending` to `state: active` → confirmed, used in future sessions
- **Delete** the file → discarded, logged in `_system/traces/`

The vault hooks watch these actions in real time — no manual steps beyond editing or deleting the file.

## Context assembly

Before every message, the system prompt is built in three layers within a fixed token budget (default: 8 000 tokens):

| Layer | Budget | Content |
|-------|--------|---------|
| Bootstrap | ~700 tok, always | Soul file · `user.md` · `taxonomy.md` · `active.md` |
| Episodic | ~400 tok | Today's and yesterday's episode summaries |
| Semantic | Remaining | Confirmed memory items, ranked by score |

Memory items are ranked by: `importance_weight + tier_bonus − staleness_penalty`. Items that don't fit the remaining budget are dropped (never truncated mid-content).

## Available models

All model calls go through [OpenRouter](https://openrouter.ai). The plugin ships with a curated list of pre-configured models. Any OpenRouter model slug can be entered manually.

| Model | Provider | Tier |
|-------|----------|------|
| GPT-5.4 Nano | OpenAI | Budget |
| Qwen 3.5 27B | Qwen | Budget |
| Claude Sonnet 4.6 | Anthropic | Standard |

## Development

```bash
npm install      # install dependencies
npm run dev      # compile with watch mode (esbuild)
npm run build    # typecheck + production build
npm run lint     # run eslint
npm test         # run tests
```

To test locally: copy `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/obsidian-soul/`, then reload Obsidian and enable the plugin under **Settings → Community plugins**.

## License

[0BSD](LICENSE)
