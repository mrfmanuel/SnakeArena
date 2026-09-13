# Snake Arena — Product Spec

## Overview
A browser-based Snake game supporting single-player and 2-player (same-screen) modes, with player profiles, a length-based leaderboard, and persistent match history — served by a backend API (SQLite), initially mocked on the frontend.

## Features

### 1. Single-Player Snake
Play a solo round of Snake on a fixed 20×20 grid; score is measured by snake length at death.

**User story:** As a player, I want to play a single-player round of Snake so I can try to beat my best length.

**Acceptance criteria:**
- [ ] Snake moves continuously in the last chosen direction until it dies or is paused.
- [ ] Eating food grows the snake by 1 segment and spawns a new food cell.
- [ ] Snake speed stays constant for the entire run (no speedup over time).
- [ ] Colliding with a wall ends the run.
- [ ] Colliding with the snake's own body ends the run.
- [ ] On death, a game-over screen shows the final snake length.
- [ ] On death, the run's length is submitted to the backend and reflected on the leaderboard.

### 2. Two-Player Same-Screen Match
Two named profiles play head-to-head on one keyboard, on the same 20×20 grid.

**User story:** As two players sharing a keyboard, we want to race our snakes against each other so a winner (or draw) is decided.

**Acceptance criteria:**
- [ ] Player 1 is controlled with WASD; Player 2 is controlled with Arrow keys.
- [ ] Both snakes move at the same constant speed on the same grid simultaneously.
- [ ] A snake dies when it hits a wall, its own body, or the other snake's body.
- [ ] If exactly one snake dies on a given tick, that snake disappears from the board immediately and the other player continues playing solo (still scoring/growing) until they too die.
- [ ] When the surviving player eventually dies, they are declared the winner and the match ends.
- [ ] If both snakes die on the same tick (including a head-on collision), the match ends immediately in a draw for both.
- [ ] The game-over screen shows the match result (winner name, or "Draw").
- [ ] The match result (players, outcome, date, each snake's final length) is submitted to the backend.

### 3. Player Profiles
Players identify themselves by name before a match; profiles persist stats and history across sessions.

**User story:** As a player, I want to type my name to create or reuse my profile so my stats accumulate over time.

**Acceptance criteria:**
- [ ] Before a match, each player types a name into a text field.
- [ ] If the name matches an existing profile, that profile is reused; otherwise a new profile is created.
- [ ] Profile names are case-sensitive-unique — the backend rejects/reuses rather than creating a second profile with an identical name.
- [ ] A profile's aggregate stats (wins, draws, losses, best length) are viewable.
- [ ] A profile's match history (opponent, result, date, length) is viewable.

### 4. Leaderboard
A ranked view of top results, backed by the server, combining single-player scores and 2-player match outcomes.

**User story:** As a player, I want to see how my best length and match record compare to others on this backend.

**Acceptance criteria:**
- [ ] The leaderboard ranks entries by snake length, descending.
- [ ] The leaderboard includes single-player high-score runs.
- [ ] The leaderboard includes 2-player match wins/draws (with each snake's final length).
- [ ] The leaderboard is fetched from the backend API (not read from browser localStorage).
- [ ] The leaderboard reflects only data on this backend's database (no cross-deployment/global aggregation).

## Game Flow
1. **Start screen** — enter player name(s) (1 for single-player, 2 for match) and select mode.
2. **Game screen** — play; Spacebar pauses/resumes.
3. **Game-over screen** — shows result (score, or winner/draw); result is submitted to backend.
4. **Restart** — button returns to start screen.

## Non-Goals
- No login/passwords or authentication — profiles are name-only, not secured.
- No networked/remote multiplayer — 2-player is same-screen/same-keyboard only.
- No power-ups, obstacles, or special food types.
- No adjustable difficulty, grid size, or speed settings — grid is fixed 20×20, speed is constant.
- No wall wraparound — hitting a wall is always a death.
- No global/cross-deployment leaderboard — only data on this backend instance.
- No more than 2 players on screen at once.

## Data & Backend Notes
- Persistence: SQLite via a backend API. Frontend calls are mocked initially but shaped as real API calls (to be wired to the live backend later).
- Entities: `Profile` (unique name, aggregate stats), `Match` (mode, players, result, date, final length(s)), `Score` (single-player run: profile, length, date).
