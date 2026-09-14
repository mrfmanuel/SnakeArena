/**
 * Snake Arena — app / UI wiring.
 *
 * Owns screen navigation, canvas rendering, keyboard input, and the game
 * loop. All persistence goes through window.SnakeArenaAPI (src/services/api.js);
 * this file never touches storage directly.
 */

(function () {
  'use strict';

  const { SnakeGame, DIRS, GRID_SIZE, TICK_MS } = window.SnakeGameEngine;
  const API = window.SnakeArenaAPI;

  const CELL_SIZE = 20;
  const COLORS = {
    background: '#0f1720',
    gridLine: '#1c2733',
    food: '#e5533d',
    p1: '#3ddc84',
    p1Head: '#a4f5c9',
    p2: '#4da3ff',
    p2Head: '#bfe0ff',
  };

  // ---- DOM references -----------------------------------------------

  const screens = {
    start: document.getElementById('screen-start'),
    game: document.getElementById('screen-game'),
    gameover: document.getElementById('screen-gameover'),
    leaderboard: document.getElementById('screen-leaderboard'),
    profile: document.getElementById('screen-profile'),
  };

  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const player2Field = document.getElementById('player2-field');
  const p1NameInput = document.getElementById('p1-name');
  const p2NameInput = document.getElementById('p2-name');
  const startForm = document.getElementById('start-form');
  const startError = document.getElementById('start-error');

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const pauseOverlay = document.getElementById('pause-overlay');
  const countdownOverlay = document.getElementById('countdown-overlay');

  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverDetail = document.getElementById('gameover-detail');
  const gameoverWarning = document.getElementById('gameover-warning');
  const playAgainBtn = document.getElementById('play-again-btn');
  const changePlayersBtn = document.getElementById('change-players-btn');
  const gameoverLeaderboardBtn = document.getElementById('gameover-leaderboard-btn');

  const leaderboardBody = document.getElementById('leaderboard-body');
  const leaderboardBackBtn = document.getElementById('leaderboard-back-btn');
  const openLeaderboardBtn = document.getElementById('open-leaderboard-btn');

  const profileNameInput = document.getElementById('profile-name');
  const viewProfileBtn = document.getElementById('view-profile-btn');
  const profileBody = document.getElementById('profile-body');
  const profileBackBtn = document.getElementById('profile-back-btn');

  // ---- Screen navigation ----------------------------------------------

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
  }

  // ---- Game state -------------------------------------------------------

  let game = null;
  let loopHandle = null;
  let lastGameConfig = null; // { mode, names } — set on launch, reused by "Play Again"

  const COUNTDOWN_START = 3;
  const COUNTDOWN_STEP_MS = 800;

  /**
   * Shows the 3-2-1 overlay, then calls `onComplete`. The engine already
   * ignores ticks and direction input while game.status is 'countdown'
   * (see engine.js), so this only needs to own the overlay/timer and
   * flip the status back once it's done.
   */
  function runCountdown(onComplete) {
    let count = COUNTDOWN_START;
    countdownOverlay.textContent = String(count);
    countdownOverlay.hidden = false;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        countdownOverlay.textContent = String(count);
      } else {
        clearInterval(timer);
        countdownOverlay.hidden = true;
        onComplete();
      }
    }, COUNTDOWN_STEP_MS);
  }

  /** Creates a game for (mode, names), shows the game screen, and runs the countdown before play begins. */
  function launchGame(mode, names) {
    lastGameConfig = { mode, names };
    game = new SnakeGame(mode, names);
    game.status = 'countdown';
    render();
    pauseOverlay.hidden = true;
    showScreen('game');
    startLoop();
    runCountdown(() => {
      game.status = 'playing';
    });
  }

  const KEY_MAP = {
    // Player 1: WASD. Also usable in single-player.
    KeyW: { snake: 1, dir: DIRS.UP },
    KeyS: { snake: 1, dir: DIRS.DOWN },
    KeyA: { snake: 1, dir: DIRS.LEFT },
    KeyD: { snake: 1, dir: DIRS.RIGHT },
    // Player 2: Arrow keys. In single-player these also drive snake 1,
    // for convenience, since there's no P2 to conflict with.
    ArrowUp: { snake: 2, dir: DIRS.UP },
    ArrowDown: { snake: 2, dir: DIRS.DOWN },
    ArrowLeft: { snake: 2, dir: DIRS.LEFT },
    ArrowRight: { snake: 2, dir: DIRS.RIGHT },
  };

  function handleKeydown(e) {
    if (!game || game.status === 'over') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (game.status === 'playing') {
        game.togglePause();
        pauseOverlay.hidden = false;
      } else if (game.status === 'paused') {
        // Resuming goes through the same countdown as a fresh start,
        // rather than dropping straight back into 'playing'.
        pauseOverlay.hidden = true;
        game.status = 'countdown';
        runCountdown(() => {
          game.status = 'playing';
        });
      }
      // 'countdown' (already running) and 'over' ignore Space.
      return;
    }

    const mapped = KEY_MAP[e.code];
    if (!mapped) return;
    e.preventDefault();

    if (game.mode === 'single') {
      game.setDirection(1, mapped.dir);
    } else {
      game.setDirection(mapped.snake, mapped.dir);
    }
  }

  // ---- Rendering ----------------------------------------------------

  function drawGrid() {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE + 0.5, 0);
      ctx.lineTo(i * CELL_SIZE + 0.5, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE + 0.5);
      ctx.lineTo(canvas.width, i * CELL_SIZE + 0.5);
      ctx.stroke();
    }
  }

  function drawCell(pos, color) {
    ctx.fillStyle = color;
    ctx.fillRect(pos.x * CELL_SIZE + 1, pos.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }

  function drawSnake(snake, bodyColor, headColor) {
    if (!snake.alive) return;
    snake.body.forEach((seg, i) => drawCell(seg, i === 0 ? headColor : bodyColor));
  }

  function render() {
    drawGrid();
    drawCell(game.food, COLORS.food);
    const [s1, s2] = game.snakes;
    drawSnake(s1, COLORS.p1, COLORS.p1Head);
    if (s2) drawSnake(s2, COLORS.p2, COLORS.p2Head);
    renderHud();
  }

  function renderHud() {
    const parts = game.snakes.map((s) => {
      const label = game.mode === 'multi' ? (s.id === 1 ? 'P1' : 'P2') : 'Score';
      const status = s.alive ? '' : ' (out)';
      return `<span class="hud-${s.id === 1 ? 'p1' : 'p2'}">${label} ${escapeHtml(s.name)}: ${s.body.length}${status}</span>`;
    });
    hud.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Turn a services-layer rejection into text worth showing a player. */
  function describeError(err, fallback) {
    if (err && typeof err.message === 'string' && err.message) return err.message;
    return fallback;
  }

  // ---- Game loop ------------------------------------------------------

  function startLoop() {
    stopLoop();
    loopHandle = setInterval(() => {
      game.tick();
      render();
      if (game.status === 'over') {
        stopLoop();
        handleGameOver();
      }
    }, TICK_MS);
  }

  function stopLoop() {
    if (loopHandle) {
      clearInterval(loopHandle);
      loopHandle = null;
    }
  }

  async function handleGameOver() {
    const result = game.result;

    // Fill in the result text first, unconditionally — a save failure
    // shouldn't hide the result the players just watched happen.
    if (result.type === 'single') {
      gameoverTitle.textContent = 'Game Over';
      gameoverDetail.textContent = `${result.profileName} reached a length of ${result.length}.`;
    } else {
      const lengthsText = result.players.map((p) => `${p.name}: ${p.length}`).join(' · ');
      gameoverTitle.textContent = result.outcome === 'draw' ? "It's a draw!" : `${result.winnerName} wins!`;
      gameoverDetail.textContent = lengthsText;
    }

    try {
      if (result.type === 'single') {
        await API.submitSinglePlayerScore({ profileName: result.profileName, length: result.length });
      } else {
        await API.submitMatchResult({
          players: result.players,
          outcome: result.outcome,
          winnerName: result.winnerName,
        });
      }
      gameoverWarning.hidden = true;
    } catch (err) {
      gameoverWarning.textContent = describeError(err, "Couldn't save this result to the server.");
      gameoverWarning.hidden = false;
    }

    showScreen('gameover');
  }

  // ---- Start screen ---------------------------------------------------

  function currentMode() {
    return document.querySelector('input[name="mode"]:checked').value;
  }

  function updateModeUI() {
    player2Field.hidden = currentMode() !== 'multi';
  }

  modeRadios.forEach((r) => r.addEventListener('change', updateModeUI));
  updateModeUI();

  startForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    startError.textContent = '';

    const mode = currentMode();
    const p1Name = p1NameInput.value.trim();
    const p2Name = p2NameInput.value.trim();

    if (!p1Name) {
      startError.textContent = mode === 'multi' ? 'Enter a name for Player 1.' : 'Enter your name.';
      return;
    }
    if (mode === 'multi') {
      if (!p2Name) {
        startError.textContent = 'Enter a name for Player 2.';
        return;
      }
      if (p1Name === p2Name) {
        startError.textContent = 'Player 1 and Player 2 need different names.';
        return;
      }
    }

    const names = mode === 'single' ? [p1Name] : [p1Name, p2Name];
    const submitBtn = startForm.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      await Promise.all(names.map((n) => API.getOrCreateProfile(n)));
    } catch (err) {
      startError.textContent = describeError(err, 'Could not start the game.');
      return;
    } finally {
      submitBtn.disabled = false;
    }

    launchGame(mode, names);
  });

  // ---- Game-over screen -------------------------------------------------

  playAgainBtn.addEventListener('click', () => {
    // Reuses the same player name(s)/mode and goes straight back into a
    // new match (through the countdown) — no need to re-type names.
    launchGame(lastGameConfig.mode, lastGameConfig.names);
  });

  changePlayersBtn.addEventListener('click', () => showScreen('start'));

  gameoverLeaderboardBtn.addEventListener('click', openLeaderboard);

  // ---- Leaderboard screen -----------------------------------------------

  async function openLeaderboard() {
    leaderboardBody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    showScreen('leaderboard');

    let entries;
    try {
      entries = await API.getLeaderboard();
    } catch (err) {
      leaderboardBody.innerHTML = `<tr><td colspan="4">${escapeHtml(describeError(err, 'Could not load the leaderboard.'))}</td></tr>`;
      return;
    }

    if (entries.length === 0) {
      leaderboardBody.innerHTML = '<tr><td colspan="4">No results yet — play a round!</td></tr>';
      return;
    }
    leaderboardBody.innerHTML = entries
      .map(
        (e, i) => `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(e.profileName)}</td>
          <td>${e.length}</td>
          <td>${escapeHtml(e.detail)}</td>
        </tr>`
      )
      .join('');
  }

  openLeaderboardBtn.addEventListener('click', openLeaderboard);
  leaderboardBackBtn.addEventListener('click', () => showScreen('start'));

  // ---- Profile screen -----------------------------------------------

  async function openProfile() {
    const name = profileNameInput.value.trim();
    if (!name) return;
    profileBody.innerHTML = '<p>Loading…</p>';
    showScreen('profile');

    let stats;
    let history;
    try {
      [stats, history] = await Promise.all([API.getProfileStats(name), API.getProfileHistory(name)]);
    } catch (err) {
      profileBody.innerHTML = `<p>${escapeHtml(describeError(err, 'Could not load this profile.'))}</p>`;
      return;
    }

    if (!stats) {
      profileBody.innerHTML = `<p>No profile named "${escapeHtml(name)}" yet — play a round to create one.</p>`;
      return;
    }

    const statsHtml = `
      <h3>${escapeHtml(stats.name)}</h3>
      <ul class="stats-list">
        <li>Best length: <strong>${stats.stats.bestLength}</strong></li>
        <li>Wins: <strong>${stats.stats.wins}</strong></li>
        <li>Draws: <strong>${stats.stats.draws}</strong></li>
        <li>Losses: <strong>${stats.stats.losses}</strong></li>
      </ul>`;

    const historyHtml =
      history.length === 0
        ? '<p>No match history yet.</p>'
        : `<table class="data-table">
            <thead><tr><th>Opponent</th><th>Result</th><th>Length</th><th>Date</th></tr></thead>
            <tbody>
              ${history
                .map(
                  (h) => `<tr>
                    <td>${h.opponent ? escapeHtml(h.opponent) : '—'}</td>
                    <td>${h.result}</td>
                    <td>${h.length}</td>
                    <td>${new Date(h.date).toLocaleString()}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`;

    profileBody.innerHTML = statsHtml + historyHtml;
  }

  viewProfileBtn.addEventListener('click', openProfile);
  profileBackBtn.addEventListener('click', () => showScreen('start'));

  // ---- Global input ---------------------------------------------------

  document.addEventListener('keydown', handleKeydown);

  // ---- Init ------------------------------------------------------------

  showScreen('start');
})();
