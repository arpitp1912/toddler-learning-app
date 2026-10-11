// Runtime feature detection (SPEC section 4). Anything missing is skipped, never fatal.
type AudioCtor = typeof AudioContext;

export const AudioContextCtor: AudioCtor | undefined =
  typeof window !== 'undefined'
    ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
    : undefined;

export const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
export const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
