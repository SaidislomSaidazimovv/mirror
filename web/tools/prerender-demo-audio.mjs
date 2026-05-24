#!/usr/bin/env node
/**
 * prerender-demo-audio — generate the pre-rendered MP3 fallback for
 * each demo sentence using the hardcoded clone (Mirror DevHandover
 * v02 §6.6 + §10).
 *
 * Run from web/:  npm run prerender-demo-audio
 *
 * Reads ELEVENLABS_API_KEY + ELEVENLABS_MODEL from ../api/.env and the
 * preset voice from src/data/demoUser.ts. For each of the three demo
 * sentences in src/lib/demoData.ts, hits ElevenLabs Flash v2.5 with
 * spec voice_settings and writes the MP3 bytes to
 * web/public/demo-audio/{sentenceId}.mp3.
 *
 * The GoldenStage already falls back to /demo-audio/{sentenceId}.mp3
 * when the live ElevenLabs call fails — populating those files closes
 * §10's "Wi-Fi dies mid-demo" mitigation.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../../api/.env");
const DEMO_USER_PATH = resolve(__dirname, "../src/data/demoUser.ts");
const DEMO_DATA_PATH = resolve(__dirname, "../src/lib/demoData.ts");
const OUTPUT_DIR = resolve(__dirname, "../public/demo-audio");

function readEnv(path) {
  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch (err) {
    console.error(`Cannot read ${path}: ${err.message}`);
    process.exit(1);
  }
  const env = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

// Lightweight extract of the preset voice ID from demoUser.ts source.
function readPresetVoiceId() {
  const text = readFileSync(DEMO_USER_PATH, "utf-8");
  const match = text.match(/voiceId:\s*"([^"]+)"/);
  if (!match) {
    console.error("DEMO_USER.voiceId is null — run npm run sync-demo-voice first.");
    process.exit(1);
  }
  return match[1];
}

// Pull (id, pinyin) tuples out of DEMO_SENTENCES via plain regex so we
// don't need to bundle TS at script time.
function readDemoSentences() {
  const text = readFileSync(DEMO_DATA_PATH, "utf-8");
  const blocks = text.split(/(?=^\s*\{\s*$)/m); // crude split on object boundaries
  const out = [];
  const idRe = /id:\s*"([^"]+)"/;
  const pinyinRe = /pinyin:\s*"([^"]+)"/;
  for (const block of blocks) {
    const idMatch = block.match(idRe);
    const pinyinMatch = block.match(pinyinRe);
    if (idMatch && pinyinMatch) out.push({ id: idMatch[1], pinyin: pinyinMatch[1] });
  }
  // De-dupe by id, keeping the first hit.
  const seen = new Set();
  return out.filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
}

const env = readEnv(ENV_PATH);
const key = env.ELEVENLABS_API_KEY;
const model = env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
if (!key || key === "your_elevenlabs_key_here") {
  console.error("ELEVENLABS_API_KEY missing or placeholder in api/.env");
  process.exit(1);
}

const voiceId = readPresetVoiceId();
const sentences = readDemoSentences();
if (sentences.length === 0) {
  console.error("No sentences found in demoData.ts");
  process.exit(1);
}

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

console.log(`Using voice ${voiceId} via ${model}`);
console.log(`Rendering ${sentences.length} sentences → ${OUTPUT_DIR}`);

for (const s of sentences) {
  const outPath = resolve(OUTPUT_DIR, `${s.id}.mp3`);
  process.stdout.write(`  ${s.id}.mp3 ... `);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: s.pinyin,
        model_id: model,
        // v02 §14.2 voice_settings — clean Mandarin tones, low style.
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.85,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );
  if (!res.ok) {
    console.log(`FAIL (${res.status})`);
    const body = await res.text();
    console.error(body.slice(0, 200));
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  console.log(`${(buf.length / 1024).toFixed(1)} KB`);
}

console.log();
console.log("Done.");
console.log("Next: commit web/public/demo-audio/*.mp3 + push.");
