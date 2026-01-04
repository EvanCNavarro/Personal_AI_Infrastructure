#!/usr/bin/env bun
// $PAI_DIR/voice-server/server.ts
// Voice notification server with cascading TTS: ElevenLabs → Piper → macOS

import { serve } from "bun";
import { spawn, execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

// Load .env from PAI directory
const paiDir = expandPath(process.env.PAI_DIR || join(homedir(), '.claude'));
const envPath = join(paiDir, '.env');
if (existsSync(envPath)) {
  const envContent = await Bun.file(envPath).text();
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const PORT = parseInt(process.env.PAI_VOICE_PORT || "8888");
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error(`⚠️  ELEVENLABS_API_KEY not found in ${envPath}`);
  console.error('Add: ELEVENLABS_API_KEY=your_key_here to $PAI_DIR/.env');
}

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "s3TPKV1kjDlVtZbl4Ksh";
const CHIME_ENABLED = process.env.VOICE_CHIME_ENABLED !== 'false';
const CHIME_PATH = expandPath(process.env.VOICE_CHIME_PATH || join(paiDir, 'voice-server', 'chime.mp3'));

// TTS Provider configuration
type TTSProvider = 'elevenlabs' | 'piper' | 'macos';
const TTS_PROVIDER = (process.env.TTS_PROVIDER as TTSProvider) || 'elevenlabs';
const PIPER_MODEL_PATH = expandPath(process.env.PIPER_MODEL_PATH || join(paiDir, 'voice-server', 'piper-models', 'en_US-lessac-medium.onnx'));
const MACOS_VOICE = process.env.MACOS_VOICE || 'Samantha'; // Default macOS voice

// Track ElevenLabs failures to auto-fallback
let elevenLabsFailCount = 0;
const ELEVENLABS_MAX_FAILS = 3;

interface VoiceConfig {
  voice_id: string;
  voice_name: string;
  stability: number;
  similarity_boost: number;
  description: string;
}

interface VoicesConfig {
  default_volume?: number;
  voices: Record<string, VoiceConfig>;
}

const EMOTIONAL_PRESETS: Record<string, { stability: number; similarity_boost: number }> = {
  'excited': { stability: 0.7, similarity_boost: 0.9 },
  'celebration': { stability: 0.65, similarity_boost: 0.85 },
  'insight': { stability: 0.55, similarity_boost: 0.8 },
  'creative': { stability: 0.5, similarity_boost: 0.75 },
  'success': { stability: 0.6, similarity_boost: 0.8 },
  'progress': { stability: 0.55, similarity_boost: 0.75 },
  'investigating': { stability: 0.6, similarity_boost: 0.85 },
  'debugging': { stability: 0.55, similarity_boost: 0.8 },
  'learning': { stability: 0.5, similarity_boost: 0.75 },
  'pondering': { stability: 0.65, similarity_boost: 0.8 },
  'focused': { stability: 0.7, similarity_boost: 0.85 },
  'caution': { stability: 0.4, similarity_boost: 0.6 },
  'urgent': { stability: 0.3, similarity_boost: 0.9 },
};

let voicesConfig: VoicesConfig | null = null;
try {
  const voicesPath = join(paiDir, 'config', 'voice-personalities.json');
  if (existsSync(voicesPath)) {
    const voicesContent = readFileSync(voicesPath, 'utf-8');
    voicesConfig = JSON.parse(voicesContent);
    console.log('✅ Loaded voice personalities from config');
  }
} catch (error) {
  console.warn('⚠️  Failed to load voice personalities, using defaults');
}

function extractEmotionalMarker(message: string): { cleaned: string; emotion?: string } {
  const emojiToEmotion: Record<string, string> = {
    '💥': 'excited', '🎉': 'celebration', '💡': 'insight', '🎨': 'creative',
    '✨': 'success', '📈': 'progress', '🔍': 'investigating', '🐛': 'debugging',
    '📚': 'learning', '🤔': 'pondering', '🎯': 'focused', '⚠️': 'caution', '🚨': 'urgent'
  };

  const emotionMatch = message.match(/\[(💥|🎉|💡|🎨|✨|📈|🔍|🐛|📚|🤔|🎯|⚠️|🚨)\s+(\w+)\]/);
  if (emotionMatch) {
    const emoji = emotionMatch[1];
    const emotionName = emotionMatch[2].toLowerCase();
    if (emojiToEmotion[emoji] === emotionName) {
      return {
        cleaned: message.replace(emotionMatch[0], '').trim(),
        emotion: emotionName
      };
    }
  }
  return { cleaned: message };
}

function getVoiceConfig(identifier: string): VoiceConfig | null {
  if (!voicesConfig) return null;
  if (voicesConfig.voices[identifier]) return voicesConfig.voices[identifier];
  for (const config of Object.values(voicesConfig.voices)) {
    if (config.voice_id === identifier) return config;
  }
  return null;
}

function sanitizeForSpeech(input: string): string {
  return input
    .replace(/<script/gi, '')
    .replace(/\.\.\//g, '')
    .replace(/[;&|><`$\\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .trim()
    .substring(0, 500);
}

function validateInput(input: any): { valid: boolean; error?: string; sanitized?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Invalid input type' };
  }
  if (input.length > 500) {
    return { valid: false, error: 'Message too long (max 500 characters)' };
  }
  const sanitized = sanitizeForSpeech(input);
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Message contains no valid content after sanitization' };
  }
  return { valid: true, sanitized };
}

async function generateSpeechElevenLabs(
  text: string,
  voiceId: string,
  voiceSettings?: { stability: number; similarity_boost: number }
): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const settings = voiceSettings || { stability: 0.5, similarity_boost: 0.5 };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: settings,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Check for quota/rate limit errors
    if (response.status === 429 || errorText.includes('quota') || errorText.includes('limit')) {
      elevenLabsFailCount = ELEVENLABS_MAX_FAILS; // Force fallback
    }
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  elevenLabsFailCount = 0; // Reset on success
  return await response.arrayBuffer();
}

async function generateSpeechPiper(text: string): Promise<ArrayBuffer> {
  if (!existsSync(PIPER_MODEL_PATH)) {
    throw new Error(`Piper model not found at ${PIPER_MODEL_PATH}`);
  }

  const tempFile = `/tmp/piper-${Date.now()}.wav`;

  return new Promise((resolve, reject) => {
    const proc = spawn('piper', [
      '--model', PIPER_MODEL_PATH,
      '--output_file', tempFile
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.stdin.write(text);
    proc.stdin.end();

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('error', (error) => {
      reject(new Error(`Piper process error: ${error.message}`));
    });

    proc.on('exit', async (code) => {
      if (code !== 0) {
        reject(new Error(`Piper exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const audioData = await Bun.file(tempFile).arrayBuffer();
        spawn('/bin/rm', [tempFile]); // Cleanup
        resolve(audioData);
      } catch (err: any) {
        reject(new Error(`Failed to read Piper output: ${err.message}`));
      }
    });
  });
}

