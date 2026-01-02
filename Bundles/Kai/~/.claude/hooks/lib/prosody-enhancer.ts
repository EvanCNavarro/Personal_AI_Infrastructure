// $PAI_DIR/hooks/lib/prosody-enhancer.ts
// Enhances voice output with emotional markers and natural speech patterns

export interface AgentPersonality {
  name: string;
  rate_wpm: number;
  stability: number;
  archetype: 'enthusiast' | 'professional' | 'analyst' | 'critic' | 'wise-leader';
  energy_level: 'chaotic' | 'expressive' | 'measured' | 'stable';
}

export interface ProsodyConfig {
  emotionalMarkers: boolean;
  markdownProsody: boolean;
  personalityEnhancement: boolean;
  contextAnalysis: boolean;
}

const AGENT_PERSONALITIES: Record<string, AgentPersonality> = {
  'pai': {
    name: 'PAI',
    rate_wpm: 235,
    stability: 0.38,
    archetype: 'professional',
    energy_level: 'expressive'
  },
  'intern': {
    name: 'Intern',
    rate_wpm: 270,
    stability: 0.30,
    archetype: 'enthusiast',
    energy_level: 'chaotic'
  },
  'pentester': {
    name: 'Pentester',
    rate_wpm: 260,
    stability: 0.18,
    archetype: 'enthusiast',
    energy_level: 'chaotic'
  },
  'artist': {
    name: 'Artist',
    rate_wpm: 215,
    stability: 0.20,
    archetype: 'enthusiast',
    energy_level: 'chaotic'
  },
  'designer': {
    name: 'Designer',
    rate_wpm: 226,
    stability: 0.52,
    archetype: 'critic',
    energy_level: 'measured'
  },
  'engineer': {
    name: 'Engineer',
    rate_wpm: 212,
    stability: 0.72,
    archetype: 'wise-leader',
    energy_level: 'stable'
  },
  'architect': {
    name: 'Architect',
    rate_wpm: 205,
    stability: 0.75,
    archetype: 'wise-leader',
    energy_level: 'stable'
  },
  'researcher': {
    name: 'Researcher',
    rate_wpm: 229,
    stability: 0.64,
    archetype: 'analyst',
    energy_level: 'measured'
  }
};

const CONTENT_PATTERNS = {
  excited: [
    /\b(breakthrough|discovered|found it|eureka|amazing|incredible)\b/i,
    /\b(wait wait|ooh|wow|check this|look at this)\b/i,
    /!{2,}|💥|🔥|⚡/
  ],
  celebration: [
    /\b(finally|at last|phew|we did it|victory)\b/i,
    /\b(all .* passing|zero errors|zero (data )?loss)\b/i,
    /🎉|🥳|🍾/
  ],
  insight: [
    /\b(wait|aha|I see|that'?s why|now I understand)\b/i,
    /\b(this explains|the real issue|actually)\b/i,
    /💡|🔦/
  ],
  success: [
    /\b(completed|finished|done|success|working|fixed|resolved|solved)\b/i,
    /\b(all tests? pass|deploy|ship|launch)\b/i,
    /✅|✨/
  ],
  progress: [
    /\b(phase .* complete|step .* done)\b/i,
    /\b(moving to|now|next|partial|incremental)\b/i,
    /📈|⏩/
  ],
  investigating: [
    /\b(analyzing|examining|investigating|tracing)\b/i,
    /\b(pattern detected|correlation|cross-referencing)\b/i,
    /🔍|🔬|📊/
  ],
  debugging: [
    /\b(bug|error|issue|problem)\b/i,
    /\b(tracking|hunting|found it|located)\b/i,
    /🐛|🔧/
  ],
  caution: [
    /\b(warning|careful|slow|partial|incomplete)\b/i,
    /\b(needs review|check|verify)\b/i,
    /⚠️|⚡/
  ],
  urgent: [
    /\b(urgent|critical|down|failing|broken|alert)\b/i,
    /\b(immediate|asap|now|quickly|emergency)\b/i,
    /🚨|❌|⛔/
  ]
};

function detectEmotionalContext(message: string): string | null {
  if (/\[(💥|✨|⚠️|🚨|🎉|💡|🤔|🔍|📈|🎯|🎨|🐛|📚)/.test(message)) {
    return null;
  }

  const priorityOrder = [
    'urgent', 'debugging', 'insight', 'celebration', 'excited',
    'investigating', 'progress', 'success', 'caution'
  ];

  for (const emotion of priorityOrder) {
    const patterns = CONTENT_PATTERNS[emotion as keyof typeof CONTENT_PATTERNS];
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return emotion;
        }
      }
    }
  }

  return null;
}

