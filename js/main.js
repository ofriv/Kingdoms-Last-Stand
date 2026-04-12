import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas      = document.getElementById('game-canvas');
  const introScreen = document.getElementById('intro-screen');
  const diffScreen  = document.getElementById('difficulty-screen');
  const helpScreen  = document.getElementById('help-screen');

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