async function generateSpeechMacOS(text: string): Promise<ArrayBuffer> {
  const tempFile = `/tmp/say-${Date.now()}.aiff`;

  return new Promise((resolve, reject) => {
    const proc = spawn('/usr/bin/say', [
      '-v', MACOS_VOICE,
      '-o', tempFile,
      text
    ]);

    proc.on('error', (error) => {
      reject(new Error(`macOS say error: ${error.message}`));
    });

    proc.on('exit', async (code) => {
      if (code !== 0) {
        reject(new Error(`macOS say exited with code ${code}`));
        return;
      }

      try {
        const audioData = await Bun.file(tempFile).arrayBuffer();
        spawn('/bin/rm', [tempFile]); // Cleanup
        resolve(audioData);
      } catch (err: any) {
        reject(new Error(`Failed to read macOS say output: ${err.message}`));
      }
    });
  });
}

// Cascading TTS: ElevenLabs → Piper → macOS
async function generateSpeech(
  text: string,
  voiceId: string,
  voiceSettings?: { stability: number; similarity_boost: number }
): Promise<{ audio: ArrayBuffer; provider: TTSProvider; format: 'mp3' | 'wav' | 'aiff' }> {
  const providers: TTSProvider[] = [];

  // Determine provider order based on config and availability
  if (TTS_PROVIDER === 'elevenlabs' && ELEVENLABS_API_KEY && elevenLabsFailCount < ELEVENLABS_MAX_FAILS) {
    providers.push('elevenlabs');
  }
  if (TTS_PROVIDER !== 'macos' && existsSync(PIPER_MODEL_PATH)) {
    providers.push('piper');
  }
  providers.push('macos'); // Always available as final fallback

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`🎙️  Trying ${provider}...`);

      switch (provider) {
        case 'elevenlabs':
          const elevenLabsAudio = await generateSpeechElevenLabs(text, voiceId, voiceSettings);
          return { audio: elevenLabsAudio, provider: 'elevenlabs', format: 'mp3' };

        case 'piper':
          const piperAudio = await generateSpeechPiper(text);
          return { audio: piperAudio, provider: 'piper', format: 'wav' };

        case 'macos':
          const macosAudio = await generateSpeechMacOS(text);
          return { audio: macosAudio, provider: 'macos', format: 'aiff' };
      }
    } catch (error: any) {
      console.warn(`⚠️  ${provider} failed: ${error.message}`);
      lastError = error;
      if (provider === 'elevenlabs') {
        elevenLabsFailCount++;
      }
    }
  }

  throw lastError || new Error('All TTS providers failed');
}

