#!/usr/bin/env bun
/**
 * Kai Bundle Installation Wizard v2.0.0
 *
 * Complete installation wizard for setting up the Kai bundle.
 * Auto-detects AI systems, creates safety backups, and installs:
 * - Claude Code hooks (completion, security, event capture)
 * - Voice server with ElevenLabs TTS (optional)
 * - Settings.json with hook configuration
 *
 * Usage: bun run install.ts
 */

import { $ } from "bun";
import * as readline from "readline";
import { existsSync, readdirSync, statSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";

// =============================================================================
// TYPES
// =============================================================================

interface AISystem {
  name: string;
  dir: string;
  exists: boolean;
}

type TTSProvider = 'none' | 'piper' | 'elevenlabs' | 'macos';

interface WizardConfig {
  daName: string;
  timeZone: string;
  userName: string;
  ttsProvider: TTSProvider;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
}

// =============================================================================
// UTILITIES
// =============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function askWithDefault(question: string, defaultValue: string): Promise<string> {
  const answer = await ask(`${question} [${defaultValue}]: `);
  return answer || defaultValue;
}

async function askYesNo(question: string, defaultYes = true): Promise<boolean> {
  const defaultStr = defaultYes ? "Y/n" : "y/N";
  const answer = await ask(`${question} [${defaultStr}]: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

function printHeader(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60) + "\n");
}

// =============================================================================
// AI SYSTEM DETECTION
// =============================================================================

function detectAISystems(): AISystem[] {
  const home = process.env.HOME;
  const systems: AISystem[] = [
    { name: "Claude Code", dir: `${home}/.claude`, exists: false },
    { name: "Cursor", dir: `${home}/.cursor`, exists: false },
    { name: "Windsurf", dir: `${home}/.windsurf`, exists: false },
    { name: "Cline", dir: `${home}/.cline`, exists: false },
    { name: "Aider", dir: `${home}/.aider`, exists: false },
    { name: "Continue", dir: `${home}/.continue`, exists: false },
  ];

  for (const system of systems) {
    system.exists = existsSync(system.dir);
  }

  return systems;
}

function getDetectedSystems(systems: AISystem[]): AISystem[] {
  return systems.filter((s) => s.exists);
}

// =============================================================================
// BACKUP
// =============================================================================

async function detectAndBackup(): Promise<boolean> {
  const allSystems = detectAISystems();
  const detectedSystems = getDetectedSystems(allSystems);
  const claudeDir = `${process.env.HOME}/.claude`;
  const backupDir = `${process.env.HOME}/.claude-BACKUP`;

  console.log("Scanning for existing AI system directories...\n");

  // Show detection results
  if (detectedSystems.length === 0) {
    console.log("  No existing AI system directories detected.");
    console.log("  This will be a fresh installation.\n");
  } else {
    console.log("  Detected AI systems:");
    for (const system of detectedSystems) {
      const isClaude = system.dir === claudeDir;
      const marker = isClaude ? " ← WILL BE BACKED UP" : "";
      console.log(`    • ${system.name}: ${system.dir}${marker}`);
    }
    console.log();
  }

  // Check if ~/.claude exists
  const claudeExists = existsSync(claudeDir);

  if (!claudeExists) {
    console.log("No existing ~/.claude directory found. Fresh install.\n");

    // Still ask for confirmation before proceeding
    const proceed = await askYesNo(
      "Ready to install Kai to ~/.claude. Proceed?",
      true
    );
    if (!proceed) {
      console.log("Installation cancelled.");
      return false;
    }
    return true;
  }

  // ~/.claude exists - explain what will happen
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│  SAFETY BACKUP                                              │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│                                                             │");
  console.log("│  The installer will:                                        │");
  console.log("│                                                             │");
  console.log("│  1. Copy your current ~/.claude → ~/.claude-BACKUP          │");
  console.log("│  2. Install fresh Kai files into ~/.claude                  │");
  console.log("│                                                             │");
  console.log("│  Your original files will be preserved in the backup.       │");
  console.log("│                                                             │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log();

  // Check for existing backup
  if (existsSync(backupDir)) {
    console.log(`⚠️  Existing backup found at ${backupDir}`);
    const overwrite = await askYesNo("Overwrite existing backup?", false);
    if (!overwrite) {
      console.log("Please manually remove or rename the existing backup first.");
      return false;
    }
    await $`rm -rf ${backupDir}`;
  }

  // Ask for explicit confirmation
  const proceed = await askYesNo(
    "Do you want to proceed with the backup and installation?",
    true
  );
  if (!proceed) {
    console.log("Installation cancelled.");
    return false;
  }

  console.log(`\nBacking up ~/.claude to ~/.claude-BACKUP...`);
  await $`cp -r ${claudeDir} ${backupDir}`;
  console.log("✓ Backup complete.\n");
  return true;
}

// =============================================================================
// BUNDLE FILE COPYING
// =============================================================================

function getBundleDir(): string {
  // install.ts is at Bundles/Kai/install.ts
  // Bundle files are at Bundles/Kai/~/.claude/
  const scriptDir = dirname(Bun.main);
  return join(scriptDir, "~", ".claude");
}

function copyDirRecursive(src: string, dest: string, exclude: string[] = []): void {
  if (!existsSync(src)) {
    console.log(`  ⚠️  Source directory not found: ${src}`);
    return;
  }

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src);
  for (const entry of entries) {
    if (exclude.includes(entry)) {
      continue;
    }

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath, exclude);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function mergeSettings(bundleSettingsPath: string, targetSettingsPath: string): void {
  // Load bundle settings template
  if (!existsSync(bundleSettingsPath)) {
    console.log("  ⚠️  settings.template.json not found in bundle");
    return;
  }

  const bundleSettings = JSON.parse(readFileSync(bundleSettingsPath, "utf-8"));

  // If target settings exist, merge hooks
  if (existsSync(targetSettingsPath)) {
    try {
      const existingSettings = JSON.parse(readFileSync(targetSettingsPath, "utf-8"));

      // Merge env (bundle wins for overlapping keys)
      existingSettings.env = { ...existingSettings.env, ...bundleSettings.env };

      // Merge hooks arrays (bundle hooks added if not already present)
      if (bundleSettings.hooks) {
        existingSettings.hooks = existingSettings.hooks || {};

        for (const [hookType, hookConfigs] of Object.entries(bundleSettings.hooks)) {
          if (!existingSettings.hooks[hookType]) {
            existingSettings.hooks[hookType] = hookConfigs;
          } else {
            // Check if hooks with same command already exist
            const existingCommands = new Set(
              existingSettings.hooks[hookType].flatMap((h: any) =>
                h.hooks?.map((hh: any) => hh.command) || []
              )
            );

            for (const config of hookConfigs as any[]) {
              const hasNew = config.hooks?.some((h: any) => !existingCommands.has(h.command));
              if (hasNew) {
                existingSettings.hooks[hookType].push(config);
              }
            }
          }
        }
      }

      writeFileSync(targetSettingsPath, JSON.stringify(existingSettings, null, 2));
      console.log("  ✓ Merged hooks into existing settings.json");
    } catch (e) {
      console.log("  ⚠️  Failed to merge settings, using template as-is");
      copyFileSync(bundleSettingsPath, targetSettingsPath);
    }
  } else {
    // No existing settings, use template directly
    copyFileSync(bundleSettingsPath, targetSettingsPath);
    console.log("  ✓ Created settings.json from template");
  }
}

async function copyBundleFiles(claudeDir: string, voiceEnabled: boolean): Promise<void> {
  const bundleDir = getBundleDir();

  console.log("\nCopying bundle files...");

  // Copy hooks directory (excluding any personal files)
  const hooksSource = join(bundleDir, "hooks");
  const hooksDest = join(claudeDir, "hooks");
  console.log("  Copying hooks...");
  copyDirRecursive(hooksSource, hooksDest, []);
  console.log("  ✓ Hooks installed");

  // Copy voice-server directory if voice is enabled
  if (voiceEnabled) {
    const voiceSource = join(bundleDir, "voice-server");
    const voiceDest = join(claudeDir, "voice-server");
    console.log("  Copying voice-server...");
    copyDirRecursive(voiceSource, voiceDest, []);
    console.log("  ✓ Voice server installed");

    // Make scripts executable
    const scripts = ["start.sh", "stop.sh", "restart.sh"];
    for (const script of scripts) {
      const scriptPath = join(voiceDest, script);
      if (existsSync(scriptPath)) {
        await $`chmod +x ${scriptPath}`;
      }
    }
    console.log("  ✓ Voice server scripts made executable");
  }

  // Merge settings.json
  const settingsSource = join(bundleDir, "settings.template.json");
  const settingsDest = join(claudeDir, "settings.json");
  console.log("  Configuring Claude Code settings...");
  mergeSettings(settingsSource, settingsDest);
}

// =============================================================================
// MAIN WIZARD
// =============================================================================

async function gatherConfig(): Promise<WizardConfig> {
  printHeader("KAI BUNDLE SETUP");

  console.log("This wizard will configure your AI assistant.\n");

  // Check for existing PAI_DIR environment variable
  const existingPaiDir = process.env.PAI_DIR;
  if (existingPaiDir) {
    console.log(`📍 Existing PAI_DIR detected: ${existingPaiDir}\n`);
    const useExisting = await askYesNo(
      `Use existing PAI_DIR (${existingPaiDir}) for installation?`,
      true
    );
    if (useExisting) {
      console.log(`\nUsing existing PAI_DIR: ${existingPaiDir}\n`);
    } else {
      console.log("\n⚠️  Installation will use ~/.claude (standard Claude Code location)");
      console.log("   You may need to update your PAI_DIR environment variable after installation.\n");
    }
  } else {
    console.log("Installation directory: ~/.claude (standard Claude Code location)\n");
  }

  // Essential questions only
  const userName = await ask("What is your name? ");

  const daName = await askWithDefault(
    "What would you like to name your AI assistant?",
    "Kai"
  );

  const timeZone = await askWithDefault(
    "What's your timezone?",
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Voice TTS options
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│  VOICE NOTIFICATIONS                                        │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│  1. Piper (Recommended) - Free, local, neural TTS (~60MB)   │");
  console.log("│  2. ElevenLabs - Cloud TTS, high quality, has usage limits  │");
  console.log("│  3. macOS - Built-in 'say' command, always available        │");
  console.log("│  4. None - No voice notifications                           │");
  console.log("└─────────────────────────────────────────────────────────────┘");

  const voiceChoice = await askWithDefault("\nSelect voice option (1-4)", "1");

  let ttsProvider: TTSProvider = 'none';
  let elevenLabsApiKey: string | undefined;
  let elevenLabsVoiceId: string | undefined;

  switch (voiceChoice) {
    case "1":
      ttsProvider = 'piper';
      console.log("\n✓ Piper selected - will install during setup");
      break;
    case "2":
      ttsProvider = 'elevenlabs';
      elevenLabsApiKey = await ask("Enter your ElevenLabs API key: ");
      elevenLabsVoiceId = await askWithDefault(
        "Enter your preferred voice ID",
        "s3TPKV1kjDlVtZbl4Ksh"
      );
      break;
    case "3":
      ttsProvider = 'macos';
      console.log("\n✓ macOS 'say' selected - no additional setup needed");
      break;
    default:
      ttsProvider = 'none';
      console.log("\n✓ Voice notifications disabled");
  }

  return {
    daName,
    timeZone,
    userName,
    ttsProvider,
    elevenLabsApiKey,
    elevenLabsVoiceId,
  };
}

// =============================================================================
// FILE GENERATION
// =============================================================================

function generateSkillMd(config: WizardConfig): string {
  return `---
name: CORE
description: Personal AI Infrastructure core. AUTO-LOADS at session start. USE WHEN any session begins OR user asks about identity, response format, contacts, stack preferences.
---

# CORE - Personal AI Infrastructure

**Auto-loads at session start.** This skill defines your AI's identity, response format, and core operating principles.

## Identity

**Assistant:**
- Name: ${config.daName}
- Role: ${config.userName}'s AI assistant
- Operating Environment: Personal AI infrastructure built on Claude Code

**User:**
- Name: ${config.userName}

---

## First-Person Voice (CRITICAL)

Your AI should speak as itself, not about itself in third person.

**Correct:**
- "for my system" / "in my architecture"
- "I can help" / "my delegation patterns"
- "we built this together"

**Wrong:**
- "for ${config.daName}" / "for the ${config.daName} system"
- "the system can" (when meaning "I can")

---

## Stack Preferences

Default preferences (customize in CoreStack.md):

- **Language:** TypeScript preferred over Python
- **Package Manager:** bun (NEVER npm/yarn/pnpm)
- **Runtime:** Bun
- **Markup:** Markdown (NEVER HTML for basic content)

---

## Response Format (Optional)

Define a consistent response format for task-based responses:

\`\`\`
📋 SUMMARY: [One sentence]
🔍 ANALYSIS: [Key findings]
⚡ ACTIONS: [Steps taken]
✅ RESULTS: [Outcomes]
➡️ NEXT: [Recommended next steps]
\`\`\`

Customize this format in SKILL.md to match your preferences.

---

## Quick Reference

**Full documentation available in context files:**
- Contacts: \`Contacts.md\`
- Stack preferences: \`CoreStack.md\`
- Security protocols: \`SecurityProtocols.md\`
`;
}

function generateContactsMd(config: WizardConfig): string {
  return `# Contact Directory

Quick reference for frequently contacted people.

---

## Contacts

| Name | Role | Email | Notes |
|------|------|-------|-------|
| [Add contacts here] | [Role] | [email] | [Notes] |

---

## Adding Contacts

To add a new contact, edit this file following the table format above.

---

## Usage

When asked about someone:
1. Check this directory first
2. Return the relevant contact information
3. If not found, ask for details
`;
}

function generateCoreStackMd(config: WizardConfig): string {
  return `# Core Stack Preferences

Technical preferences for code generation and tooling.

Generated: ${new Date().toISOString().split("T")[0]}

---

## Language Preferences

| Priority | Language | Use Case |
|----------|----------|----------|
| 1 | TypeScript | Primary for all new code |
| 2 | Python | Data science, ML, when required |

---

## Package Managers

| Language | Manager | Never Use |
|----------|---------|-----------|
| JavaScript/TypeScript | bun | npm, yarn, pnpm |
| Python | uv | pip, pip3 |

---

## Runtime

| Purpose | Tool |
|---------|------|
| JavaScript Runtime | Bun |
| Serverless | Cloudflare Workers |

---

## Markup Preferences

| Format | Use | Never Use |
|--------|-----|-----------|
| Markdown | All content, docs, notes | HTML for basic content |
| YAML | Configuration, frontmatter | - |
| JSON | API responses, data | - |

---

## Code Style

- Prefer explicit over clever
- No unnecessary abstractions
- Comments only where logic isn't self-evident
- Error messages should be actionable
`;
}

// =============================================================================
// PIPER TTS INSTALLATION
// =============================================================================

async function installPiperTTS(claudeDir: string): Promise<boolean> {
  console.log("\nInstalling Piper TTS...");

  // Check if piper is already installed
  try {
    await $`which piper`.quiet();
    console.log("  ✓ Piper already installed");
  } catch {
    // Install piper-tts via pip
    console.log("  Installing piper-tts via pip3...");
    try {
      await $`pip3 install piper-tts`.quiet();
      console.log("  ✓ Piper installed");
    } catch (e: any) {
      console.error("  ⚠️  Failed to install piper-tts:", e.message);
      console.log("  You can install manually: pip3 install piper-tts");
      return false;
    }
  }

  // Create piper-models directory
  const modelsDir = join(claudeDir, "voice-server", "piper-models");
  await $`mkdir -p ${modelsDir}`;

  // Download voice model if not present
  const modelPath = join(modelsDir, "en_US-lessac-medium.onnx");
  const configPath = join(modelsDir, "en_US-lessac-medium.onnx.json");

  if (!existsSync(modelPath)) {
    console.log("  Downloading Piper voice model (~60MB)...");
    try {
      await $`curl -L -o ${modelPath} "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"`;
      await $`curl -L -o ${configPath} "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"`;
      console.log("  ✓ Voice model downloaded");
    } catch (e: any) {
      console.error("  ⚠️  Failed to download voice model:", e.message);
      return false;
    }
  } else {
    console.log("  ✓ Voice model already present");
  }

  return true;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██╗  ██╗ █████╗ ██╗    ██████╗ ██╗   ██╗███╗   ██╗██████╗ ██╗   ║
║   ██║ ██╔╝██╔══██╗██║    ██╔══██╗██║   ██║████╗  ██║██╔══██╗██║   ║
║   █████╔╝ ███████║██║    ██████╔╝██║   ██║██╔██╗ ██║██║  ██║██║   ║
║   ██╔═██╗ ██╔══██║██║    ██╔══██╗██║   ██║██║╚██╗██║██║  ██║██║   ║
║   ██║  ██╗██║  ██║██║    ██████╔╝╚██████╔╝██║ ╚████║██████╔╝███████╗
║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝    ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚══════╝
║                                                                   ║
║              Personal AI Infrastructure - v2.0.0                  ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  try {
    // Step 1: Detect AI systems and create backup
    printHeader("STEP 1: DETECT & BACKUP");
    const backupOk = await detectAndBackup();
    if (!backupOk) {
      console.log("\nInstallation cancelled.");
      process.exit(1);
    }

    // Step 2: Gather configuration
    printHeader("STEP 2: CONFIGURATION");
    const config = await gatherConfig();

    // Step 3: Install
    printHeader("STEP 3: INSTALLATION");

    const claudeDir = `${process.env.HOME}/.claude`;

    // Create directory structure
    console.log("Creating directory structure...");
    await $`mkdir -p ${claudeDir}/skills/CORE/workflows`;
    await $`mkdir -p ${claudeDir}/skills/CORE/tools`;
    await $`mkdir -p ${claudeDir}/history/{sessions,learnings,research,decisions}`;
    await $`mkdir -p ${claudeDir}/hooks/lib`;
    await $`mkdir -p ${claudeDir}/tools`;
    await $`mkdir -p ${claudeDir}/voice`;

    // Generate files
    console.log("Generating SKILL.md...");
    const skillMd = generateSkillMd(config);
    await Bun.write(`${claudeDir}/skills/CORE/SKILL.md`, skillMd);

    console.log("Generating Contacts.md...");
    const contactsMd = generateContactsMd(config);
    await Bun.write(`${claudeDir}/skills/CORE/Contacts.md`, contactsMd);

    console.log("Generating CoreStack.md...");
    const coreStackMd = generateCoreStackMd(config);
    await Bun.write(`${claudeDir}/skills/CORE/CoreStack.md`, coreStackMd);

    // Create .env file
    console.log("Creating .env file...");
    const envFileContent = `# PAI Environment Configuration
# Created by Kai Bundle installer - ${new Date().toISOString().split("T")[0]}

DA="${config.daName}"
TIME_ZONE="${config.timeZone}"

# Voice TTS Configuration (Cascading: ElevenLabs → Piper → macOS)
# Options: 'elevenlabs' | 'piper' | 'macos'
TTS_PROVIDER="${config.ttsProvider === 'none' ? 'piper' : config.ttsProvider}"
${config.elevenLabsApiKey ? `ELEVENLABS_API_KEY="${config.elevenLabsApiKey}"` : "# ELEVENLABS_API_KEY="}
${config.elevenLabsVoiceId ? `ELEVENLABS_VOICE_ID="${config.elevenLabsVoiceId}"` : "# ELEVENLABS_VOICE_ID="}
# MACOS_VOICE="Samantha"  # Run 'say -v ?' for available voices
`;
    await Bun.write(`${claudeDir}/.env`, envFileContent);

    // Copy bundle files (hooks, voice-server, settings)
    const voiceEnabled = config.ttsProvider !== 'none';
    await copyBundleFiles(claudeDir, voiceEnabled);

    // Install Piper TTS if selected
    if (config.ttsProvider === 'piper') {
      await installPiperTTS(claudeDir);
    }

    // Add to shell profile
    console.log("Updating shell profile...");
    const shell = process.env.SHELL || "/bin/zsh";
    const shellProfile = shell.includes("zsh")
      ? `${process.env.HOME}/.zshrc`
      : `${process.env.HOME}/.bashrc`;

    const ttsProviderExport = config.ttsProvider !== 'none'
      ? `export TTS_PROVIDER="${config.ttsProvider}"`
      : "";

    const envExports = `
# PAI Configuration (added by Kai Bundle installer)
export DA="${config.daName}"
export TIME_ZONE="${config.timeZone}"
export PAI_SOURCE_APP="$DA"
${ttsProviderExport}
${config.elevenLabsApiKey ? `export ELEVENLABS_API_KEY="${config.elevenLabsApiKey}"` : ""}
${config.elevenLabsVoiceId ? `export ELEVENLABS_VOICE_ID="${config.elevenLabsVoiceId}"` : ""}
`;

    const existingProfile = await Bun.file(shellProfile).text().catch(() => "");
    if (!existingProfile.includes("PAI Configuration")) {
      await Bun.write(shellProfile, existingProfile + "\n" + envExports);
      console.log(`Added environment variables to ${shellProfile}`);
    } else {
      console.log(`PAI environment variables already exist in ${shellProfile}`);
    }

    // Source the shell profile to make variables available
    console.log("Sourcing shell profile...");
    try {
      // Export to current process
      process.env.DA = config.daName;
      process.env.TIME_ZONE = config.timeZone;
      process.env.PAI_SOURCE_APP = config.daName;
      if (config.ttsProvider !== 'none') process.env.TTS_PROVIDER = config.ttsProvider;
      if (config.elevenLabsApiKey) process.env.ELEVENLABS_API_KEY = config.elevenLabsApiKey;
      if (config.elevenLabsVoiceId) process.env.ELEVENLABS_VOICE_ID = config.elevenLabsVoiceId;
      console.log("Environment variables set for current session.");
    } catch (e) {
      // Silently continue - environment is exported to file
    }

    // Summary
    printHeader("INSTALLATION COMPLETE");

    const voiceStatusMap: Record<TTSProvider, string> = {
      'piper': 'Piper (local neural TTS)',
      'elevenlabs': 'ElevenLabs (cloud TTS)',
      'macos': 'macOS say (built-in)',
      'none': 'Disabled'
    };
    const voiceStatus = voiceStatusMap[config.ttsProvider];
    const voiceInstructions = config.ttsProvider !== 'none'
      ? `  4. Start voice server: ~/.claude/voice-server/start.sh`
      : "";

    console.log(`
Your Kai system is configured:

  📁 Installation: ~/.claude
  💾 Backup: ~/.claude-BACKUP
  🤖 Assistant Name: ${config.daName}
  👤 User: ${config.userName}
  🌍 Timezone: ${config.timeZone}
  🔊 Voice: ${voiceStatus}

Files installed:
  - ~/.claude/skills/CORE/SKILL.md
  - ~/.claude/skills/CORE/Contacts.md
  - ~/.claude/skills/CORE/CoreStack.md
  - ~/.claude/.env
  - ~/.claude/settings.json (Claude Code hooks)
  - ~/.claude/hooks/* (completion hooks, security validator, etc.)${config.ttsProvider !== 'none' ? `
  - ~/.claude/voice-server/* (TTS server, chime audio)` : ""}${config.ttsProvider === 'piper' ? `
  - ~/.claude/voice-server/piper-models/* (Piper voice model)` : ""}

Next steps:

  1. Restart Claude Code to activate hooks
  2. Source your shell profile: source ~/.zshrc
  3. Test by running any Claude Code command${voiceInstructions ? `
${voiceInstructions}` : ""}

Your backup is at ~/.claude-BACKUP if you need to restore.
`);

  } catch (error) {
    console.error("\n❌ Installation failed:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
