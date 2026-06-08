import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

@Injectable({ providedIn: 'root' })
export class VoiceInputService {
  private readonly platformId = inject(PLATFORM_ID);
  private recognition: SpeechRecognitionLike | null = null;
  private finalTranscript = '';

  private readonly transcriptSignal = signal('');
  private readonly isListeningSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly transcript = this.transcriptSignal.asReadonly();
  readonly isListening = this.isListeningSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  isSupported(): boolean {
    return this.getRecognitionConstructor() !== null;
  }

  startListening(): void {
    const Recognition = this.getRecognitionConstructor();
    if (!Recognition) {
      this.errorSignal.set('Voice input is not supported in this browser. Please add items manually.');
      return;
    }

    this.stopListening();
    this.finalTranscript = this.transcriptSignal().trim();
    this.errorSignal.set(null);

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => this.handleResult(event);
    recognition.onerror = (event) => {
      this.errorSignal.set(this.getErrorMessage(event.error));
      this.isListeningSignal.set(false);
    };
    recognition.onend = () => {
      this.isListeningSignal.set(false);
      this.recognition = null;
    };

    try {
      recognition.start();
      this.recognition = recognition;
      this.isListeningSignal.set(true);
    } catch {
      this.errorSignal.set('Could not start voice input. Please try again.');
      this.isListeningSignal.set(false);
    }
  }

  stopListening(): void {
    if (!this.recognition) {
      this.isListeningSignal.set(false);
      return;
    }

    this.recognition.stop();
    this.isListeningSignal.set(false);
  }

  setTranscript(transcript: string): void {
    this.transcriptSignal.set(transcript);
    this.finalTranscript = transcript.trim();
  }

  clear(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
    this.finalTranscript = '';
    this.transcriptSignal.set('');
    this.errorSignal.set(null);
    this.isListeningSignal.set(false);
  }

  private handleResult(event: SpeechRecognitionEventLike): void {
    let interimTranscript = '';

    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results.item(index);
      const transcript = result[0]?.transcript ?? '';

      if (result.isFinal) {
        this.finalTranscript = [this.finalTranscript, transcript].filter(Boolean).join(' ').trim();
      } else {
        interimTranscript += transcript;
      }
    }

    this.transcriptSignal.set(
      [this.finalTranscript, interimTranscript.trim()].filter(Boolean).join(' ').trim()
    );
  }

  private getRecognitionConstructor(): SpeechRecognitionConstructor | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  }

  private getErrorMessage(error: string): string {
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      return 'Microphone access was blocked. Please allow microphone access and try again.';
    }
    if (error === 'no-speech') {
      return 'I could not hear anything. Please try speaking again.';
    }
    return 'Voice input stopped unexpectedly. Please try again.';
  }
}
