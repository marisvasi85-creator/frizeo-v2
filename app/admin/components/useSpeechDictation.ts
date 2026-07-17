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

type UseSpeechDictationOptions = {
  lang?: string;
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
};

export function useSpeechDictation({
  lang = "ro-RO",
  onFinalTranscript,
  onInterimTranscript,
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
  const onFinalRef = useRef(onFinalTranscript);
  const onInterimRef = useRef(onInterimTranscript);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
    onInterimRef.current = onInterimTranscript;
  }, [onFinalTranscript, onInterimTranscript]);

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

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }

      if (interimChunk) {
        onInterimRef.current?.(interimChunk.trim());
      }

      if (finalChunk.trim()) {
        onFinalRef.current(finalChunk.trim());
      }
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
      if (shouldListenRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          shouldListenRef.current = false;
        }
      }
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
