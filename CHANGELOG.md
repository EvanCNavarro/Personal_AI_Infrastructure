# Changelog

All notable changes to the Personal AI Infrastructure project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] - 2026-01-01

### Added

#### StatusLine System
- **Neo-themed persistent status bar** at bottom of Claude Code terminal
- **Sections with emoji icons and headers:**
  - `[Model]` - Current Claude model (Opus 4.5, Sonnet, etc.)
  - `📁 Project:` - Current working directory name
  - `🌿 Branch:` - Git branch with dirty state (*) and ahead/behind sync
  - `🔋 Battery:` - macOS battery percentage
  - `💰 Cost:` - Session cost in USD
  - `📋 Context:` - Context window usage percentage
  - `⏰ Session:` - Total session duration
  - `✏️ Changes:` - Lines added/removed (+N-M)
- **Visual design:**
  - Clean separators (│) between sections
  - Consistent emoji color palette (green: 🌿🔋, brown/yellow: 📁💰📋⏰✏️)
  - ANSI bright white for values, dim for headers/separators
  - Environment warnings (🔴 PROD, 🟡 STAGE) when detected
- **Smart version detection** - Extracts version from model ID without duplication

#### Voice System Enhancements
- **Pre-TTS Gong Notification**: Added meditative gong sound that plays before voice announcements
  - File: `voice-server/chime.wav` (synthesized A2 gong with reverb)
  - Configurable via `VOICE_CHIME_ENABLED` in `.env`
  - Rapid fade at end for quick transition to speech

- **Usage Tracking & Cost Reporting**: Voice now announces task statistics
  - Duration tracking (prompt submit → response complete)
  - Token counting (input, output, cache read tokens)
  - Cost calculation based on model pricing (Opus/Sonnet/Haiku)
  - Natural language output: "This task took 45 seconds to complete, used 120K tokens, and cost a total of 48 cents."

- **Terminal Summary Display**: Boxed visual breakdown after each response
  ```
  ╭─────────────────────────────────────────────────────────╮
  │ 📊 Code updated: Modified server.ts and hook.ts         │
  │ ⏱️  45 seconds • 120K tokens • $0.48                    │
  ╰─────────────────────────────────────────────────────────╯
  ```

- **Smart Completion Extraction**: Multi-priority algorithm for accurate task summaries
  1. Explicit `🎯 COMPLETED:` markers
  2. Summary sections in response
  3. Action verb patterns (Fixed, Created, Added, etc.)
  4. Tool call descriptions (Modified X, Created Y)
  5. Q&A detection
  6. First meaningful sentence
  - Never falls back to generic "Completed task"

- **Completion Categories**: Intelligent prefix categorization
  - `Task completed` (default)
  - `Bug fixed` (detected: fix, patch, debug, resolve)
  - `Feature added` (detected: add, create, implement, built)
  - `Question answered` (detected: explain, answer, Q&A patterns)
  - `Config changed` (detected: config, .env, settings)
  - `Code updated` (detected: Edit/Write tool calls)
  - `Search complete` (detected: Grep/Glob/Web searches)
  - `Analysis complete` (detected: analyze, research, investigate)

#### Hook System Enhancements
- **Prompt Timing**: `update-tab-titles.ts` now records start timestamp for duration tracking
  - Writes to `/tmp/pai-prompt-start-{session_id}.txt`
  - Consumed and cleaned up by stop hook

### Changed

#### Voice Server (`voice-server/server.ts`)
- Added chime playback before TTS generation
- Added `VOICE_CHIME_ENABLED` and `VOICE_CHIME_PATH` configuration
- Added startup logging for chime status

#### Stop Hook Voice (`hooks/stop-hook-voice.ts`)
- Complete rewrite of `extractCompletion()` function with 6-priority system
- Added `categorizeCompletion()` for intelligent prefix selection
- Added usage data extraction from transcript
- Added cost calculation with model-specific pricing
- Added natural language stats formatting
- Added terminal summary output

### Fixed
- Voice ID now uses free-tier compatible voices by default
- Model updated to `eleven_turbo_v2_5` (required for free tier)
- Duration formatting now uses full words ("45 seconds" not "45s") for proper TTS
- Singular/plural handling ("1 second" vs "2 seconds", "1 minute" vs "2 minutes")
- Terminal output now uses stderr for visibility in Claude Code

---

## [1.2.0] - 2025-12-31

### Added
- Initial Kai Bundle installer with interactive wizard
- Four core packs: hook-system, history-system, core-install, voice-system
- ElevenLabs TTS integration
- Prosody enhancement for natural speech
- Agent personality voice mapping

---

## File Changes Summary

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `statusline.sh` | Added | 136 | Neo-themed persistent status bar with ANSI styling |
| `hooks/stop-hook-voice.ts` | Modified | 567 | Smart extraction, usage tracking, cost calculation |
| `hooks/update-tab-titles.ts` | Modified | 109 | Added prompt start time recording |
| `voice-server/server.ts` | Modified | 392 | Added chime support |
| `voice-server/chime.wav` | Added | - | Meditative gong audio (205KB) |
| `.env` | Modified | - | Added `VOICE_CHIME_ENABLED` config |

---

## Model Pricing (Built-in)

| Model | Input/1M | Output/1M | Cache Read/1M |
|-------|----------|-----------|---------------|
| Claude Opus 4.5 | $15.00 | $75.00 | $1.50 |
| Claude Sonnet 4 | $3.00 | $15.00 | $0.30 |
| Claude Haiku 3.5 | $0.80 | $4.00 | $0.08 |
