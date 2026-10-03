"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./BimpeMissionInput.module.css";

type InputMode = "CHAT" | "LIVE";
type Speaker = "SABI" | "YOU";
type IntakeSlot =
  | "need"
  | "location"
  | "quantity"
  | "budget"
  | "deadline"
  | "confirm";

type IntakeState = {
  need?: string;
  location?: string;
  quantity?: string;
  budget?: string;
  deadline?: string;
  skipped: Array<"quantity" | "budget" | "deadline">;
};

type ConversationMessage = {
  id: number;
  speaker: Speaker;
  text: string;
};

type IntakeResponse = {
  data?: {
    reply?: string;
    state?: IntakeState;
    currentSlot?: IntakeSlot;
    confirmed?: boolean;
    missionRequest?: string;
    restarted?: boolean;
    bimpeChannel?: "test-webchat" | "live-webchat";
  };
  error?: string;
  message?: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const INITIAL_STATE: IntakeState = { skipped: [] };

function friendlySlot(slot: IntakeSlot | null): string {
  switch (slot) {
    case "need": return "Need";
    case "location": return "Location";
    case "quantity": return "Quantity";
    case "budget": return "Budget";
    case "deadline": return "Deadline";
    case "confirm": return "Confirm";
    default: return "Starting";
  }
}

export function BimpeMissionInput() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const currentSlotRef = useRef<IntakeSlot | null>(null);
  const stateRef = useRef<IntakeState>(INITIAL_STATE);
  const inputModeRef = useRef<InputMode>("CHAT");
  const messageIdRef = useRef(0);
  const sessionIdRef = useRef("");
  const autoListenAfterSpeechRef = useRef(false);

  const [mode, setMode] = useState<InputMode>("CHAT");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentSlot, setCurrentSlot] = useState<IntakeSlot | null>(null);
  const [answer, setAnswer] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [thinking, setThinking] = useState(false);
  const [creatingMission, setCreatingMission] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceProvider, setVoiceProvider] = useState<"YarnGPT" | "Browser fallback" | "Text only" | null>(null);
  const [bimpeChannel, setBimpeChannel] = useState<"test-webchat" | "live-webchat" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { inputModeRef.current = mode; }, [mode]);
  useEffect(() => { currentSlotRef.current = currentSlot; }, [currentSlot]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceSupported(false);
      return () => window.speechSynthesis?.cancel();
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-NG";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (!transcript) continue;
        if (result.isFinal) finalText += `${transcript} `;
        else interimText += `${transcript} `;
      }
      setInterimTranscript(interimText.trim());
      if (finalText.trim()) {
        setInterimTranscript("");
        setListening(false);
        void submitAnswer(finalText.trim(), true);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setInterimTranscript("");
      if (event.error === "no-speech") {
        setError("I didn’t hear anything. Tap the microphone and answer SABI again.");
      } else if (event.error !== "aborted") {
        setError("Your browser could not capture that answer clearly. Try the microphone again or switch to Chat.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort?.();
      recognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();
    void startIntake(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function appendMessage(speaker: Speaker, text: string) {
    const clean = text.trim();
    if (!clean) return;
    messageIdRef.current += 1;
    setMessages((current) => [...current, { id: messageIdRef.current, speaker, text: clean }].slice(-10));
  }

  function chooseBrowserVoice() {
    if (!("speechSynthesis" in window)) return undefined;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => voice.lang.toLowerCase() === "en-ng") ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
  }

  async function browserFallbackSpeak(text: string): Promise<boolean> {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
    await new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-NG";
      utterance.rate = 0.98;
      utterance.pitch = 1;
      const voice = chooseBrowserVoice();
      if (voice) utterance.voice = voice;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
    return true;
  }

  async function speakReply(text: string): Promise<void> {
    if (inputModeRef.current !== "LIVE") return;
    setSpeaking(true);
    setVoiceProvider(null);
    try {
      const response = await fetch("/api/voice/yarngpt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        cache: "no-store"
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          try {
            const audio = new Audio(url);
            await new Promise<void>((resolve, reject) => {
              audio.onended = () => resolve();
              audio.onerror = () => reject(new Error("YARNGPT_AUDIO_PLAYBACK_FAILED"));
              void audio.play().catch(reject);
            });
            setVoiceProvider("YarnGPT");
            return;
          } finally {
            URL.revokeObjectURL(url);
          }
        }
      }
      const usedFallback = await browserFallbackSpeak(text);
      setVoiceProvider(usedFallback ? "Browser fallback" : "Text only");
    } catch {
      const usedFallback = await browserFallbackSpeak(text);
      setVoiceProvider(usedFallback ? "Browser fallback" : "Text only");
    } finally {
      setSpeaking(false);
    }
  }

  function startRecognition(force = false) {
    if (!voiceSupported || (!force && (thinking || creatingMission || speaking || listening))) return;
    setError(null);
    setInterimTranscript("");
    try {
      recognitionRef.current?.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("The microphone is already active. Try again in a moment.");
    }
  }

  async function consumeIntakeResponse(response: Response, result: IntakeResponse, speak: boolean) {
    if (!response.ok || !result.data?.reply || !result.data.currentSlot || !result.data.state) {
      throw new Error(result.message ?? "SABI could not get the next response from Bimpe. No mission was created.");
    }

    stateRef.current = result.data.state;
    currentSlotRef.current = result.data.currentSlot;
    setCurrentSlot(result.data.currentSlot);
    setBimpeChannel(result.data.bimpeChannel ?? null);
    appendMessage("SABI", result.data.reply);

    if (speak) {
      autoListenAfterSpeechRef.current = !result.data.confirmed;
      await speakReply(result.data.reply);
    }

    if (result.data.confirmed) {
      if (!result.data.missionRequest) {
        throw new Error("Bimpe confirmed the intake but SABI did not receive a mission request.");
      }
      await createRealMission(result.data.missionRequest);
      return;
    }

    if (speak && autoListenAfterSpeechRef.current) {
      autoListenAfterSpeechRef.current = false;
      startRecognition(true);
    }
  }

  async function startIntake(speak: boolean) {
    const sessionId = sessionIdRef.current;
    if (!sessionId || thinking) return;
    setThinking(true);
    setError(null);
    try {
      const response = await fetch("/api/bimpe/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
        cache: "no-store"
      });
      const result = (await response.json().catch(() => ({}))) as IntakeResponse;
      await consumeIntakeResponse(response, result, speak);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SABI could not start the Bimpe conversation. No mission was created.");
    } finally {
      setThinking(false);
    }
  }

  async function submitAnswer(text: string, fromVoice = false) {
    const clean = text.trim();
    const slot = currentSlotRef.current;
    if (!clean || !slot || thinking || creatingMission) return;
    recognitionRef.current?.stop();
    setListening(false);
    setAnswer("");
    setInterimTranscript("");
    setError(null);
    appendMessage("YOU", clean);
    setThinking(true);
    try {
      const response = await fetch("/api/bimpe/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          currentSlot: slot,
          answer: clean,
          state: stateRef.current
        }),
        cache: "no-store"
      });
      const result = (await response.json().catch(() => ({}))) as IntakeResponse;
      await consumeIntakeResponse(response, result, fromVoice || inputModeRef.current === "LIVE");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SABI could not continue the Bimpe conversation. No provider was contacted.");
    } finally {
      setThinking(false);
    }
  }

  async function createRealMission(missionRequest: string) {
    if (creatingMission) return;
    setCreatingMission(true);
    setError(null);
    try {
      const response = await fetch("/api/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: missionRequest, mode: "LIVE" }),
        cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.mission?.id) {
        throw new Error(result?.message ?? "SABI could not create the live mission. No provider was contacted.");
      }
      router.push(`/mission/${encodeURIComponent(result.mission.id)}`);
    } catch (caught) {
      setCreatingMission(false);
      throw caught;
    }
  }

  async function resetConversation() {
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    sessionIdRef.current = crypto.randomUUID();
    stateRef.current = INITIAL_STATE;
    currentSlotRef.current = null;
    setCurrentSlot(null);
    setMessages([]);
    setAnswer("");
    setInterimTranscript("");
    setListening(false);
    setSpeaking(false);
    setVoiceProvider(null);
    setBimpeChannel(null);
    setError(null);
    await startIntake(mode === "LIVE");
  }

  async function switchMode(nextMode: InputMode) {
    if (thinking || creatingMission) return;
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    setListening(false);
    setSpeaking(false);
    setMode(nextMode);
    inputModeRef.current = nextMode;
    setError(null);
    if (nextMode === "LIVE") {
      const latestSabi = [...messages].reverse().find((message) => message.speaker === "SABI");
      if (latestSabi) {
        await speakReply(latestSabi.text);
        startRecognition(true);
      }
    }
  }

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAnswer(answer, false);
  }

  const busy = thinking || creatingMission;
  const statusText = creatingMission
    ? "Creating the real mission…"
    : thinking
      ? "Bimpe is thinking…"
      : speaking
        ? "SABI is speaking…"
        : listening
          ? "Listening for your answer…"
          : `Next: ${friendlySlot(currentSlot)}`;

  return (
    <div className={styles.shell}>
      <div className={styles.modeSwitch} role="tablist" aria-label="Talk to SABI">
        <button type="button" role="tab" aria-selected={mode === "CHAT"} className={mode === "CHAT" ? styles.activeMode : ""} onClick={() => void switchMode("CHAT")} disabled={busy}>Chat</button>
        <button type="button" role="tab" aria-selected={mode === "LIVE"} className={mode === "LIVE" ? styles.activeMode : ""} onClick={() => void switchMode("LIVE")} disabled={busy}>
          <span className={styles.liveDot} aria-hidden="true" />Live with Bimpe
        </button>
      </div>

      <section className={styles.conversationCard} aria-label="SABI live agent conversation">
        <div className={styles.runtimeBar}>
          <div className={styles.runtimeBadges}>
            <span className={styles.agentBadge}>Bimpe agent</span>
            {bimpeChannel ? <span className={bimpeChannel === "live-webchat" ? styles.liveBadge : styles.testBadge}>{bimpeChannel === "live-webchat" ? "Live webchat" : "Test webchat"}</span> : null}
            {mode === "LIVE" && voiceProvider ? <span className={voiceProvider === "YarnGPT" ? styles.voiceBadge : styles.fallbackBadge}>Voice: {voiceProvider}</span> : null}
          </div>
          <span className={styles.turnStatus}>{statusText}</span>
        </div>

        <div className={styles.transcript} role="log" aria-live="polite">
          {messages.length === 0 && thinking ? <div className={styles.agentTyping}><span /><span /><span /></div> : null}
          {messages.map((message) => (
            <div key={message.id} className={`${styles.messageRow} ${message.speaker === "YOU" ? styles.userRow : styles.sabiRow}`}>
              <div className={styles.speakerMark} aria-hidden="true">{message.speaker === "YOU" ? "Y" : "S"}</div>
              <div className={styles.messageBubble}>
                <strong>{message.speaker === "YOU" ? "You" : "SABI · Bimpe"}</strong>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
          {interimTranscript ? (
            <div className={`${styles.messageRow} ${styles.userRow} ${styles.interim}`}>
              <div className={styles.speakerMark} aria-hidden="true">Y</div>
              <div className={styles.messageBubble}><strong>You · listening</strong><p>{interimTranscript}</p></div>
            </div>
          ) : null}
          {thinking && messages.length > 0 ? <div className={styles.agentTyping} aria-label="Bimpe is thinking"><span /><span /><span /></div> : null}
        </div>

        {mode === "CHAT" ? (
          <form className={styles.answerComposer} onSubmit={handleChatSubmit}>
            <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={currentSlot ? "Answer SABI…" : "Connecting to Bimpe…"} disabled={!currentSlot || busy} autoComplete="off" />
            <button type="submit" disabled={!answer.trim() || !currentSlot || busy}><span aria-hidden="true">↑</span><span className={styles.srOnly}>Send answer</span></button>
          </form>
        ) : (
          <div className={styles.liveControls}>
            <div className={`${styles.voiceOrb} ${listening ? styles.listening : ""} ${speaking ? styles.speaking : ""}`}><span /><span /><div className={styles.voiceCore}>S</div></div>
            {!voiceSupported ? (
              <button type="button" className={styles.micButton} onClick={() => void switchMode("CHAT")}>Voice input unavailable — use Chat</button>
            ) : listening ? (
              <button type="button" className={`${styles.micButton} ${styles.stopButton}`} onClick={() => recognitionRef.current?.stop()}>Stop listening</button>
            ) : (
              <button type="button" className={styles.micButton} onClick={() => startRecognition()} disabled={!currentSlot || busy || speaking}>{speaking ? "SABI is speaking" : "Answer SABI"}</button>
            )}
            <p>Your microphone is captured by the browser. The conversation turn itself is sent to the Bimpe agent.</p>
          </div>
        )}

        <div className={styles.footerBar}>
          <span>SABI asks one thing at a time and waits for you.</span>
          <button type="button" onClick={() => void resetConversation()} disabled={busy}>Start over</button>
        </div>
      </section>

      {error ? <div className={styles.errorPanel} role="alert"><strong>Live agent paused safely</strong><span>{error}</span></div> : null}
    </div>
  );
}
