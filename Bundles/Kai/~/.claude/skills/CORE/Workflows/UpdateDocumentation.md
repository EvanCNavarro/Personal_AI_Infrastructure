# UpdateDocumentation Workflow

> **Trigger:** "update architecture", "refresh PAI state", OR automatically after any pack/bundle installation

## Purpose

Keeps PAI Architecture tracking current by:
1. Regenerating the Architecture.md file with current installation state
2. Logging upgrades to the history system
3. Verifying system health after changes

## When This Runs

### Manual Invocation
- User says "update my PAI architecture"
- User says "refresh PAI state"
- User says "what's installed?"

### Automatic Invocation (CRITICAL)
**This workflow MUST run automatically after:**
- Installing any PAI Pack
- Installing any PAI Bundle
- Making significant configuration changes
- Upgrading pack versions

## Workflow Steps

### Step 1: Check Current State

Review what's currently installed:
- List skills in `~/.claude/skills/`
- Check hooks in `~/.claude/hooks/`
- Verify voice server status

### Step 2: Update Documentation

Update the PaiArchitecture.md file with current state.

### Step 3: Verify Health

Confirm all systems are operational:
- Hooks registered in settings.json
- Skills indexed in skill-index.json
- Voice server responding (if installed)
