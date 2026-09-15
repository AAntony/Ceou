import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function load(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', code)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const { ReplyGate, OpeningAudio } = load('../../src/features/assistant/live/duplex.ts', {});

test('echo protection holds through inter-chunk gaps, turn completion and acoustic tail', () => {
  const gate = new ReplyGate();
  assert.equal(gate.allowsInput(0), true);
  gate.start(); gate.idle(100);
  assert.equal(gate.allowsInput(1000), false);
  gate.finish(true, 1000);
  assert.equal(gate.allowsInput(1001), false);
  gate.idle(1100);
  assert.equal(gate.allowsInput(1499), false);
  assert.equal(gate.allowsInput(1500), true);
  gate.start(); gate.interrupt(2000);
  assert.equal(gate.allowsInput(2399), false);
  assert.equal(gate.allowsInput(2400), true);
});

test('first utterance is delivered once in order and discarded on cancelled opening', () => {
  const opening = new OpeningAudio(); const sent = [];
  opening.push('first'); opening.push('second');
  assert.deepEqual(sent, []);
  opening.ready(chunk => sent.push(chunk)); opening.push('third');
  opening.ready(chunk => sent.push(chunk));
  assert.deepEqual(sent, ['first', 'second', 'third']);
  opening.close(); opening.push('private');
  assert.equal(sent.length, 3);
  const cancelled = new OpeningAudio(); cancelled.push('private'); cancelled.close();
  cancelled.ready(chunk => sent.push(chunk)); assert.equal(sent.length, 3);
  const stalled = new OpeningAudio();
  for (let i = 0; i < 150; i++) stalled.push('chunk');
  assert.throws(() => stalled.push('overflow'), /buffer_full/);
});
function fixture({ fail = false } = {}) {
  const queues = [];
  const starts = [];
  const deferred = [];
  let sequence = 0;
  // Use the installed library's actual start method: its default -1 is invalid.
  const Queue = load('../../node_modules/react-native-audio-api/src/core/AudioBufferQueueSourceNode.ts', {
    './AudioBufferBaseSourceNode': { __esModule: true, default: class {} },
    '../errors': { RangeError },
  }).default;
  class Context {
    state = 'suspended';
    destination = {};
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createBufferQueueSource() {
      const queue = {
        node: { start: (...args) => starts.push(args) },
        start: Queue.prototype.start,
        connect() {}, stop() {}, clearBuffers() {},
        enqueueBuffer() { return String(++sequence); },
      };
      queues.push(queue);
      return queue;
    }
  }
  const api = {
    AudioContext: Context,
    AudioManager: { setAudioSessionActivity: async () => {} },
    decodePCMInBase64: () => fail ? Promise.reject(new Error('decoder failed')) : new Promise(resolve => deferred.push(resolve)),
  };
  const { createLiveAudio, encodePcm16 } = load('../../src/features/assistant/live/audio.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'react-native-audio-api': api,
  });
  return { audio: createLiveAudio(), queues, starts, deferred, encodePcm16 };
}

test('native 0.13.3 playback starts with a valid explicit offset', async () => {
  const f = fixture();
  f.audio.play('pcm'); await settle(); f.deferred.shift()({}); await settle();
  assert.deepEqual(f.starts, [[0, 0]]);
  assert.equal(f.audio.isPlaying(), true);
  await f.audio.dispose();
});

test('late last-buffer event does not erase newer queued audio', async () => {
  const f = fixture(); let idle = 0;
  f.audio.setOnIdle(() => idle++);
  f.audio.play('one'); f.audio.play('two');
  await settle(); f.deferred.shift()({}); await settle(); f.deferred.shift()({}); await settle();
  f.queues[0].onBufferEnded({ bufferId: '1', isLastBufferInQueue: true });
  assert.equal(f.audio.isPlaying(), true); assert.equal(idle, 0);
  f.queues[0].onBufferEnded({ bufferId: '2', isLastBufferInQueue: true });
  assert.equal(f.audio.isPlaying(), false); assert.equal(idle, 1);
  await f.audio.dispose();
});

test('interruption discards pending decode and notifies when fully idle', async () => {
  const f = fixture(); let idle = 0;
  f.audio.setOnIdle(() => idle++);
  f.audio.play('old'); await settle(); f.audio.flush();
  f.deferred.shift()({}); await settle();
  assert.equal(f.queues.length, 0); assert.equal(f.audio.isPlaying(), false); assert.equal(idle, 1);
  await f.audio.dispose();
});

test('decoder failure is surfaced instead of a silently speaking UI', async () => {
  const f = fixture({ fail: true }); const errors = [];
  f.audio.setOnError(error => errors.push(error.message));
  f.audio.play('bad'); await settle();
  assert.deepEqual(errors, ['decoder failed']); assert.equal(f.audio.isPlaying(), false);
  await f.audio.dispose();
});

test('disposed audio cannot restart after asynchronous decode', async () => {
  const f = fixture(); f.audio.play('old'); await settle();
  await f.audio.dispose(); f.deferred.shift()({}); await settle();
  assert.equal(f.queues.length, 0);
});

test('microphone encoding is little-endian PCM16 with correct 48k to 16k duration', () => {
  const f = fixture();
  assert.deepEqual([...Buffer.from(f.encodePcm16(new Float32Array([-1, 0, 1]), 3, 16000), 'base64')], [0, 128, 0, 0, 255, 127]);
  assert.equal(Buffer.from(f.encodePcm16(new Float32Array(4800), 4800, 48000), 'base64').length, 3200);
});

test('mixed Gemini event delivers tool calls, audio and transcripts; interruption drops obsolete audio', () => {
  const { LiveConnection } = load('../../src/features/assistant/live/connection.ts', {});
  const events = [];
  const connection = new LiveConnection('not-a-token', 'test', {
    onToolCall: () => events.push('tool'), onAudio: () => events.push('audio'),
    onInputTranscript: () => events.push('input'), onOutputTranscript: () => events.push('output'),
    onInterrupted: () => events.push('interrupted'), onTurnComplete: () => events.push('done'),
  });
  const serverContent = { modelTurn: { parts: [{ inlineData: { data: 'pcm', mimeType: 'audio/pcm;rate=24000' } }] },
    inputTranscription: { text: 'bonjour' }, outputTranscription: { text: 'bonjour !' }, turnComplete: true };
  connection.receive(JSON.stringify({ toolCall: { functionCalls: [{ id: '1', name: 'find_objects' }] }, serverContent }));
  assert.deepEqual(events, ['tool', 'audio', 'input', 'output', 'done']);
  events.length = 0;
  connection.receive(JSON.stringify({ serverContent: { ...serverContent, interrupted: true } }));
  assert.deepEqual(events, ['input', 'output', 'interrupted', 'done']);
  connection.close(); events.length = 0;
  connection.receive(JSON.stringify({ serverContent })); assert.deepEqual(events, []);
});
