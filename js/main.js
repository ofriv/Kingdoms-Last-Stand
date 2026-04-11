import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas      = document.getElementById('game-canvas');
  const introScreen = document.getElementById('intro-screen');
  const helpScreen  = document.getElementById('help-screen');

  document.getElementById('intro-help-btn').addEventListener('click', () => {
    introScreen.style.display = 'none';
    helpScreen.style.display  = 'flex';
  });

  document.getElementById('help-back-btn').addEventListener('click', () => {
    helpScreen.style.display  = 'none';
    introScreen.style.display = 'flex';
  });

  document.getElementById('intro-start-btn').addEventListener('click', () => {
    introScreen.style.display = 'none';
    const game = new Game(canvas);
    game.start();
  });
});