function getVolumeSetting(): number {
  if (voicesConfig && typeof voicesConfig.default_volume === 'number') {
    const vol = voicesConfig.default_volume;
    if (vol >= 0 && vol <= 1) return vol;
  }
  return 0.8;
}

async function playAudio(audioBuffer: ArrayBuffer, format: 'mp3' | 'wav' | 'aiff' = 'mp3'): Promise<void> {
  const tempFile = `/tmp/voice-${Date.now()}.${format}`;
  await Bun.write(tempFile, audioBuffer);
  const volume = getVolumeSetting();

  return new Promise((resolve, reject) => {
    const proc = spawn('/usr/bin/afplay', ['-v', volume.toString(), tempFile]);

    proc.on('error', (error) => {
      console.error('Error playing audio:', error);
      reject(error);
    });

    proc.on('exit', (code) => {
      spawn('/bin/rm', [tempFile]);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`afplay exited with code ${code}`));
      }
    });
  });
}

async function playChime(): Promise<void> {
  if (!CHIME_ENABLED || !existsSync(CHIME_PATH)) {
    return;
  }

  const volume = getVolumeSetting();

  return new Promise((resolve) => {
    const proc = spawn('/usr/bin/afplay', ['-v', volume.toString(), CHIME_PATH]);

    proc.on('error', (error) => {
      console.error('Chime playback error:', error);
      resolve(); // Don't block TTS if chime fails
    });

    proc.on('exit', () => {
      resolve();
    });
  });
}

