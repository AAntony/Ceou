// LE FIL AVEC GEMINI LIVE, ET RIEN D'AUTRE.
//
// Une WebSocket vers le point d'entrée « contraint » : le jeton éphémère porte
// déjà le modèle, la voix, les consignes et les outils (voir supabase/
// functions/voice-session). Le message d'ouverture ne rappelle donc que le
// modèle — tout le reste est verrouillé côté serveur et ne se négocie pas ici.
//
// Ce fichier ne sait ni jouer un son, ni exécuter un outil : il traduit le
// protocole en appels de fonctions, pour que la logique de conversation se
// lise sans JSON au milieu.

const ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

export type FunctionCall = { id: string; name: string; args?: Record<string, unknown> };

export type LiveHandlers = {
  onReady: () => void;
  /** Un morceau de voix, PCM 16 bits 24 kHz en base64. */
  onAudio: (base64: string) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  /** Le serveur a entendu l'utilisateur parler par-dessus : ce qui reste à dire est caduc. */
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onToolCall: (calls: FunctionCall[]) => void;
  /** Le serveur va couper bientôt (maintenance, limite atteinte). */
  onGoAway: () => void;
  onClose: (detail: { code: number; reason: string; failed: boolean }) => void;
};

type ServerMessage = {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string }; text?: string }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  toolCall?: { functionCalls?: FunctionCall[] };
  goAway?: unknown;
};

/** Les trames arrivent en texte ou en binaire selon la plateforme : on lit les deux. */
function decodeFrame(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(data);
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    // Repli sans TextDecoder, absent de certains moteurs JS mobiles : lent sur
    // un gros message audio, mais jamais faux.
    let encoded = '';
    for (let i = 0; i < bytes.length; i++) encoded += `%${bytes[i].toString(16).padStart(2, '0')}`;
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
  return null;
}

export class LiveConnection {
  private socket: WebSocket | null = null;
  private closedByUs = false;

  constructor(
    private readonly token: string,
    private readonly model: string,
    private readonly handlers: LiveHandlers,
  ) {}

  open(): void {
    const socket = new WebSocket(`${ENDPOINT}?access_token=${encodeURIComponent(this.token)}`);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    socket.onopen = () => {
      this.send({ setup: { model: `models/${this.model}` } });
    };
    socket.onmessage = (event) => this.receive(event.data);
    socket.onerror = () => {
      // `onclose` suit toujours : c'est lui qui prévient, une seule fois.
    };
    socket.onclose = (event) => {
      this.socket = null;
      this.handlers.onClose({ code: event.code, reason: event.reason ?? '', failed: !this.closedByUs && event.code !== 1000 });
    };
  }

  sendAudio(base64Pcm16k: string): void {
    this.send({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: base64Pcm16k } } });
  }

  /**
   * Un message texte en pleine conversation. Pour ce modèle, `clientContent`
   * ne sert qu'à l'historique d'ouverture : le texte passe par `realtimeInput`.
   */
  sendText(text: string): void {
    this.send({ realtimeInput: { text } });
  }

  sendToolResponses(responses: { id: string; name: string; response: Record<string, unknown> }[]): void {
    this.send({ toolResponse: { functionResponses: responses } });
  }

  close(): void {
    this.closedByUs = true;
    this.socket?.close(1000, 'client_closed');
  }

  private send(message: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private receive(data: unknown): void {
    if (this.closedByUs) return;
    const raw = decodeFrame(data);
    if (!raw) return;
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    if (message.setupComplete) {
      this.handlers.onReady();
      return;
    }
    if (message.toolCall?.functionCalls?.length) {
      this.handlers.onToolCall(message.toolCall.functionCalls);
    }
    if (message.goAway) this.handlers.onGoAway();

    const content = message.serverContent;
    if (!content) return;

    for (const part of content.modelTurn?.parts ?? []) {
      if (!content.interrupted && part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) {
        this.handlers.onAudio(part.inlineData.data);
      }
    }
    // Transcriptions lues À CÔTÉ de l'audio, jamais en alternative : le serveur
    // regroupe volontiers les deux dans le même message.
    if (content.inputTranscription?.text) this.handlers.onInputTranscript(content.inputTranscription.text);
    if (content.outputTranscription?.text) this.handlers.onOutputTranscript(content.outputTranscription.text);
    if (content.interrupted) this.handlers.onInterrupted();
    if (content.turnComplete) this.handlers.onTurnComplete();
  }
}
