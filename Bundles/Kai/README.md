<p align="center">
  <img src="kai.png" alt="The Official PAI (Kai) Bundle" width="256">
</p>

# The Official PAI (Kai) Bundle v1.3.0

> **FOR AI AGENTS:** You are about to install the complete Kai bundle. Run the wizard, then install each pack in order.

## Quick Start

```bash
# Run the installation wizard
bun run install.ts
```

The wizard will:
1. **Detect existing AI systems** - Scans for Claude Code, Cursor, Windsurf, Cline, Aider, Continue
2. **Show you what it found** and explain what will be backed up
3. **Ask for your confirmation** before making any changes
4. **Create a safety backup** of your existing `~/.claude` directory to `~/.claude-BACKUP`
5. **Ask a few questions** (your name, AI name, timezone, voice preference)
6. **Install directly to `~/.claude`** - the standard Claude Code location
7. **Configure environment variables** automatically

**Safety First:** The installer will not modify anything until you explicitly confirm. Your original files are always preserved in the backup.

---

## What This Bundle Provides

When fully installed, the Kai bundle gives you:

- A custom **History system** - Automatically captures sessions, decisions, learnings, and research
- A custom set of **Hooks** - Event-driven automation that triggers on session start, tool use, and task completion
- A custom **Skill system** - Modular capabilities that route based on intent
- A custom **Voice notification system** - Spoken updates with cascading TTS (Piper → ElevenLabs → macOS)
- A custom **Agent swarm creation system** - Spawn parallel agents with personality templates
- A custom **Security control system** - Protection against prompt injection and dangerous operations

---

## Installation Order (CRITICAL)

**After running the wizard, install these packs IN ORDER:**

| # | Pack | Purpose | Dependencies |
|---|------|---------|--------------|
| 1 | [kai-hook-system](../../Packs/kai-hook-system.md) | Event-driven automation | None |
| 2 | [kai-history-system](../../Packs/kai-history-system.md) | Memory and capture | Hooks |
| 3 | [kai-core-install](../../Packs/kai-core-install.md) | Skills + Identity + Architecture | Hooks, History |
| 4 | [kai-voice-system](../../Packs/kai-voice-system.md) | Voice notifications (optional) | Hooks, Core |

### How to Install Packs

Give each pack file to your AI and ask it to install:

```
"Install kai-hook-system pack"
```

The AI will read the pack and follow the installation instructions inside.

### Why Order Matters

- **Hooks** are the foundation - they enable all event-driven automation
- **History** uses hooks to capture events and context
- **Core Install** provides skill routing and identity framework
- **Voice** uses hooks for completion events (no API key required with Piper)

---

## Voice TTS Options

The bundle supports three TTS providers with automatic fallback:

| Provider | Type | Quality | Cost | Setup |
|----------|------|---------|------|-------|
| **Piper** (default) | Local neural | High | Free | Auto-installed (~60MB model) |
| **ElevenLabs** | Cloud API | Very High | Usage limits | Requires API key |
| **macOS say** | Built-in | Basic | Free | Zero setup |

During installation, you can choose your preferred provider. The system automatically falls back through the chain if a provider fails.

### Configuration

After installation, you can change providers in `~/.claude/.env`:

```bash
# Options: 'piper' | 'elevenlabs' | 'macos'
TTS_PROVIDER="piper"

# For ElevenLabs (optional)
# ELEVENLABS_API_KEY="your_key"
# ELEVENLABS_VOICE_ID="voice_id"

# For macOS (optional)
# MACOS_VOICE="Samantha"  # Run 'say -v ?' for options
```

---

## Prerequisites

- [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- [Claude Code](https://claude.com/claude-code) or compatible AI coding assistant

---

## Verification

After installing all packs:

```bash
# Check directory structure
ls -la ~/.claude/

# Expected directories:
# hooks/       - Event-driven automation
# history/     - Sessions, Learnings, Research, Decisions
# skills/      - CORE and other skills
# tools/       - CLI utilities
# voice/       - Voice server files (if installed)

# Check hooks are registered
cat ~/.claude/settings.json | grep -A 5 "hooks"

# Restart Claude Code to activate all hooks
```

---

## Restoring from Backup

If something goes wrong:

```bash
# Remove the new installation
rm -rf ~/.claude

# Restore from backup
mv ~/.claude-BACKUP ~/.claude
```

---

## What Are Packs and Bundles?

**Packs** are complete subsystems organized around a single capability. For example, `kai-hook-system` provides an entire event-driven automation framework.

**Bundles** are curated combinations of packs designed to work together. The Kai Bundle is 4 packs that form a complete AI infrastructure.

---

## The 14 Founding Principles

The Kai system embeds these principles from [PAI](https://danielmiessler.com/blog/personal-ai-infrastructure):

1. **Clear Thinking + Prompting is King** - Good prompts come from clear thinking
2. **Scaffolding > Model** - Architecture matters more than which model
3. **As Deterministic as Possible** - Templates and consistent patterns
4. **Code Before Prompts** - Use AI only for what actually needs intelligence
5. **Spec / Test / Evals First** - Write specifications and tests before building
6. **UNIX Philosophy** - Do one thing well, make tools composable
7. **ENG / SRE Principles** - Treat AI infrastructure like production software
8. **CLI as Interface** - Command-line is faster and more reliable
9. **Goal → Code → CLI → Prompts → Agents** - The decision hierarchy
10. **Meta / Self Update System** - Encode learnings so you never forget
11. **Custom Skill Management** - Modular capabilities that route intelligently
12. **Custom History System** - Everything worth knowing gets captured
13. **Custom Agent Personalities** - Different work needs different approaches
14. **Science as Cognitive Loop** - Hypothesis → Experiment → Measure → Iterate

---

## Changelog

### 1.3.0 - 2026-01-04
- **Cascading TTS System:** Voice notifications now support three providers with automatic fallback
- **Piper TTS (default):** Free, local neural TTS - no API key required, ~60MB model
- **ElevenLabs:** Cloud TTS still supported for high-quality voices
- **macOS say:** Built-in fallback that always works
- **Auto-install:** Piper and voice model are automatically installed during setup
- **TTS_PROVIDER config:** Switch providers via environment variable

### 1.2.0 - 2025-12-30
- **AI System Detection:** Scans for Claude Code, Cursor, Windsurf, Cline, Aider, Continue
- **Clear Communication:** Shows exactly what was detected and what will be backed up
- **Explicit Confirmation:** Asks permission before making any changes to your system
- **Safety-first approach:** No modifications until user confirms

### 1.1.0 - 2025-12-30
- Now installs directly to `~/.claude` instead of configurable `$PAI_DIR`
- Automatic backup to `~/.claude-BACKUP` before installation
- Environment variables set automatically (no manual shell sourcing needed)
- Simplified: Removed personality calibration questions - just name, timezone, voice
- Simplified: Removed technical preference questions - use sensible defaults
- Simplified: Removed "open another terminal" instructions

### 1.0.0 - 2025-12-29
- Initial release with full wizard

---

## Credits

**Author:** Daniel Miessler
**Origin:** Extracted from production Kai system (2024-2025)
