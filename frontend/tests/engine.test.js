/**
 * Tests for src/game/engine.js — the pure game-rule logic (grid,
 * movement, collisions, win/draw rules) from product-spec.md.
 *
 * engine.js is a plain browser script (no module.exports; it attaches
 * `window.SnakeGameEngine`), so it's loaded here the same way index.html
 * loads it: `global.window = global` makes the top-level `(function
 * (global) { ... })(window)` in engine.js resolve `window` to Node's
 * global object, so its side effect (setting SnakeGameEngine) lands on
 * `global` too — no changes to engine.js needed, and no bundler/build
 * step or extra dependency, just Node's built-in test runner.
 *
 * Several tests below set up a snake's `body`/`direction` directly
 * before calling `tick()`, rather than only driving it through many
 * ticks from its default start position — this makes collision
 * scenarios (self-hit, head-on, near-wall) deterministic and fast
 * instead of relying on emergent multi-tick sequences.
 *
 * Run with:  node --test tests/   (from frontend/, Node 18+)
 */

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

global.window = global;
require('../src/game/engine.js');
const { SnakeGame, DIRS } = global.SnakeGameEngine;

test('single-player: moves in the current direction each tick', () => {
  const game = new SnakeGame('single', ['Solo']);
  game.food = { x: 0, y: 0 }; // out of the way
  game.tick();
  assert.deepEqual(game.snakes[0].body[0], { x: 11, y: 10 });
});

test('single-player: eating food grows the snake and respawns food', () => {
  const game = new SnakeGame('single', ['Solo']);
  game.food = { x: 11, y: 10 }; // directly in front of the head
  game.tick();
  assert.equal(game.snakes[0].body.length, 4);
  assert.equal(game.status, 'playing');
  assert.notDeepEqual(game.food, { x: 11, y: 10 });
});

test('single-player: hitting a wall ends the game with the final length', () => {
  const game = new SnakeGame('single', ['Solo']);
  game.snakes[0].body = [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }];
  game.snakes[0].direction = DIRS.RIGHT;
  game.snakes[0].queuedDirection = DIRS.RIGHT;
  game.food = { x: 0, y: 0 };

  game.tick();

  assert.equal(game.status, 'over');
  assert.deepEqual(game.result, { type: 'single', profileName: 'Solo', length: 3 });
});

test('single-player: hitting its own body ends the game', () => {
  const game = new SnakeGame('single', ['Solo']);
  // A body shaped so moving RIGHT from (5,5) hits (6,5) — which must be
  // a *middle* segment, not the tail: the tail cell itself is safe to
  // move into (it vacates that same tick), so (6,5) here is followed by
  // one more segment (7,5) acting as the tail.
  game.snakes[0].body = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 5 },
    { x: 7, y: 5 },
  ];
  game.snakes[0].direction = DIRS.RIGHT;
  game.snakes[0].queuedDirection = DIRS.RIGHT;
  game.food = { x: 0, y: 0 };

  game.tick();

  assert.equal(game.status, 'over');
  assert.equal(game.result.type, 'single');
  assert.equal(game.result.length, 5);
});

test('moving into the current tail cell is safe (the tail vacates that tick)', () => {
  const game = new SnakeGame('single', ['Solo']);
  // Moving RIGHT from (5,5): the target cell (6,5) is the tail here, so
  // this must NOT be flagged as a self-collision.
  game.snakes[0].body = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }];
  game.snakes[0].direction = DIRS.RIGHT;
  game.snakes[0].queuedDirection = DIRS.RIGHT;
  game.food = { x: 0, y: 0 };

  game.tick();

  assert.equal(game.status, 'playing');
  assert.deepEqual(game.snakes[0].body[0], { x: 6, y: 5 });
});

test('a direction reversing straight into the snake is ignored', () => {
  const game = new SnakeGame('single', ['Solo']);
  game.setDirection(1, DIRS.LEFT); // opposite of the initial RIGHT
  game.food = { x: 0, y: 0 };
  game.tick();
  assert.deepEqual(game.snakes[0].body[0], { x: 11, y: 10 }); // still moved right
});

