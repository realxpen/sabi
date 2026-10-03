"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type InputMode = "TEXT" | "VOICE";
type VoiceTurn = "REQUEST" | "CONFIRMATION";
type LiveSpeaker = "SABI" | "YOU";

type LiveMessage = {
  id: number;
  speaker: LiveSpeaker;
  text: string;
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
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const EXAMPLES = [
  "Find me 12 bottles of perfume under ₦120,000 delivered to Yaba tomorrow.",
  "Find a photographer in Lagos for Saturday under ₦80,000.",
  "I need someone to repair my AC in Yaba today.",
  "Find lunch for 6 people near Ikeja under ₦30,000."
];

const LOADING_MESSAGES = [
  "Understanding your request…",
  "Turning it into a mission…",
  "Preparing SABI…"
];

const START_WORDS = [
  "yes",
  "start",
  "start mission",
  "send it",
  "go ahead",
  "proceed",
  "do it",
  "that's right",
  "that is right",
  "correct"
];

const RETRY_WORDS = [
  "no",
  "try again",
  "start again",
  "change it",
  "redo",
  "again"
];

export function MissionInput() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceTurnRef = useRef<VoiceTurn>("REQUEST");
  const requestRef = useRef("");
  const messageIdRef = useRef(0);

  const [request, setRequest] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("TEXT");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceOutputSupported, setVoiceOutputSupported] = useState(true);
  const [voiceTurn, setVoiceTurn] = useState<VoiceTurn>("REQUEST");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    const storedCaptions = window.localStorage.getItem("sabi-live-captions");
    if (storedCaptions === "off") setCaptionsEnabled(false);

    setVoiceOutputSupported(
      "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
    );

    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceSupported(false);
      return () => {
        window.speechSynthesis?.cancel();
      };
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

        if (result.isFinal) {
          finalText += `${transcript} `;
        } else {
          interimText += `${transcript} `;
        }
      }

      setInterimTranscript(interimText.trim());

      if (finalText.trim()) {
        setInterimTranscript("");
        void handleVoiceTurn(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setInterimTranscript("");

      if (event.error === "no-speech") {
        setError("I didn’t hear anything. Tap the microphone and try again.");
        return;
      }

      if (event.error !== "aborted") {
        setError("SABI could not hear you clearly. Try again or switch to Chat.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!submitting) {
      setLoadingIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingIndex((current) =>
        Math.min(current + 1, LOADING_MESSAGES.length - 1)
      );
    }, 850);

    return () => window.clearInterval(timer);
  }, [submitting]);

  function appendLiveMessage(speaker: LiveSpeaker, text: string) {
    const clean = text.trim();
    if (!clean) return;

    messageIdRef.current += 1;
    const message: LiveMessage = {
      id: messageIdRef.current,
      speaker,
      text: clean
    };

    setLiveMessages((current) => [...current.slice(-5), message]);
  }

  function chooseVoice() {
    if (!("speechSynthesis" in window)) return undefined;

    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((voice) => voice.lang.toLowerCase() === "en-ng") ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
    );
  }

  function speak(text: string) {
    appendLiveMessage("SABI", text);

    if (
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      setSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-NG";
      utterance.rate = 0.97;
      utterance.pitch = 1;
      const voice = chooseVoice();
      if (voice) utterance.voice = voice;

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        setSpeaking(false);
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }

  function startRecognition(turn: VoiceTurn) {
    if (!voiceSupported || submitting || speaking) return;

    setError(null);
    setInterimTranscript("");
    voiceTurnRef.current = turn;
    setVoiceTurn(turn);

    try {
      recognitionRef.current?.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("Voice input is already active. Try again in a moment.");
    }
  }

  async function beginLiveConversation() {
    if (!voiceSupported || submitting || listening || speaking) return;

    setError(null);
    setRequest("");
    requestRef.current = "";
    setLiveMessages([]);
    voiceTurnRef.current = "REQUEST";
    setVoiceTurn("REQUEST");

    await speak(
      "Hi, I’m SABI. Tell me what you need. You can include your budget, location, quantity, and deadline if they matter."
    );
    startRecognition("REQUEST");
  }

  async function handleVoiceTurn(text: string) {
    setListening(false);
    appendLiveMessage("YOU", text);

    if (voiceTurnRef.current === "REQUEST") {
      const cleanRequest = text.trim();
      setRequest(cleanRequest);
      requestRef.current = cleanRequest;

      await speak(
        `Got it. I heard: ${cleanRequest}. If that sounds right, say start mission. If you want to say it again, say try again.`
      );
      startRecognition("CONFIRMATION");
      return;
    }

    const normalized = text.toLowerCase().replace(/[.,!?]/g, "").trim();
    const approved = START_WORDS.some(
      (phrase) => normalized === phrase || normalized.includes(phrase)
    );
    const retry = RETRY_WORDS.some(
      (phrase) => normalized === phrase || normalized.includes(phrase)
    );

    if (approved) {
      await speak("Perfect. I’ll start the mission now.");
      await createMission(requestRef.current, true);
      return;
    }

    if (retry) {
      setRequest("");
      requestRef.current = "";
      await speak("No problem. Tell me again what you need.");
      startRecognition("REQUEST");
      return;
    }

    await speak(
      "I didn’t catch that choice. Say start mission if the request is right, or say try again to start over."
    );
    startRecognition("CONFIRMATION");
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function switchMode(mode: InputMode) {
    if (submitting) return;

    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setListening(false);
    setSpeaking(false);
    setInterimTranscript("");
    setError(null);
    setInputMode(mode);
  }

  function toggleCaptions() {
    setCaptionsEnabled((current) => {
      const next = !current;
      window.localStorage.setItem("sabi-live-captions", next ? "on" : "off");
      return next;
    });
  }

  async function createMission(overrideRequest?: string, alreadyAnnounced = false) {
    const trimmed = (overrideRequest ?? request).trim();
    if (!trimmed || submitting) return;

    recognitionRef.current?.stop();
    setListening(false);
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/missions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ request: trimmed })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.mission?.id) {
        throw new Error(
          result?.message ?? "SABI could not create this mission right now."
        );
      }

      if (inputMode === "VOICE" && !alreadyAnnounced) {
        await speak("Your mission is ready. I’m starting the search now.");
      }

      router.push(`/mission/${encodeURIComponent(result.mission.id)}`);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "SABI could not create this mission right now.";

      setError(message);
      setSubmitting(false);

      if (inputMode === "VOICE") {
        await speak(`I couldn’t start that mission. ${message}`);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createMission();
  }

  const voiceHeadline = speaking
    ? "SABI is speaking"
    : listening
      ? voiceTurn === "CONFIRMATION"
        ? "Your turn"
        : "I’m listening"
      : liveMessages.length
        ? "Continue with SABI"
        : "Talk to SABI";

  const voiceDescription = !voiceSupported
    ? "Voice input is not available in this browser. You can still use Chat."
    : !voiceOutputSupported
      ? "Spoken replies are unavailable in this browser, so captions will carry the conversation."
      : speaking
        ? "SABI will finish speaking, then listen for your response."
        : listening
          ? voiceTurn === "CONFIRMATION"
            ? "Say “start mission” to continue, or “try again” to start over."
            : "Speak naturally. SABI will respond when you finish."
          : liveMessages.length
            ? "Tap the microphone to continue the conversation, or start the mission when you’re ready."
            : "Have a two-way voice conversation with SABI before starting the mission.";

  return (
    <div className="sabiComposerShell">
      <div className="modeSwitch" role="tablist" aria-label="Choose how to talk to SABI">
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "TEXT"}
          className={inputMode === "TEXT" ? "active" : ""}
          onClick={() => switchMode("TEXT")}
          disabled={submitting}
        >
          <span className="modeIcon" aria-hidden="true">✦</span>
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "VOICE"}
          className={inputMode === "VOICE" ? "active" : ""}
          onClick={() => switchMode("VOICE")}
          disabled={submitting}
        >
          <span className="modeIcon liveDot" aria-hidden="true" />
          Live
        </button>
      </div>

      {inputMode === "TEXT" ? (
        <form className="chatComposer" onSubmit={handleSubmit}>
          <div className="composerTopline">
            <span className="sabiMark" aria-hidden="true">S</span>
            <span>Message SABI</span>
          </div>
          <textarea
            id="mission-request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={4}
            placeholder="What do you need? Add your budget, location or deadline if they matter."
            disabled={submitting}
            autoFocus
          />
          <div className="composerFooter">
            <span className="composerHint">SABI will stop before any commitment or payment.</span>
            <button
              type="submit"
              className="sendButton"
              aria-label="Send mission"
              disabled={!request.trim() || submitting}
            >
              {submitting ? <span className="miniSpinner" /> : <span aria-hidden="true">↑</span>}
            </button>
          </div>
        </form>
      ) : (
        <section className="voiceComposer" aria-label="Live voice conversation with SABI">
          <div className="voiceToolbar">
            <span className={`voiceStatus ${listening ? "listening" : ""} ${speaking ? "speaking" : ""}`}>
              <span aria-hidden="true" />
              {speaking ? "SABI speaking" : listening ? "Listening" : "Live voice"}
            </span>
            <button
              type="button"
              className={`captionToggle ${captionsEnabled ? "active" : ""}`}
              aria-pressed={captionsEnabled}
              onClick={toggleCaptions}
              disabled={!voiceOutputSupported && captionsEnabled}
              title={!voiceOutputSupported ? "Captions stay on because spoken replies are unavailable." : undefined}
            >
              <span className="ccIcon" aria-hidden="true">CC</span>
              Captions {captionsEnabled ? "On" : "Off"}
            </button>
          </div>

          <div className={`voiceOrb ${listening ? "listening" : ""} ${speaking ? "speaking" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
            <div className="voiceOrbCore">S</div>
          </div>

          <div className="voiceCopy">
            <h2>{voiceHeadline}</h2>
            <p>{voiceDescription}</p>
          </div>

          {captionsEnabled && (liveMessages.length > 0 || interimTranscript) ? (
            <div className="liveCaptions" role="log" aria-live="polite" aria-label="Live conversation captions">
              {liveMessages.map((message) => (
                <div key={message.id} className={`captionLine ${message.speaker === "SABI" ? "sabi" : "you"}`}>
                  <strong>{message.speaker === "SABI" ? "SABI" : "You"}</strong>
                  <span>{message.text}</span>
                </div>
              ))}
              {interimTranscript ? (
                <div className="captionLine you interim">
                  <strong>You</strong>
                  <span>{interimTranscript}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="voiceActions">
            {!voiceSupported ? (
              <button type="button" className="listenButton" onClick={() => switchMode("TEXT")}>
                Use Chat instead
              </button>
            ) : listening ? (
              <button type="button" className="listenButton stop" onClick={stopListening}>
                <span className="micGlyph" aria-hidden="true">●</span>
                Stop listening
              </button>
            ) : speaking ? (
              <button type="button" className="listenButton speakingButton" disabled>
                <span className="soundGlyph" aria-hidden="true">)))</span>
                SABI is speaking
              </button>
            ) : liveMessages.length === 0 ? (
              <button type="button" className="listenButton" onClick={beginLiveConversation} disabled={submitting}>
                <span className="micGlyph" aria-hidden="true">●</span>
                Start conversation
              </button>
            ) : (
              <button
                type="button"
                className="listenButton"
                onClick={() => startRecognition(voiceTurn)}
                disabled={submitting}
              >
                <span className="micGlyph" aria-hidden="true">●</span>
                {voiceTurn === "CONFIRMATION" ? "Answer SABI" : "Talk again"}
              </button>
            )}

            {request.trim() && !speaking ? (
              <button
                type="button"
                className="voiceSendButton"
                onClick={() => void createMission()}
                disabled={submitting}
              >
                Start mission
                <span aria-hidden="true">→</span>
              </button>
            ) : null}

            {request.trim() && !listening && !speaking ? (
              <button
                type="button"
                className="voiceResetButton"
                onClick={() => {
                  setRequest("");
                  requestRef.current = "";
                  setLiveMessages([]);
                  setInterimTranscript("");
                  voiceTurnRef.current = "REQUEST";
                  setVoiceTurn("REQUEST");
                  setError(null);
                }}
                disabled={submitting}
              >
                Start over
              </button>
            ) : null}
          </div>

          <p className="voicePrivacyNote">
            Your browser handles microphone capture. SABI still stops before any commitment or payment.
          </p>
        </section>
      )}

      {submitting ? (
        <div className="missionLoading" role="status" aria-live="polite">
          <div className="loadingOrb"><span /></div>
          <div>
            <strong>{LOADING_MESSAGES[loadingIndex]}</strong>
            <small>This usually takes only a moment.</small>
          </div>
        </div>
      ) : null}

      {error ? <p className="composerError">{error}</p> : null}

      {!submitting ? (
        <div className="exampleSection">
          <span>Try asking</span>
          <div className="exampleChips">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setRequest(example);
                  requestRef.current = example;
                  setInputMode("TEXT");
                  setError(null);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .sabiComposerShell {
          display: grid;
          gap: 16px;
          margin-top: 8px;
        }

        .modeSwitch {
          display: inline-flex;
          width: fit-content;
          gap: 4px;
          padding: 4px;
          border: 1px solid rgba(24, 24, 27, 0.08);
          border-radius: 999px;
          background: rgba(239, 235, 226, 0.78);
        }

        .modeSwitch button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          border-radius: 999px;
          padding: 9px 15px;
          background: transparent;
          color: #71717a;
          font-weight: 800;
          cursor: pointer;
          transition: transform 160ms ease, background 160ms ease, color 160ms ease, box-shadow 160ms ease;
        }

        .modeSwitch button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .modeSwitch button.active {
          background: #fff;
          color: #18181b;
          box-shadow: 0 6px 18px rgba(24, 24, 27, 0.08);
        }

        .modeIcon {
          display: inline-grid;
          place-items: center;
          width: 16px;
          height: 16px;
          font-size: 0.8rem;
        }

        .liveDot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #7c5cff;
          box-shadow: 0 0 0 5px rgba(124, 92, 255, 0.11);
        }

        .chatComposer,
        .voiceComposer {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(24, 24, 27, 0.09);
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 22px 60px rgba(35, 29, 50, 0.1);
        }

        .chatComposer {
          display: grid;
          gap: 2px;
          padding: 16px 16px 12px;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }

        .chatComposer:focus-within {
          border-color: rgba(109, 76, 199, 0.45);
          box-shadow: 0 26px 70px rgba(70, 47, 126, 0.14);
          transform: translateY(-1px);
        }

        .composerTopline {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 4px;
          color: #71717a;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .sabiMark {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 8px;
          background: linear-gradient(135deg, #18181b, #7252cf);
          color: white;
          font-size: 0.72rem;
          font-weight: 900;
        }

        .chatComposer textarea {
          width: 100%;
          min-height: 108px;
          resize: none;
          border: 0;
          padding: 15px 4px 10px;
          background: transparent;
          color: #18181b;
          outline: none;
          font-size: clamp(1rem, 2vw, 1.08rem);
          line-height: 1.6;
        }

        .chatComposer textarea::placeholder {
          color: #a1a1aa;
        }

        .composerFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding-top: 8px;
        }

        .composerHint {
          color: #8a8791;
          font-size: 0.76rem;
          line-height: 1.4;
        }

        .sendButton {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 50%;
          background: #18181b;
          color: white;
          cursor: pointer;
          font-size: 1.25rem;
          font-weight: 800;
          transition: transform 160ms ease, opacity 160ms ease;
        }

        .sendButton:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.02);
        }

        .sendButton:disabled {
          opacity: 0.28;
          cursor: default;
        }

        .miniSpinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        .voiceComposer {
          display: grid;
          place-items: center;
          gap: 20px;
          min-height: 430px;
          padding: 26px 24px 24px;
          text-align: center;
          background:
            radial-gradient(circle at 50% 24%, rgba(111, 78, 207, 0.14), transparent 35%),
            rgba(255, 255, 255, 0.95);
        }

        .voiceToolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 12px;
        }

        .voiceStatus {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #706b78;
          font-size: 0.76rem;
          font-weight: 850;
          letter-spacing: 0.02em;
        }

        .voiceStatus > span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #a1a1aa;
          transition: background 180ms ease, box-shadow 180ms ease;
        }

        .voiceStatus.listening > span {
          background: #22a06b;
          box-shadow: 0 0 0 5px rgba(34, 160, 107, 0.12);
        }

        .voiceStatus.speaking > span {
          background: #7c5cff;
          box-shadow: 0 0 0 5px rgba(124, 92, 255, 0.12);
        }

        .captionToggle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid rgba(24, 24, 27, 0.09);
          border-radius: 999px;
          padding: 8px 11px;
          background: rgba(255, 255, 255, 0.8);
          color: #77717f;
          cursor: pointer;
          font-size: 0.74rem;
          font-weight: 800;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }

        .captionToggle.active {
          border-color: rgba(109, 76, 199, 0.22);
          background: #f5f1ff;
          color: #51379d;
        }

        .captionToggle:disabled {
          cursor: default;
          opacity: 0.75;
        }

        .ccIcon {
          display: inline-grid;
          place-items: center;
          min-width: 27px;
          height: 20px;
          padding: 0 5px;
          border-radius: 7px;
          background: currentColor;
          color: white;
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .captionToggle .ccIcon {
          background: #77717f;
        }

        .captionToggle.active .ccIcon {
          background: #6d4cc7;
        }

        .voiceOrb {
          position: relative;
          display: grid;
          place-items: center;
          width: 128px;
          height: 128px;
        }

        .voiceOrb > span {
          position: absolute;
          inset: 18px;
          border-radius: 50%;
          border: 1px solid rgba(109, 76, 199, 0.18);
          transform: scale(1);
        }

        .voiceOrb.listening > span:nth-child(1),
        .voiceOrb.speaking > span:nth-child(1) {
          animation: pulseRing 1.8s ease-out infinite;
        }

        .voiceOrb.listening > span:nth-child(2),
        .voiceOrb.speaking > span:nth-child(2) {
          animation: pulseRing 1.8s 0.45s ease-out infinite;
        }

        .voiceOrb.listening > span:nth-child(3),
        .voiceOrb.speaking > span:nth-child(3) {
          animation: pulseRing 1.8s 0.9s ease-out infinite;
        }

        .voiceOrbCore {
          position: relative;
          z-index: 2;
          display: grid;
          place-items: center;
          width: 76px;
          height: 76px;
          border-radius: 28px;
          background: linear-gradient(145deg, #19191d, #7654d8 70%, #a793ef);
          color: white;
          box-shadow: 0 22px 44px rgba(76, 49, 148, 0.3);
          font-size: 1.65rem;
          font-weight: 900;
          transform: rotate(-4deg);
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .voiceOrb.listening .voiceOrbCore {
          box-shadow: 0 22px 48px rgba(34, 160, 107, 0.28);
          animation: breathe 1.3s ease-in-out infinite;
        }

        .voiceOrb.speaking .voiceOrbCore {
          animation: speakPulse 700ms ease-in-out infinite alternate;
        }

        .voiceCopy {
          max-width: 540px;
        }

        .voiceCopy h2 {
          margin: 0 0 8px;
          font-size: clamp(1.6rem, 4vw, 2.2rem);
        }

        .voiceCopy p {
          margin: 0;
          color: #71717a;
          line-height: 1.55;
        }

        .liveCaptions {
          display: grid;
          gap: 8px;
          width: min(100%, 640px);
          max-height: 190px;
          overflow-y: auto;
          padding: 12px;
          border: 1px solid rgba(24, 24, 27, 0.07);
          border-radius: 20px;
          background: rgba(249, 247, 252, 0.94);
          text-align: left;
          scroll-behavior: smooth;
        }

        .captionLine {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 10px;
          align-items: start;
          padding: 9px 10px;
          border-radius: 14px;
          color: #39363e;
          line-height: 1.45;
        }

        .captionLine.sabi {
          background: rgba(111, 78, 207, 0.08);
        }

        .captionLine.you {
          background: rgba(24, 24, 27, 0.045);
        }

        .captionLine.interim {
          opacity: 0.6;
        }

        .captionLine strong {
          color: #6d4cc7;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .captionLine.you strong {
          color: #6b6870;
        }

        .captionLine span {
          font-size: 0.9rem;
        }

        .voiceActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }

        .listenButton,
        .voiceSendButton,
        .voiceResetButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 46px;
          border-radius: 999px;
          padding: 11px 18px;
          font-weight: 820;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        .listenButton {
          border: 1px solid rgba(24, 24, 27, 0.1);
          background: #18181b;
          color: white;
          box-shadow: 0 12px 28px rgba(24, 24, 27, 0.13);
        }

        .listenButton.stop {
          background: #4c8068;
        }

        .speakingButton {
          background: #6244bb;
          opacity: 0.9;
          cursor: wait;
        }

        .voiceSendButton {
          border: 1px solid rgba(109, 76, 199, 0.16);
          background: #f5f1ff;
          color: #4b338e;
        }

        .voiceResetButton {
          border: 1px solid transparent;
          background: transparent;
          color: #77717f;
        }

        .listenButton:hover:not(:disabled),
        .voiceSendButton:hover:not(:disabled),
        .voiceResetButton:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .micGlyph {
          display: grid;
          place-items: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          color: #d9d2ff;
          font-size: 0.55rem;
          box-shadow: inset 0 0 0 5px currentColor;
        }

        .soundGlyph {
          color: #e6defd;
          font-size: 0.68rem;
          letter-spacing: -0.16em;
        }

        .voicePrivacyNote {
          margin: -2px 0 0;
          color: #96919b;
          font-size: 0.72rem;
          line-height: 1.45;
        }

        .missionLoading {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid rgba(109, 76, 199, 0.12);
          border-radius: 18px;
          background: rgba(247, 243, 255, 0.9);
          animation: slideIn 220ms ease both;
        }

        .missionLoading > div:last-child {
          display: grid;
          gap: 3px;
        }

        .missionLoading strong {
          color: #3f2d78;
          font-size: 0.9rem;
        }

        .missionLoading small {
          color: #81749b;
          font-size: 0.76rem;
        }

        .loadingOrb {
          position: relative;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          background: #6d4cc7;
          box-shadow: 0 8px 20px rgba(109, 76, 199, 0.2);
          animation: breathe 1.2s ease-in-out infinite;
        }

        .loadingOrb span {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: white;
          animation: ping 1.1s ease-in-out infinite;
        }

        .composerError {
          margin: 0;
          padding: 11px 13px;
          border-radius: 14px;
          background: #fff0ed;
          color: #9b3428;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .exampleSection {
          display: grid;
          gap: 9px;
          padding-top: 2px;
        }

        .exampleSection > span {
          color: #8b8790;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .exampleChips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .exampleChips button {
          max-width: 100%;
          border: 1px solid rgba(24, 24, 27, 0.08);
          border-radius: 999px;
          padding: 9px 12px;
          background: rgba(239, 235, 226, 0.75);
          color: #5d5962;
          cursor: pointer;
          font-size: 0.8rem;
          text-align: left;
          transition: background 150ms ease, transform 150ms ease, border-color 150ms ease;
        }

        .exampleChips button:hover {
          border-color: rgba(109, 76, 199, 0.2);
          background: #f5f1ff;
          transform: translateY(-1px);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulseRing {
          0% { transform: scale(0.78); opacity: 0.55; }
          75%, 100% { transform: scale(1.55); opacity: 0; }
        }

        @keyframes breathe {
          0%, 100% { transform: scale(1) rotate(-4deg); }
          50% { transform: scale(1.06) rotate(1deg); }
        }

        @keyframes speakPulse {
          from { transform: scale(0.98) rotate(-4deg); box-shadow: 0 20px 40px rgba(76, 49, 148, 0.22); }
          to { transform: scale(1.08) rotate(1deg); box-shadow: 0 28px 58px rgba(76, 49, 148, 0.36); }
        }

        @keyframes ping {
          0%, 100% { transform: scale(0.7); opacity: 0.55; }
          50% { transform: scale(1); opacity: 1; }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .voiceOrb.listening > span,
          .voiceOrb.speaking > span,
          .voiceOrb.listening .voiceOrbCore,
          .voiceOrb.speaking .voiceOrbCore,
          .loadingOrb,
          .loadingOrb span,
          .miniSpinner,
          .missionLoading {
            animation: none;
          }
        }

        @media (max-width: 640px) {
          .modeSwitch {
            width: 100%;
          }

          .modeSwitch button {
            flex: 1;
            justify-content: center;
          }

          .chatComposer,
          .voiceComposer {
            border-radius: 22px;
          }

          .voiceComposer {
            min-height: 410px;
            padding: 18px 16px 20px;
          }

          .voiceToolbar {
            align-items: flex-start;
          }

          .captionToggle {
            flex: 0 0 auto;
          }

          .composerFooter {
            align-items: flex-end;
          }

          .composerHint {
            max-width: 75%;
          }

          .liveCaptions {
            max-height: 220px;
          }

          .captionLine {
            grid-template-columns: 38px 1fr;
            padding: 8px;
          }

          .voiceActions,
          .listenButton,
          .voiceSendButton,
          .voiceResetButton {
            width: 100%;
          }

          .exampleChips {
            display: grid;
          }

          .exampleChips button {
            width: 100%;
            border-radius: 16px;
          }
        }
      `}</style>
    </div>
  );
}