function getEmotionalMarker(emotion: string): string {
  const markers: Record<string, string> = {
    'excited': '[💥 excited]',
    'celebration': '[🎉 celebration]',
    'insight': '[💡 insight]',
    'success': '[✨ success]',
    'progress': '[📈 progress]',
    'investigating': '[🔍 investigating]',
    'debugging': '[🐛 debugging]',
    'caution': '[⚠️ caution]',
    'urgent': '[🚨 urgent]'
  };

  return markers[emotion] || '';
}

function addPersonalityProsody(message: string, personality: AgentPersonality): string {
  let enhanced = message;

  switch (personality.archetype) {
    case 'enthusiast':
      if (personality.energy_level === 'chaotic') {
        if (!/\.{3}/.test(enhanced) && Math.random() > 0.5) {
          enhanced = enhanced.replace(/\b(wait|found|check|look)\b/i, '$1...');
        }
        if (!/[!?]$/.test(enhanced)) {
          enhanced = enhanced.replace(/\.$/, '!');
        }
      }
      break;

    case 'wise-leader':
      if (personality.energy_level === 'stable') {
        if (/,/.test(enhanced)) {
          enhanced = enhanced.replace(/,\s+/, ' -- ');
        }
      }
      break;

    case 'professional':
      if (personality.energy_level === 'expressive') {
        if (!/\*\*/.test(enhanced)) {
          enhanced = enhanced.replace(
            /\b(completed|fixed|deployed|built|created|found)\b/i,
            '**$1**'
          );
        }
      }
      break;

    case 'analyst':
      enhanced = enhanced.replace(
        /\b(confirmed|verified|analyzed|discovered)\b/i,
        '**$1**'
      );
      break;
  }

  return enhanced;
}

export function enhanceProsody(
  message: string,
  agentType: string,
  config: ProsodyConfig = {
    emotionalMarkers: true,
    markdownProsody: true,
    personalityEnhancement: true,
    contextAnalysis: true
  }
): string {
  let enhanced = message;

  const personality = AGENT_PERSONALITIES[agentType.toLowerCase()] ||
                     AGENT_PERSONALITIES['pai'];

  if (config.contextAnalysis && config.emotionalMarkers) {
    const emotion = detectEmotionalContext(enhanced);
    if (emotion) {
      const marker = getEmotionalMarker(emotion);
      if (marker) {
        enhanced = `${marker} ${enhanced}`;
      }
    }
  }

  if (config.personalityEnhancement && config.markdownProsody) {
    enhanced = addPersonalityProsody(enhanced, personality);
  }

  return enhanced.trim();
}

export function cleanForSpeech(message: string): string {
  let cleaned = message;

  cleaned = cleaned.replace(/```[\s\S]*?```/g, 'code block');
  cleaned = cleaned.replace(/`[^`]+`/g, '');

  const parts: Array<{isMarker: boolean, text: string}> = [];
  let lastIndex = 0;
  const markerRegex = /\[[^\]]+\]/g;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        isMarker: false,
        text: cleaned.substring(lastIndex, match.index)
      });
    }
    parts.push({
      isMarker: true,
      text: match[0]
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < cleaned.length) {
    parts.push({
      isMarker: false,
      text: cleaned.substring(lastIndex)
    });
  }

  if (parts.length === 0) {
    parts.push({
      isMarker: false,
      text: cleaned
    });
  }

  cleaned = parts.map(part => {
    if (part.isMarker) {
      return part.text;
    } else {
      return part.text.replace(/\p{Emoji_Presentation}/gu, '');
    }
  }).join('');

  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

export function getVoiceId(agentType: string): string {
  const envKey = `ELEVENLABS_VOICE_${agentType.toUpperCase()}`;
  const envVoice = process.env[envKey];
  if (envVoice) {
    return envVoice;
  }

  return process.env.ELEVENLABS_VOICE_DEFAULT || process.env.ELEVENLABS_VOICE_ID || '';
}