test('direction input is ignored while status is "countdown"', () => {
  const game = new SnakeGame('single', ['Solo']);
  game.status = 'countdown';
  game.setDirection(1, DIRS.DOWN);
  game.status = 'playing';
  game.food = { x: 0, y: 0 };

  game.tick();

  assert.deepEqual(game.snakes[0].body[0], { x: 11, y: 10 }); // right, not down
});

test('tick() does not move anything while paused', () => {
  const game = new SnakeGame('single', ['Solo']);
  game.status = 'paused';
  const before = JSON.stringify(game.snakes[0].body);
  game.tick();
  assert.equal(JSON.stringify(game.snakes[0].body), before);
});

test('spawnFood never lands on an occupied cell', () => {
  const game = new SnakeGame('single', ['Solo']);
  game.snakes[0].body = Array.from({ length: 50 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20) }));
  for (let i = 0; i < 200; i++) {
    const food = game.spawnFood();
    const onSnake = game.snakes[0].body.some((seg) => seg.x === food.x && seg.y === food.y);
    assert.equal(onSnake, false);
  }
});

test('2-player: one snake dying does not end the match — the other keeps playing', () => {
  const game = new SnakeGame('multi', ['P1', 'P2']);
  game.snakes[1].body = [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }];
  game.snakes[1].direction = DIRS.RIGHT;
  game.snakes[1].queuedDirection = DIRS.RIGHT; // runs off the right wall
  game.snakes[0].body = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
  game.snakes[0].direction = DIRS.RIGHT;
  game.snakes[0].queuedDirection = DIRS.RIGHT; // plenty of room
  game.food = { x: 0, y: 0 };

  game.tick();

  assert.equal(game.status, 'playing');
  assert.equal(game.snakes[1].alive, false);
  assert.equal(game.snakes[0].alive, true);
});

test('2-player: the solo survivor is declared the winner once they also die', () => {
  const game = new SnakeGame('multi', ['P1', 'P2']);
  game.snakes[1].alive = false;
  game.snakes[1].diedAtLength = 3;
  game.snakes[0].body = [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }];
  game.snakes[0].direction = DIRS.RIGHT;
  game.snakes[0].queuedDirection = DIRS.RIGHT;
  game.food = { x: 0, y: 0 };

  game.tick();

  assert.equal(game.status, 'over');
  assert.deepEqual(game.result, {
    type: 'match',
    outcome: 'win',
    winnerName: 'P1',
    players: [
      { name: 'P1', length: 3 },
      { name: 'P2', length: 3 },
    ],
  });
});

test('2-player: a head-on collision ends the match in a draw for both', () => {
  const game = new SnakeGame('multi', ['P1', 'P2']);
  game.snakes[0].body = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  game.snakes[0].direction = DIRS.RIGHT;
  game.snakes[0].queuedDirection = DIRS.RIGHT;
  game.snakes[1].body = [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }];
  game.snakes[1].direction = DIRS.LEFT;
  game.snakes[1].queuedDirection = DIRS.LEFT;
  game.food = { x: 0, y: 0 };

  game.tick(); // both move into (6, 5) at once

  assert.equal(game.status, 'over');
  assert.equal(game.result.type, 'match');
  assert.equal(game.result.outcome, 'draw');
  assert.equal(game.result.winnerName, null);
});

test('2-player: both dying the same tick from separate causes is also a draw', () => {
  const game = new SnakeGame('multi', ['P1', 'P2']);
  game.snakes[0].body = [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }];
  game.snakes[0].direction = DIRS.RIGHT;
  game.snakes[0].queuedDirection = DIRS.RIGHT; // runs off the right wall
  game.snakes[1].body = [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }];
  game.snakes[1].direction = DIRS.LEFT;
  game.snakes[1].queuedDirection = DIRS.LEFT; // runs off the left wall
  game.food = { x: 10, y: 19 };

  game.tick();

  assert.equal(game.status, 'over');
  assert.equal(game.result.outcome, 'draw');
});