async function sendNotification(
  title: string,
  message: string,
  voiceEnabled = true,
  voiceId: string | null = null
) {
  const titleValidation = validateInput(title);
  const messageValidation = validateInput(message);

  if (!titleValidation.valid) throw new Error(`Invalid title: ${titleValidation.error}`);
  if (!messageValidation.valid) throw new Error(`Invalid message: ${messageValidation.error}`);

  const safeTitle = titleValidation.sanitized!;
  let safeMessage = messageValidation.sanitized!;

  const { cleaned, emotion } = extractEmotionalMarker(safeMessage);
  safeMessage = cleaned;

  if (voiceEnabled) {
    try {
      const voice = voiceId || DEFAULT_VOICE_ID;
      const voiceConfig = getVoiceConfig(voice);

      let voiceSettings = { stability: 0.5, similarity_boost: 0.5 };

      if (emotion && EMOTIONAL_PRESETS[emotion]) {
        voiceSettings = EMOTIONAL_PRESETS[emotion];
        console.log(`🎭 Emotion: ${emotion}`);
      } else if (voiceConfig) {
        voiceSettings = {
          stability: voiceConfig.stability,
          similarity_boost: voiceConfig.similarity_boost
        };
        console.log(`👤 Personality: ${voiceConfig.description}`);
      }

      // Play chime before TTS
      if (CHIME_ENABLED) {
        console.log(`🔔 Playing chime...`);
        await playChime();
      }

      console.log(`📝 Message text: "${safeMessage.substring(0, 100)}..."`);

      const result = await generateSpeech(safeMessage, voice, voiceSettings);
      console.log(`✅ Speech generated via ${result.provider}: ${result.audio.byteLength} bytes`);
      await playAudio(result.audio, result.format);
      console.log(`✅ Audio playback complete (${result.provider})`);
    } catch (error: any) {
      console.error("❌ TTS Error:", error?.message || error);
      const errorLog = `${new Date().toISOString()} - TTS Error: ${error?.message || error}\nMessage: ${safeMessage}\n\n`;
      await Bun.write(`${paiDir}/voice-server/error.log`, errorLog, { flags: 'a' });
    }
  }
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const clientIp = req.headers.get('x-forwarded-for') || 'localhost';

    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://localhost",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ status: "error", message: "Rate limit exceeded" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    if (url.pathname === "/notify" && req.method === "POST") {
      try {
        const data = await req.json();
        const title = data.title || "PAI Notification";
        const message = data.message || "Task completed";
        const voiceEnabled = data.voice_enabled !== false;
        const voiceId = data.voice_id || data.voice_name || null;

        if (voiceId && typeof voiceId !== 'string') {
          throw new Error('Invalid voice_id');
        }

        console.log(`📨 Notification: "${title}" - "${message.substring(0, 50)}..."`);

        await sendNotification(title, message, voiceEnabled, voiceId);

        return new Response(
          JSON.stringify({ status: "success", message: "Notification sent" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } catch (error: any) {
        console.error("Notification error:", error);
        return new Response(
          JSON.stringify({ status: "error", message: error.message || "Internal server error" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: error.message?.includes('Invalid') ? 400 : 500 }
        );
      }
    }

    if (url.pathname === "/health") {
      const providers = {
        elevenlabs: { available: !!ELEVENLABS_API_KEY, failCount: elevenLabsFailCount },
        piper: { available: existsSync(PIPER_MODEL_PATH), model: PIPER_MODEL_PATH },
        macos: { available: true, voice: MACOS_VOICE }
      };
      return new Response(
        JSON.stringify({
          status: "healthy",
          port: PORT,
          tts_provider: TTS_PROVIDER,
          providers,
          default_voice_id: DEFAULT_VOICE_ID,
          chime_enabled: CHIME_ENABLED
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response("PAI Voice Server - POST to /notify (Cascading TTS: ElevenLabs → Piper → macOS)", {
      headers: corsHeaders,
      status: 200
    });
  },
});

console.log(`🚀 Voice Server running on port ${PORT}`);
console.log(`🎙️  TTS Provider: ${TTS_PROVIDER} (cascade: ElevenLabs → Piper → macOS)`);
console.log(`   ElevenLabs: ${ELEVENLABS_API_KEY ? '✅ API key configured' : '❌ No API key'}`);
console.log(`   Piper: ${existsSync(PIPER_MODEL_PATH) ? '✅ Model found' : '❌ Model not found'}`);
console.log(`   macOS: ✅ Always available (voice: ${MACOS_VOICE})`);
console.log(`🔔 Chime: ${CHIME_ENABLED ? '✅ Enabled' : '❌ Disabled'}${CHIME_ENABLED && existsSync(CHIME_PATH) ? ` (${CHIME_PATH})` : ''}`);
console.log(`📡 POST to http://localhost:${PORT}/notify`);
console.log(`🔒 Security: CORS restricted to localhost, rate limiting enabled`);
