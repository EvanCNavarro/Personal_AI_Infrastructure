<p align="center">
  <img src="kai.png" alt="The Official PAI (Kai) Bundle" width="256">
</p>

# The Official PAI (Kai) Bundle v1.5.0

> A complete AI assistant infrastructure with voice notifications, skills system, statusline, and more.

---

## Install From Scratch (5 minutes)

**Prerequisites:** macOS or Linux with a terminal.

### Step 1: Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### Step 2: Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.zshrc  # or restart terminal
```

### Step 3: Clone & Run Installer
```bash
git clone https://github.com/EvanCNavarro/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure
bun Bundles/Kai/install.ts
```

### Step 4: Start Using
```bash
source ~/.zshrc  # load environment variables
claude           # start Claude Code
```

---

## What the Installer Does

The wizard will:
1. **Detect existing AI systems** - Scans for Claude Code, Cursor, Windsurf, etc.
2. **Create a safety backup** - Your existing `~/.claude` → `~/.claude-BACKUP`
3. **Ask a few questions** - Your name, AI name, timezone, voice preference
4. **Install everything** - Hooks, skills, tools, statusline, voice server
5. **Personalize files** - Replaces templates with your actual info
6. **Configure shell** - Sets environment variables automatically

**Safety First:** Nothing is modified until you confirm. Your original files are always preserved.

---

## What Gets Installed

```
~/.claude/
├── CLAUDE.md              # Your personalized global instructions
├── settings.json          # Claude Code hooks + statusline config
├── statusline.sh          # Terminal status bar (model, cost, context)
├── .env                   # Environment configuration
├── hooks/                 # Event-driven automation
│   ├── stop-hook-voice.ts # Voice notifications on completion
│   ├── security-validator.ts
│   └── ...
├── skills/
│   ├── CORE/              # Identity, stack preferences, contacts
│   ├── CreateSkill/       # Meta-skill for creating new skills
│   └── skill-index.json   # Searchable skill registry
├── tools/                 # CLI utilities
│   ├── SkillSearch.ts
│   ├── PaiArchitecture.ts
│   └── GenerateSkillIndex.ts
├── config/
│   └── voice-personalities.json
└── voice-server/          # TTS server with gong notification
    ├── server.ts
    ├── chime.mp3
    └── start.sh
```

**Features:**
- **Statusline** - Real-time display of model, cost, context usage in terminal
- **Voice Notifications** - Spoken completion summaries (Piper/ElevenLabs/macOS)
- **Gong Chime** - Audio notification before voice playback
- **16 Workflow Skills** - Complete development methodology (see below)
- **Security Hooks** - Protection against dangerous operations
- **History Capture** - Sessions, decisions, learnings tracked

---

## Included Skills (16)

| Skill | Purpose |
|-------|---------|
| **CORE** | Identity, stack preferences, contacts |
| **CreateSkill** | Meta-skill for creating new skills |
| **brainstorming** | Explore ideas before implementation |
| **writing-plans** | Create detailed implementation plans |
| **executing-plans** | Execute plans with review checkpoints |
| **test-driven-development** | Write tests before implementation |
| **systematic-debugging** | Root cause analysis before fixes |
| **verification-before-completion** | Confirm before claiming done |
| **requesting-code-review** | Verify work meets requirements |
| **receiving-code-review** | Process feedback with technical rigor |
| **using-git-worktrees** | Isolate feature work in worktrees |
| **dispatching-parallel-agents** | Run independent tasks concurrently |
| **subagent-driven-development** | Execute plans with subagents |
| **finishing-a-development-branch** | Complete work with merge/PR options |
| **writing-skills** | Create and validate new skills |
| **using-superpowers** | Introduction to the skill system |

---

## Post-Install: Start Voice Server

If you enabled voice notifications, start the voice server:

```bash
~/.claude/voice-server/start.sh
```

The server runs in the background and plays spoken summaries when tasks complete.

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

## Environment Variables

The bundle uses `~/.claude/.env` for all configuration. See [`.env.example`](.env.example) for the complete reference with all available options:

- **Identity:** AI name, timezone
- **Voice TTS:** Provider selection, ElevenLabs/Piper/macOS config
- **Platform tokens:** GitHub, Vercel, Supabase, Cloudflare, Sentry, OpenAI, Google Cloud
- **MCP servers:** API keys for Model Context Protocol integrations
- **Hooks:** Enable/disable specific hooks, debug mode

The installer creates a basic `.env` for you. Copy options from `.env.example` as needed.

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

### 1.5.0 - 2026-01-04
- **16 Workflow Skills:** Added complete superpowers skill set
- **brainstorming:** Explore ideas before implementation
- **writing-plans:** Create detailed implementation plans
- **systematic-debugging:** Root cause analysis methodology
- **test-driven-development:** Write tests first
- **verification-before-completion:** Confirm before claiming done
- **Plus 9 more:** Code review, git worktrees, parallel agents, etc.

### 1.4.0 - 2026-01-04
- **Complete Installer:** Now installs ALL bundle components (was missing most files)
- **Skills System:** Full skills with CORE identity, CreateSkill meta-skill, skill-index.json
- **CLI Tools:** SkillSearch, PaiArchitecture, GenerateSkillIndex utilities
- **Statusline:** Terminal status bar showing model, cost, context usage
- **CLAUDE.md:** Global instructions template, personalized during install
- **Config:** Voice personality mappings for different agent types
- **Gong Notification:** Pre-TTS chime sound for voice completions

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
