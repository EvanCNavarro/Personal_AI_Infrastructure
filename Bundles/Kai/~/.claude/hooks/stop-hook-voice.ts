#!/usr/bin/env bun
// $PAI_DIR/hooks/stop-hook-voice.ts
// Main agent voice notification with prosody enhancement

import { readFileSync, existsSync, unlinkSync } from 'fs';
import { enhanceProsody, cleanForSpeech, getVoiceId } from './lib/prosody-enhancer';

interface NotificationPayload {
  title: string;
  message: string;
  voice_enabled: boolean;
  priority?: 'low' | 'normal' | 'high';
  voice_id: string;
}

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

// Pricing per 1M tokens (as of Dec 2024)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-opus-4-5-20251101': { input: 15, output: 75, cacheRead: 1.5 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-3-5-sonnet': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-3-5-haiku': { input: 0.8, output: 4, cacheRead: 0.08 },
  'default': { input: 3, output: 15, cacheRead: 0.3 }
};

function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  model: string
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheCost = (cacheReadTokens / 1_000_000) * pricing.cacheRead;
  return inputCost + outputCost + cacheCost;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} milliseconds`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return seconds === 1 ? '1 second' : `${seconds} seconds`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  const minStr = minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const secStr = remainingSeconds === 1 ? '1 second' : `${remainingSeconds} seconds`;
  return `${minStr} and ${secStr}`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${Math.round(tokens / 1000)}K`;
}

function formatTokensForVoice(tokens: number): string {
  // Goal: natural spoken English, no decimals, rounded whole numbers

  if (tokens < 950) {
    // Under ~1k: round to nearest 100, e.g. "about 500"
    const rounded = Math.round(tokens / 100) * 100;
    return `about ${rounded || tokens}`;
  }

  if (tokens < 10000) {
    // 1k-9.9k: round to nearest thousand, e.g. "about 5 thousand"
    const thousands = Math.round(tokens / 1000);
    return thousands === 1 ? 'about a thousand' : `about ${thousands} thousand`;
  }

  if (tokens < 100000) {
    // 10k-99k: round to nearest thousand, e.g. "about 45 thousand"
    const thousands = Math.round(tokens / 1000);
    return `about ${thousands} thousand`;
  }

  if (tokens < 950000) {
    // 100k-~950k: round to nearest 10k, e.g. "about 120 thousand"
    const thousands = Math.round(tokens / 10000) * 10;
    return `about ${thousands} thousand`;
  }

  // ~950k+: switch to millions, e.g. "about a million", "about 2 million"
  const millions = Math.round(tokens / 1000000);
  return millions === 1 ? 'about a million' : `about ${millions} million`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return 'less than a cent';
  if (cost < 0.10) return `${Math.round(cost * 100)} cents`;
  return `$${cost.toFixed(2)}`;
}

function formatCostForVoice(cost: number): string {
  if (cost < 0.01) return 'less than a cent';
  if (cost < 1.00) return `${Math.round(cost * 100)} cents`;
  return `${cost.toFixed(2)} dollars`;
}

