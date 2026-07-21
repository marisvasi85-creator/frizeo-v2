"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechDictationSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

function subscribeSpeechSupport() {
  return () => {};
}

export type DictationTranscriptUpdate = {
  /** Full final text for the current recognition session (not a delta). */
  committed: string;
  /** Live partial text still being recognized. */
  interim: string;
};

type UseSpeechDictationOptions = {
  lang?: string;
  onTranscript: (update: DictationTranscriptUpdate) => void;
};

export function useSpeechDictation({
  lang = "ro-RO",
  onTranscript,
}: UseSpeechDictationOptions) {
  const supported = useSyncExternalStore(
    subscribeSpeechSupport,
    isSpeechDictationSupported,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const sessionCommittedRef = useRef("");

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      setError("Dictarea nu e disponibilă pe acest browser.");
      return;
    }

    stop();
    setError(null);
    shouldListenRef.current = true;
    sessionCommittedRef.current = "";

    const recognition = new Ctor();
    recognition.lang = lang;
    // One utterance at a time is more stable on mobile Chrome and avoids
    // duplicated growing finals from continuous restarts.
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let committed = "";
      let interim = "";

      // Rebuild from the full results list — never append deltas.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          committed += transcript;
        } else {
          interim += transcript;
        }
      }

      committed = committed.replace(/\s+/g, " ").trim();
      interim = interim.replace(/\s+/g, " ").trim();
      sessionCommittedRef.current = committed;

      onTranscriptRef.current({ committed, interim });
    };

    recognition.onerror = (event) => {
      const code = event.error || "unknown";
      if (code === "aborted" || code === "no-speech") {
        return;
      }
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Permite accesul la microfon pentru dictare.");
      } else if (code === "audio-capture") {
        setError("Nu am găsit un microfon.");
      } else {
        setError("Dictarea s-a oprit. Încearcă din nou.");
      }
      shouldListenRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      // Flush any remaining interim as committed when recognition ends.
      if (sessionCommittedRef.current) {
        onTranscriptRef.current({
          committed: sessionCommittedRef.current,
          interim: "",
        });
      }
      shouldListenRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Nu am putut porni dictarea.");
      shouldListenRef.current = false;
      setListening(false);
    }
  }, [lang, stop]);

  const toggle = useCallback(() => {
    if (listening || shouldListenRef.current) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    supported,
    listening,
    error,
    start,
    stop,
    toggle,
    clearError: () => setError(null),
  };
}
