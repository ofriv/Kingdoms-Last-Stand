import { Game }         from './game.js';
import { AudioManager } from './audio.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas      = document.getElementById('game-canvas');
  const introScreen = document.getElementById('intro-screen');
  const diffScreen  = document.getElementById('difficulty-screen');
  const helpScreen  = document.getElementById('help-screen');

  // ── Audio setup ────────────────────────────────────────────────────────────
  const audio  = new AudioManager();
  const muteBtn  = document.getElementById('mute-btn');
  const volSlider = document.getElementById('volume-slider');

  // Restore saved volume
  volSlider.value = Math.round(audio.volume * 100);
  _updateSliderFill(volSlider);
  if (audio.muted) muteBtn.classList.add('muted');
  muteBtn.textContent = audio.muted ? '♪̶' : '♪';

  muteBtn.addEventListener('click', () => {
    const nowMuted = audio.toggleMute();
    muteBtn.classList.toggle('muted', nowMuted);
    muteBtn.textContent = nowMuted ? '🔇' : '♪';
  });

  volSlider.addEventListener('input', () => {
    audio.setVolume(volSlider.value / 100);
    _updateSliderFill(volSlider);
    // Un-mute automatically when user moves the slider
    if (audio.muted && volSlider.value > 0) {
      audio.toggleMute();
      muteBtn.classList.remove('muted');
      muteBtn.textContent = '♪';
    }
  });

  function _updateSliderFill(slider) {
    const pct = slider.value + '%';
    slider.style.setProperty('--fill', pct);
  }

  // Try to start music immediately (works if browser allows autoplay).
  // The AudioContext will resume on the first user interaction if blocked.
  audio.play();

  // Belt-and-suspenders: ensure music starts on the very first click/keypress
  // in case the browser blocked autoplay above.
  const ensureMusic = () => {
    audio.play();
    document.removeEventListener('pointerdown', ensureMusic);
    document.removeEventListener('keydown',     ensureMusic);
  };
  document.addEventListener('pointerdown', ensureMusic);
  document.addEventListener('keydown',     ensureMusic);

  // ── Screen navigation ──────────────────────────────────────────────────────

  // Intro → Difficulty
  document.getElementById('intro-start-btn').addEventListener('click', () => {
    introScreen.style.display = 'none';
    diffScreen.style.display  = 'flex';
  });

  // Difficulty → Intro (back)
  document.getElementById('diff-back-btn').addEventListener('click', () => {
    diffScreen.style.display  = 'none';
    introScreen.style.display = 'flex';
  });

  // Intro → Help
  document.getElementById('intro-help-btn').addEventListener('click', () => {
    introScreen.style.display = 'none';
    helpScreen.style.display  = 'flex';
  });

  // Help → Intro
  document.getElementById('help-back-btn').addEventListener('click', () => {
    helpScreen.style.display  = 'none';
    introScreen.style.display = 'flex';
  });

  // Difficulty → Game
  function startGame(difficulty) {
    diffScreen.style.display = 'none';
    const game = new Game(canvas, difficulty);
    game.start();
  }

  document.getElementById('diff-easy').addEventListener('click',   () => startGame('easy'));
  document.getElementById('diff-normal').addEventListener('click', () => startGame('normal'));
  document.getElementById('diff-hard').addEventListener('click',   () => startGame('hard'));
});