function getDuration(sessionId: string): number {
  const startFile = `/tmp/pai-prompt-start-${sessionId}.txt`;
  try {
    if (existsSync(startFile)) {
      const startTime = parseInt(readFileSync(startFile, 'utf-8').trim());
      const duration = Date.now() - startTime;
      unlinkSync(startFile); // Clean up
      return duration;
    }
  } catch {
    // Ignore errors
  }
  return 0;
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => {
        if (typeof c === 'string') return c;
        if (c?.text) return c.text;
        if (c?.content) return contentToText(c.content);
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

function truncateToWords(text: string, maxWords: number = 10): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
}

function simplifyPath(path: string): string {
  // Extract just filename from path
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

type CompletionCategory =
  | 'Task completed'
  | 'Question answered'
  | 'Code updated'
  | 'Search complete'
  | 'Bug fixed'
  | 'Feature added'
  | 'Config changed'
  | 'Analysis complete';

function categorizeCompletion(description: string, toolCalls: string[]): CompletionCategory {
  const lowerDesc = description.toLowerCase();
  const toolStr = toolCalls.join(' ').toLowerCase();

  // Check for bug fixes
  if (lowerDesc.match(/\b(fix|fixed|patch|patched|debug|debugged|resolve|resolved)\b/)) {
    return 'Bug fixed';
  }

  // Check for feature additions
  if (lowerDesc.match(/\b(add|added|create|created|implement|implemented|built|new)\b/)) {
    return 'Feature added';
  }

  // Check for Q&A
  if (lowerDesc.match(/\b(explain|explained|answer|answered|described|what|why|how)\b/)) {
    return 'Question answered';
  }

  // Check for config changes
  if (lowerDesc.match(/\b(config|configured|setting|env|environment|\.env)\b/) ||
      toolStr.match(/\.(env|json|yaml|yml|toml|ini)/)) {
    return 'Config changed';
  }

  // Check for searches
  if (toolStr.match(/\b(search|grep|glob|web)\b/)) {
    return 'Search complete';
  }

  // Check for code modifications
  if (toolStr.match(/\b(modified|created|edit|write)\b/)) {
    return 'Code updated';
  }

  // Check for analysis/research
  if (lowerDesc.match(/\b(analyz|research|investigat|explor|review)\b/)) {
    return 'Analysis complete';
  }

  return 'Task completed';
}

function extractCompletion(text: string, toolCalls: string[] = [], agentType: string = 'pai'): string {
  // Clean system reminders and code blocks
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]+`/g, '');

  let description = '';

  // Get concrete modifications from tool calls (most accurate)
  const modifications = toolCalls.filter(t =>
    t.startsWith('Modified ') || t.startsWith('Created ') ||
    (t.includes(' ') && !t.startsWith('Read ') && !t.startsWith('Searched'))
  );

  // PRIORITY 1: Explicit COMPLETED marker
  const completedPatterns = [
    /🎯\s*\*{0,2}COMPLETED:?\*{0,2}\s*(.+?)(?:\n|$)/i,
    /\*{0,2}COMPLETED:?\*{0,2}\s*(.+?)(?:\n|$)/i,
    /\*{0,2}Done:?\*{0,2}\s*(.+?)(?:\n|$)/i
  ];

  for (const pattern of completedPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      description = match[1].trim();
      description = description.replace(/^\[AGENT:\w+\]\s*/i, '');
      break;
    }
  }

  // PRIORITY 2: Summary section
  if (!description) {
    const summaryMatch = text.match(/##\s*(?:Summary|Done|Complete)[^\n]*\n+([^\n#]+)/i);
    if (summaryMatch && summaryMatch[1]) {
      description = summaryMatch[1].replace(/^[-*]\s*/, '').trim();
    }
  }

  // PRIORITY 3: Action verb patterns at sentence start
  if (!description) {
    const actionPatterns = [
      /(?:^|\n)\s*\*{0,2}((?:Fixed|Created|Added|Updated|Installed|Configured|Removed|Refactored|Built|Implemented|Set up|Generated|Modified|Changed|Enabled|Disabled|Wrote|Tested|Verified|Resolved|Completed|Finished|Deployed|Moved|Renamed|Cleaned|Upgraded|Downgraded|Merged|Split|Combined|Extracted|Simplified|Optimized|Enhanced|Improved|Debugged|Patched|Restored|Saved|Loaded|Connected|Disconnected|Started|Stopped|Restarted|Initialized|Reset|Cleared|Deleted|Copied|Backed up|Migrated|Converted|Formatted|Parsed|Validated|Checked|Scanned|Searched|Found|Located|Identified|Analyzed|Explained|Answered|Described|Listed|Showed|Displayed|Provided|Summarized|Documented|Noted|Recorded|Logged|Tracked|Monitored|Watched|Observed)[^.!?\n]{5,80})/i
    ];

    for (const pattern of actionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        description = match[1].trim().replace(/\*{1,2}/g, '');
        break;
      }
    }
  }

  // PRIORITY 4: Tool call context - summarize what was actually done
  if (!description && toolCalls.length > 0) {
    // Get unique, meaningful tool actions
    const uniqueActions = [...new Set(toolCalls)].filter(t =>
      !t.startsWith('Read ') && !t.startsWith('Searched')
    );

    if (uniqueActions.length === 1) {
      description = uniqueActions[0];
    } else if (uniqueActions.length > 1) {
      // Combine: "Modified X, Y, and Z"
      const files = uniqueActions.map(a => a.replace(/^(Modified|Created) /, '')).slice(0, 3);
      if (uniqueActions[0].startsWith('Modified')) {
        description = `Modified ${files.join(', ')}`;
      } else if (uniqueActions[0].startsWith('Created')) {
        description = `Created ${files.join(', ')}`;
      } else {
        description = uniqueActions.slice(0, 2).join(' and ');
      }
    } else if (toolCalls.length > 0) {
      description = toolCalls[toolCalls.length - 1];
    }
  }

  // PRIORITY 5: Question/answer detection
  if (!description) {
    if (text.match(/\?.*\n/) && !text.match(/(?:Edit|Write|Bash)/)) {
      const topicMatch = text.match(/(?:about|regarding|for|with|the)\s+([a-zA-Z][a-zA-Z0-9\s]{3,30}?)(?:\.|,|\n|$)/i);
      if (topicMatch) {
        description = topicMatch[1].trim();
      }
    }
  }

  // PRIORITY 6: First meaningful sentence
  if (!description) {
    const sentences = text.split(/[.!?\n]+/).filter(s => {
      const trimmed = s.trim();
      return trimmed.length > 15 &&
             !trimmed.match(/^(Yes|No|Sure|Ok|Here|Let me|I'll|I will|Now|Bobby)/i);
    });

    if (sentences.length > 0) {
      description = sentences[0].trim();
    }
  }

  // If we have concrete modifications but description is vague, use modifications
  if (modifications.length > 0 && (!description || description.length < 10)) {
    const uniqueMods = [...new Set(modifications)];
    if (uniqueMods.length === 1) {
      description = uniqueMods[0];
    } else {
      // Combine file names: "Modified X, Y, and Z"
      const files = uniqueMods.map(m => m.replace(/^(Modified|Created) /, '')).slice(0, 3);
      const action = uniqueMods[0].startsWith('Created') ? 'Created' : 'Modified';
      if (files.length === 2) {
        description = `${action} ${files[0]} and ${files[1]}`;
      } else {
        description = `${action} ${files.slice(0, -1).join(', ')}, and ${files[files.length - 1]}`;
      }
    }
  }

  // Clean and truncate description
  description = cleanForSpeech(description);
  description = truncateToWords(description, 10);

  // Get category prefix
  const category = categorizeCompletion(description, toolCalls);

  // Build final message
  if (description && description.length > 3) {
    return `${category}: ${description}`;
  }

  return category;
}

interface TranscriptData {
  lastMessage: string;
  toolCalls: string[];
  skillsUsed: string[];
  agentsSpawned: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    model: string;
  };
}

function extractToolDescription(toolName: string, input: any): string | null {
  switch (toolName) {
    case 'Edit':
      const editFile = simplifyPath(input?.file_path || '');
      return editFile ? `Modified ${editFile}` : null;
    case 'Write':
      const writeFile = simplifyPath(input?.file_path || '');
      return writeFile ? `Created ${writeFile}` : null;
    case 'Bash':
      return input?.description || null;
    case 'Read':
      const readFile = simplifyPath(input?.file_path || '');
      return readFile ? `Read ${readFile}` : null;
    case 'Glob':
    case 'Grep':
      return 'Searched codebase';
    case 'Task':
      return input?.description || 'Ran subagent task';
    case 'WebFetch':
    case 'WebSearch':
      return 'Searched the web';
    default:
      return null;
  }
}

function getTranscriptData(transcriptPath: string): TranscriptData {
  const defaultUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, model: 'unknown' };

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    let lastAssistantMessage = '';
    const toolCalls: string[] = [];
    const skillsUsed: string[] = [];
    const agentsSpawned: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let model = 'unknown';
    let lastUserIndex = -1;

    // Find last ACTUAL user message (not tool_result) to find turn boundary
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'user') {
          // Check if this is a tool_result (not an actual user message)
          const content = entry.message?.content;
          const isToolResult = Array.isArray(content) &&
            content.every((c: any) => c.type === 'tool_result');

          // Skip tool_result messages - they're not turn boundaries
          if (!isToolResult) {
            lastUserIndex = i;
            break;
          }
        }
      } catch {
        // Skip
      }
    }

    // Process entries since last user message
    for (let i = Math.max(0, lastUserIndex); i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'assistant' && entry.message) {
            // Extract text content
            if (entry.message.content) {
              const text = contentToText(entry.message.content);
              if (text) {
                lastAssistantMessage = text;
              }
              // Extract tool calls
              if (Array.isArray(entry.message.content)) {
                for (const item of entry.message.content) {
                  if (item.type === 'tool_use' && item.name) {
                    // Track skills separately
                    if (item.name === 'Skill' && item.input?.skill) {
                      const skillName = item.input.skill.replace(/^superpowers:/, '');
                      if (!skillsUsed.includes(skillName)) {
                        skillsUsed.push(skillName);
                      }
                    }
                    // Track agents spawned via Task tool
                    if (item.name === 'Task' && item.input?.subagent_type) {
                      const agentType = item.input.subagent_type;
                      if (!agentsSpawned.includes(agentType)) {
                        agentsSpawned.push(agentType);
                      }
                    }
                    const desc = extractToolDescription(item.name, item.input);
                    if (desc) toolCalls.push(desc);
                  }
                }
              }
            }

            // Extract usage data
            if (entry.message.usage) {
              const usage = entry.message.usage;
              totalInputTokens += (usage.input_tokens || 0);
              totalOutputTokens += (usage.output_tokens || 0);
              totalCacheReadTokens += (usage.cache_read_input_tokens || 0);
            }

            // Extract model
            if (entry.message.model) {
              model = entry.message.model;
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    return {
      lastMessage: lastAssistantMessage,
      toolCalls,
      skillsUsed,
      agentsSpawned,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheReadTokens: totalCacheReadTokens,
        model
      }
    };
  } catch (error) {
    console.error('Error reading transcript:', error);
    return { lastMessage: '', toolCalls: [], skillsUsed: [], agentsSpawned: [], usage: defaultUsage };
  }
}

async function sendNotification(payload: NotificationPayload): Promise<void> {
  const serverUrl = process.env.PAI_VOICE_SERVER || 'http://localhost:8888/notify';

  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Voice server error:', response.statusText);
    }
  } catch (error) {
    // Fail silently - voice server may not be running
  }
}

async function main() {
  let hookInput: HookInput | null = null;

  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = '';

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 500);
    });

    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();

    await Promise.race([readPromise, timeoutPromise]);

    if (input.trim()) {
      hookInput = JSON.parse(input);
    }
  } catch (error) {
    console.error('Error reading hook input:', error);
  }

  let completion = 'Finished processing your request';
  const agentType = 'pai';
  let usageInfo = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, model: 'unknown' };
  let durationMs = 0;
  let skillsUsed: string[] = [];
  let agentsSpawned: string[] = [];

  if (hookInput?.transcript_path) {
    const transcriptData = getTranscriptData(hookInput.transcript_path);
    usageInfo = transcriptData.usage;
    skillsUsed = transcriptData.skillsUsed;
    agentsSpawned = transcriptData.agentsSpawned;

    if (transcriptData.lastMessage || transcriptData.toolCalls.length > 0) {
      completion = extractCompletion(transcriptData.lastMessage, transcriptData.toolCalls, agentType);
    }
  }

  // Get duration from start time file
  if (hookInput?.session_id) {
    durationMs = getDuration(hookInput.session_id);
  }

  // Calculate totals
  const totalTokens = usageInfo.inputTokens + usageInfo.outputTokens + usageInfo.cacheReadTokens;
  const cost = calculateCost(
    usageInfo.inputTokens,
    usageInfo.outputTokens,
    usageInfo.cacheReadTokens,
    usageInfo.model
  );

  // Build voice message with natural language stats
  let voiceMessage = completion;

  if (durationMs > 0 || totalTokens > 0 || cost > 0 || skillsUsed.length > 0 || agentsSpawned.length > 0) {
    const statsParts: string[] = [];

    if (durationMs > 0) {
      statsParts.push(`took ${formatDuration(durationMs)} to complete`);
    }
    if (totalTokens > 0) {
      statsParts.push(`used ${formatTokensForVoice(totalTokens)} tokens`);
    }
    if (agentsSpawned.length > 0) {
      const agentWord = agentsSpawned.length === 1 ? 'agent' : 'agents';
      statsParts.push(`spawned ${agentsSpawned.length} ${agentWord}`);
    }
    if (skillsUsed.length > 0) {
      const skillWord = skillsUsed.length === 1 ? 'skill' : 'skills';
      statsParts.push(`activated ${skillsUsed.length} ${skillWord}`);
    }
    if (cost > 0) {
      statsParts.push(`cost a total of ${formatCostForVoice(cost)}`);
    }

    // Build natural sentence: "This task took X, used Y tokens, cost Z, and spawned N agents"
    let statsSentence = 'This task ';
    if (statsParts.length === 1) {
      statsSentence += statsParts[0];
    } else if (statsParts.length === 2) {
      statsSentence += `${statsParts[0]} and ${statsParts[1]}`;
    } else {
      const lastPart = statsParts.pop();
      statsSentence += `${statsParts.join(', ')}, and ${lastPart}`;
    }

    voiceMessage = `${completion}. ${statsSentence}.`;
  }

  // Print clean summary to terminal - use stderr to ensure visibility
  if (durationMs > 0 || totalTokens > 0 || cost > 0 || skillsUsed.length > 0 || agentsSpawned.length > 0) {
    // Build stats line with emojis and spacing
    // Order: duration, tokens, agents, skills, cost (cost last)
    const terminalStats: string[] = [];
    if (durationMs > 0) {
      const durationShort = durationMs < 60000
        ? `${Math.round(durationMs / 1000)}s`
        : durationMs < 3600000
          ? `${Math.round(durationMs / 60000)}m`
          : `${Math.round(durationMs / 3600000)}h`;
      terminalStats.push(`⏱️  ${durationShort}`);
    }
    if (totalTokens > 0) terminalStats.push(`📊 ${formatTokens(totalTokens)} tokens`);
    if (agentsSpawned.length > 0) terminalStats.push(`🤖 ${agentsSpawned.length} agents`);
    if (skillsUsed.length > 0) terminalStats.push(`🎯 ${skillsUsed.length} skills`);
    if (cost > 0) terminalStats.push(`💰 ${formatCost(cost)}`);

    // Category emoji mapping
    const categoryEmoji: Record<string, string> = {
      'Task completed': '✅',
      'Bug fixed': '🐛',
      'Feature added': '✨',
      'Question answered': '💬',
      'Config changed': '🔧',
      'Search complete': '🔍',
      'Analysis complete': '📊',
      'Code updated': '📝',
    };

    // Extract category from completion
    const categoryMatch = completion.match(/^([^:]+):/);
    const category = categoryMatch ? categoryMatch[1] : 'Task completed';
    const emoji = categoryEmoji[category] || '✅';
    const description = categoryMatch
      ? completion.replace(/^[^:]+:\s*/, '')
      : completion;

    const sep = '─'.repeat(65);
    const statsLine = terminalStats.join(' • ');

    // Build agents line if any agents were spawned
    const agentsLine = agentsSpawned.length > 0
      ? `\n🤖 Agents: ${agentsSpawned.join(', ')}`
      : '';

    // Build skills line if any skills were used
    const skillsLine = skillsUsed.length > 0
      ? `\n🎯 Skills: ${skillsUsed.join(', ')}`
      : '';

    const summaryBlock = `
${sep}
${emoji} Completed: ${description}
⚡ Stats: ${statsLine}${agentsLine}${skillsLine}
${sep}`;

    process.stderr.write(summaryBlock + '\n');
  }

  const voiceId = getVoiceId(agentType);

  const payload: NotificationPayload = {
    title: 'Neo',
    message: voiceMessage,
    voice_enabled: true,
    priority: 'normal',
    voice_id: voiceId
  };

  await sendNotification(payload);

  process.exit(0);
}

main().catch((error) => {
  console.error('Stop hook error:', error);
  process.exit(0);
});
