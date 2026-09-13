/**
 * Snake Arena — game engine.
 *
 * Pure game-state logic: grid, snakes, food, movement, collisions, and
 * end-of-game results. No DOM/canvas/API code lives here — see app.js
 * for rendering and wiring to the services layer.
 *
 * Rules implemented (see product-spec.md):
 *  - Fixed 20x20 grid, constant speed, no wraparound.
 *  - A snake dies on wall, self, or (multi mode) the other snake's body.
 *  - Multi mode: if exactly one snake dies, it disappears immediately and
 *    the other keeps playing solo until it also dies, at which point the
 *    solo survivor is declared the winner.
 *  - Multi mode: if both snakes die on the same tick (including a
 *    head-on collision), the match ends immediately in a draw.
 */

(function (global) {
  'use strict';

  const GRID_SIZE = 20;
  const TICK_MS = 120;

  const DIRS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  class SnakeGame {
    /**
     * @param {'single'|'multi'} mode
     * @param {string[]} playerNames - 1 name for 'single', 2 for 'multi'
     */
    constructor(mode, playerNames) {
      this.mode = mode;
      this.gridSize = GRID_SIZE;
      this.status = 'playing'; // 'playing' | 'paused' | 'over'
      this.result = null;
      this.snakes = this.initSnakes(mode, playerNames);
      this.food = this.spawnFood();
    }

    initSnakes(mode, names) {
      if (mode === 'single') {
        return [this.makeSnake(1, names[0], { x: 10, y: 10 }, DIRS.RIGHT)];
      }
      return [
        this.makeSnake(1, names[0], { x: 5, y: 10 }, DIRS.RIGHT),
        this.makeSnake(2, names[1], { x: 14, y: 10 }, DIRS.LEFT),
      ];
    }

    makeSnake(id, name, head, dir) {
      const body = [
        head,
        { x: head.x - dir.x, y: head.y - dir.y },
        { x: head.x - dir.x * 2, y: head.y - dir.y * 2 },
      ];
      return {
        id,
        name,
        body,
        direction: dir,
        queuedDirection: dir,
        alive: true,
        diedAtLength: null,
      };
    }

    /** Queue a direction change for a snake; ignored if it reverses the snake into itself. */
    setDirection(snakeId, dir) {
      const snake = this.snakes.find((s) => s.id === snakeId && s.alive);
      if (!snake) return;
      if (isOpposite(dir, snake.direction)) return;
      snake.queuedDirection = dir;
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
    }

    spawnFood() {
      const occupied = new Set();
      this.snakes.forEach((s) => {
        if (s.alive) s.body.forEach((seg) => occupied.add(seg.x + ',' + seg.y));
      });
      let pos;
      do {
        pos = {
          x: Math.floor(Math.random() * this.gridSize),
          y: Math.floor(Math.random() * this.gridSize),
        };
      } while (occupied.has(pos.x + ',' + pos.y));
      return pos;
    }

    /** Advance the game by one step. No-op unless status is 'playing'. */
    tick() {
      if (this.status !== 'playing') return;

      const aliveBefore = this.snakes.filter((s) => s.alive);
      aliveBefore.forEach((s) => {
        s.direction = s.queuedDirection;
      });

      const newHeads = new Map();
      aliveBefore.forEach((s) => {
        newHeads.set(s.id, { x: s.body[0].x + s.direction.x, y: s.body[0].y + s.direction.y });
      });

      const willGrow = new Map();
      aliveBefore.forEach((s) => {
        const h = newHeads.get(s.id);
        willGrow.set(s.id, sameCell(h, this.food));
      });

      const dies = new Map();
      aliveBefore.forEach((s) => dies.set(s.id, false));

      // Wall + self collisions.
      aliveBefore.forEach((s) => {
        const h = newHeads.get(s.id);
        const outOfBounds = h.x < 0 || h.x >= this.gridSize || h.y < 0 || h.y >= this.gridSize;
        let selfHit = false;
        if (!outOfBounds) {
          // The tail cell vacates as the snake moves, unless the snake is
          // growing this tick (then the tail stays put).
          const bodyToCheck = willGrow.get(s.id) ? s.body : s.body.slice(0, -1);
          selfHit = bodyToCheck.some((seg) => sameCell(seg, h));
        }
        if (outOfBounds || selfHit) dies.set(s.id, true);
      });

      // Other-snake collisions (multi mode, only while both are alive).
      if (aliveBefore.length === 2) {
        const [a, b] = aliveBefore;
        const ha = newHeads.get(a.id);
        const hb = newHeads.get(b.id);

        // Head-on: both snakes move into the same cell.
        if (sameCell(ha, hb)) {
          dies.set(a.id, true);
          dies.set(b.id, true);
        }
        // Running into the other snake's body. Simplification: checked
        // against the other snake's pre-move body (including its tail
        // cell), rather than resolving both moves simultaneously.
        if (b.body.some((seg) => sameCell(seg, ha))) dies.set(a.id, true);
        if (a.body.some((seg) => sameCell(seg, hb))) dies.set(b.id, true);
      }

      const diedThisTick = aliveBefore.filter((s) => dies.get(s.id));
      const survivedThisTick = aliveBefore.filter((s) => !dies.get(s.id));

      survivedThisTick.forEach((s) => {
        const h = newHeads.get(s.id);
        s.body.unshift(h);
        if (willGrow.get(s.id)) {
          this.food = this.spawnFood();
        } else {
          s.body.pop();
        }
      });

      diedThisTick.forEach((s) => {
        s.alive = false;
        s.diedAtLength = s.body.length;
      });

      this.evaluateEndConditions(diedThisTick, aliveBefore.length);
    }

    evaluateEndConditions(diedThisTick, aliveCountBeforeTick) {
      if (this.mode === 'single') {
        const solo = this.snakes[0];
        if (!solo.alive) {
          this.status = 'over';
          this.result = { type: 'single', profileName: solo.name, length: solo.diedAtLength };
        }
        return;
      }

      // Multi mode.
      if (aliveCountBeforeTick === 2 && diedThisTick.length === 2) {
        this.status = 'over';
        this.result = {
          type: 'match',
          outcome: 'draw',
          winnerName: null,
          players: this.snakes.map((s) => ({ name: s.name, length: s.diedAtLength })),
        };
        return;
      }

      if (aliveCountBeforeTick === 2 && diedThisTick.length === 1) {
        // Exactly one died: it disappears, the other keeps playing solo.
        // Not over yet.
        return;
      }

      if (aliveCountBeforeTick === 1 && diedThisTick.length === 1) {
        // The solo survivor has now also died -> they win for having
        // outlasted the other player.
        const winner = diedThisTick[0];
        this.status = 'over';
        this.result = {
          type: 'match',
          outcome: 'win',
          winnerName: winner.name,
          players: this.snakes.map((s) => ({ name: s.name, length: s.diedAtLength })),
        };
      }
    }
  }

  global.SnakeGameEngine = { SnakeGame, DIRS, GRID_SIZE, TICK_MS };
})(window);
