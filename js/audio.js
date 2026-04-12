/**
 * AudioManager – background music via Web Audio API.
 *
 * Priority:
 *   1. Tries to load  assets/audio/bgm.mp3  and loop it.
 *   2. Falls back to procedurally generated ambient music if the file
 *      is missing or cannot be decoded.
 *
 * Volume and mute state are persisted in localStorage.
 */
export class AudioManager {
  constructor() {
    this._ctx        = null;
    this._masterGain = null;
    this._reverb     = null;
    this._reverbGain = null;

    // File-based playback
    this._fileAudio  = null;   // HTMLAudioElement
    this._fileSource = null;   // MediaElementAudioSourceNode

    // Procedural fallback
    this._drones     = [];
    this._chordTimer = null;
    this._chordIdx   = 0;

    this._playing    = false;
    this._volume     = parseFloat(localStorage.getItem('bgmVolume') ?? '0.3');
    this._muted      = localStorage.getItem('bgmMuted') === 'true';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Try to start music. Safe to call multiple times and before any user gesture —
   * the AudioContext will resume as soon as the browser allows it.
   */
  play() {
    this._ensureContext();
    if (this._playing) return;
    // resume() resolves immediately if context is already running,
    // or waits for a user gesture if it is suspended.
    this._ctx.resume().then(() => {
      if (this._playing) return;
      this._playing = true;
      this._loadFileOrFallback();
    }).catch(() => {});
  }

  stop() {
    if (!this._playing) return;
    this._playing = false;

    // Stop file audio
    if (this._fileAudio) {
      this._fileAudio.pause();
      this._fileAudio.currentTime = 0;
    }

    // Stop procedural audio
    if (this._chordTimer) { clearTimeout(this._chordTimer); this._chordTimer = null; }
    const now = this._ctx?.currentTime ?? 0;
    this._drones.forEach(({ osc, gain }) => {
      gain.gain.setTargetAtTime(0, now, 0.5);
      osc.stop(now + 2);
    });
    this._drones = [];
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('bgmVolume', String(this._volume));
    this._applyGain();
  }

  toggleMute() {
    this._muted = !this._muted;
    localStorage.setItem('bgmMuted', String(this._muted));
    this._applyGain();
    return this._muted;
  }

  get volume() { return this._volume; }
  get muted()  { return this._muted; }

  // ── Internal ───────────────────────────────────────────────────────────────

  _ensureContext() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._muted ? 0 : this._volume;
    this._masterGain.connect(this._ctx.destination);

    this._buildReverb();
  }

  _applyGain() {
    if (!this._masterGain) return;
    const target = this._muted ? 0 : this._volume;
    this._masterGain.gain.setTargetAtTime(target, this._ctx.currentTime, 0.08);
  }

  // ── File loading ───────────────────────────────────────────────────────────

  _loadFileOrFallback() {
    const audio = new Audio();
    audio.loop    = true;
    audio.preload = 'auto';
    audio.src     = 'assets/audio/bgm.mpeg';

    // Success – wire into Web Audio graph for volume control
    audio.addEventListener('canplaythrough', () => {
      if (!this._playing) return; // stopped before file loaded
      try {
        this._fileSource = this._ctx.createMediaElementSource(audio);
        this._fileSource.connect(this._masterGain);
        this._fileAudio  = audio;
        audio.play().catch(() => this._startProcedural());
      } catch (err) {
        // createMediaElementSource can only be called once; if something went
        // wrong just fall back to procedural
        this._startProcedural();
      }
    }, { once: true });

    // File missing or undecodable – use procedural music
    audio.addEventListener('error', () => {
      if (this._playing) this._startProcedural();
    }, { once: true });
  }

  // ── Procedural fallback ────────────────────────────────────────────────────

  _buildReverb() {
    const sr  = this._ctx.sampleRate;
    const len = sr * 2.5;
    const buf = this._ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
      }
    }
    this._reverb            = this._ctx.createConvolver();
    this._reverb.buffer     = buf;
    this._reverbGain        = this._ctx.createGain();
    this._reverbGain.gain.value = 0.28;
    this._reverb.connect(this._reverbGain);
    this._reverbGain.connect(this._masterGain);
  }

  _startProcedural() {
    // Low pedal tones – D2, A2 (perfect fifth drone)
    [36.71, 55.00].forEach((freq, i) => {
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      const filt = this._ctx.createBiquadFilter();
      osc.type             = 'sawtooth';
      osc.frequency.value  = freq;
      filt.type            = 'lowpass';
      filt.frequency.value = 400;
      filt.Q.value         = 0.7;
      gain.gain.value      = i === 0 ? 0.12 : 0.07;
      osc.connect(filt); filt.connect(gain);
      gain.connect(this._masterGain);
      gain.connect(this._reverb);
      osc.start();
      this._drones.push({ osc, gain });
    });

    // High shimmer
    const shimmer  = this._ctx.createOscillator();
    const shimGain = this._ctx.createGain();
    shimmer.type            = 'sine';
    shimmer.frequency.value = 880;
    shimGain.gain.value     = 0.018;
    shimmer.connect(shimGain);
    shimGain.connect(this._reverb);
    shimmer.start();
    this._drones.push({ osc: shimmer, gain: shimGain });

    this._scheduleNextChord();
  }

  _scheduleNextChord() {
    if (!this._playing) return;
    const chords = [
      [73.42, 110.00, 146.83, 220.00], // Dm
      [87.31, 130.81, 174.61, 261.63], // Fm
      [98.00, 146.83, 195.99, 293.66], // Gm
      [65.41,  98.00, 130.81, 196.00], // Cm
    ];
    const DURATION = 9;
    this._playChordVoicing(chords[this._chordIdx], DURATION);
    this._chordIdx  = (this._chordIdx + 1) % chords.length;
    this._chordTimer = setTimeout(() => this._scheduleNextChord(), DURATION * 1000);
  }

  _playChordVoicing(freqs, duration) {
    const now = this._ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.type            = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 1.2);
      gain.gain.linearRampToValueAtTime(0.04,  now + duration * 0.6);
      gain.gain.linearRampToValueAtTime(0,     now + duration);
      osc.connect(gain);
      gain.connect(this._reverb);
      gain.connect(this._masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }
}
