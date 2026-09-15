/** Keep microphone audio out of the model until the entire reply has drained.
 * This is half duplex, not acoustic echo cancellation. The tail also covers
 * microphone chunks captured just before the playback-ended event arrived.
 */
export class ReplyGate {
  private replying = false;
  private complete = true;
  private until = 0;
  start() { this.replying = true; this.complete = false; }
  finish(playing: boolean, now: number) {
    this.complete = true;
    if (!playing) this.idle(now);
  }
  idle(now: number) {
    if (this.complete && this.replying) {
      this.replying = false;
      this.until = now + 400;
    }
  }
  interrupt(now: number) {
    this.complete = true;
    this.replying = false;
    this.until = now + 400;
  }
  allowsInput(now: number) { return !this.replying && now >= this.until; }
}

/** Bounded, memory-only first utterance. Never open the microphone early. */
export class OpeningAudio {
  private chunks: string[] = [];
  private send: ((chunk: string) => void) | null = null;
  private closed = false;
  push(chunk: string) {
    if (this.closed) return;
    if (this.send) { this.send(chunk); return; }
    if (this.chunks.length >= 150) throw new Error('voice_opening_buffer_full');
    this.chunks.push(chunk);
  }
  ready(send: (chunk: string) => void) {
    if (this.closed || this.send) return;
    this.send = send;
    for (const chunk of this.chunks) send(chunk);
    this.chunks = [];
  }
  close() { this.closed = true; this.chunks = []; this.send = null; }
}

/** Counts only time awaiting the user, never generation or playback. */
export class InactivityClock {
  private since: number | null = null;
  activity(now: number) { this.since = now; }
  check(now: number, waiting: boolean) {
    if (!waiting) { this.since = null; return false; }
    if (this.since === null) this.since = now;
    return now - this.since >= 20000;
  }
}
