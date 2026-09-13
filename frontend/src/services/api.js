/**
 * Snake Arena — backend services layer (MOCK IMPLEMENTATION).
 *
 * ALL backend interaction for the frontend goes through this module.
 * Nothing else in the app should read/write game data directly — every
 * screen calls one of the functions below, which currently keeps state
 * in memory (reset on page reload) instead of calling a real server.
 *
 * The function signatures, parameter shapes, and return shapes here are
 * meant to map 1:1 onto a future OpenAPI contract for the real backend
 * (SQLite via a small REST API, per product-spec.md). Swapping the body
 * of each function for a `fetch(...)` call should not require changing
 * any caller.
 *
 * Shapes (JSDoc typedefs, for reference):
 *
 * @typedef {Object} Profile
 * @property {number} id
 * @property {string} name
 * @property {{wins: number, draws: number, losses: number, bestLength: number}} stats
 * @property {string} createdAt - ISO date string
 *
 * @typedef {Object} ScoreEntry
 * @property {number} id
 * @property {string} profileName
 * @property {number} length
 * @property {string} date - ISO date string
 *
 * @typedef {Object} MatchEntry
 * @property {number} id
 * @property {{name: string, length: number}[]} players
 * @property {'win'|'draw'} outcome
 * @property {string|null} winnerName - null when outcome is 'draw'
 * @property {string} date - ISO date string
 *
 * @typedef {Object} MatchHistoryEntry
 * @property {string|null} opponent
 * @property {'win'|'loss'|'draw'} result
 * @property {number} length
 * @property {string} date - ISO date string
 *
 * @typedef {Object} LeaderboardEntry
 * @property {'single'|'match'} type
 * @property {string} profileName
 * @property {number} length
 * @property {string} date - ISO date string
 * @property {string} detail - human-readable label, e.g. "Single-player", "Win", "Loss", "Draw"
 */

(function (global) {
  'use strict';

  // Simulated network latency, so UI code that awaits these calls behaves
  // the same way it will once they're real network requests.
  const SIMULATED_LATENCY_MS = 150;

  /** @type {Map<string, Profile>} keyed by exact (case-sensitive) profile name */
  const profiles = new Map();
  /** @type {ScoreEntry[]} */
  const scores = [];
  /** @type {MatchEntry[]} */
  const matches = [];

  let nextProfileId = 1;
  let nextScoreId = 1;
  let nextMatchId = 1;

  function delay(value) {
    return new Promise((resolve) => setTimeout(() => resolve(value), SIMULATED_LATENCY_MS));
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeProfile(name) {
    return {
      id: nextProfileId++,
      name,
      stats: { wins: 0, draws: 0, losses: 0, bestLength: 0 },
      createdAt: new Date().toISOString(),
    };
  }

  function ensureProfile(name) {
    if (!profiles.has(name)) {
      profiles.set(name, makeProfile(name));
    }
    return profiles.get(name);
  }

  function bumpBestLength(name, length) {
    const profile = ensureProfile(name);
    if (length > profile.stats.bestLength) {
      profile.stats.bestLength = length;
    }
  }

  /**
   * Get a profile by exact name, creating it if it doesn't exist yet.
   * Names are treated as unique (case-sensitive) — this is how a
   * "type a name to create-or-select" flow resolves to one profile.
   *
   * @param {string} name
   * @returns {Promise<Profile>}
   */
  function getOrCreateProfile(name) {
    const profile = ensureProfile(name);
    return delay(deepClone(profile));
  }

  /**
   * Fetch a profile's current aggregate stats.
   *
   * @param {string} name
   * @returns {Promise<Profile|null>} null if no profile with that name exists
   */
  function getProfileStats(name) {
    const profile = profiles.get(name);
    return delay(profile ? deepClone(profile) : null);
  }

  /**
   * Fetch a profile's match history, newest first.
   *
   * @param {string} name
   * @returns {Promise<MatchHistoryEntry[]>}
   */
  function getProfileHistory(name) {
    const history = matches
      .filter((match) => match.players.some((p) => p.name === name))
      .map((match) => {
        const me = match.players.find((p) => p.name === name);
        const opponent = match.players.find((p) => p.name !== name) || null;
        const result = match.outcome === 'draw' ? 'draw' : match.winnerName === name ? 'win' : 'loss';
        return {
          opponent: opponent ? opponent.name : null,
          result,
          length: me.length,
          date: match.date,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return delay(deepClone(history));
  }

  /**
   * Submit the result of a completed single-player run.
   *
   * @param {{profileName: string, length: number}} params
   * @returns {Promise<ScoreEntry>}
   */
  function submitSinglePlayerScore({ profileName, length }) {
    bumpBestLength(profileName, length);
    const entry = {
      id: nextScoreId++,
      profileName,
      length,
      date: new Date().toISOString(),
    };
    scores.push(entry);
    return delay(deepClone(entry));
  }

  /**
   * Submit the result of a completed 2-player match.
   *
   * @param {{players: {name: string, length: number}[], outcome: 'win'|'draw', winnerName?: string|null}} params
   * @returns {Promise<MatchEntry>}
   */
  function submitMatchResult({ players, outcome, winnerName = null }) {
    players.forEach((player) => {
      bumpBestLength(player.name, player.length);
      const profile = ensureProfile(player.name);
      if (outcome === 'draw') {
        profile.stats.draws += 1;
      } else if (player.name === winnerName) {
        profile.stats.wins += 1;
      } else {
        profile.stats.losses += 1;
      }
    });

    const entry = {
      id: nextMatchId++,
      players: players.map((p) => ({ name: p.name, length: p.length })),
      outcome,
      winnerName,
      date: new Date().toISOString(),
    };
    matches.push(entry);
    return delay(deepClone(entry));
  }

  /**
   * Fetch the combined leaderboard (single-player runs + match results),
   * ranked by snake length, descending.
   *
   * @returns {Promise<LeaderboardEntry[]>}
   */
  function getLeaderboard() {
    const fromScores = scores.map((s) => ({
      type: 'single',
      profileName: s.profileName,
      length: s.length,
      date: s.date,
      detail: 'Single-player',
    }));

    const fromMatches = matches.flatMap((m) =>
      m.players.map((p) => ({
        type: 'match',
        profileName: p.name,
        length: p.length,
        date: m.date,
        detail: m.outcome === 'draw' ? 'Draw' : p.name === m.winnerName ? 'Win' : 'Loss',
      }))
    );

    const combined = [...fromScores, ...fromMatches].sort((a, b) => b.length - a.length);
    return delay(deepClone(combined));
  }

  global.SnakeArenaAPI = {
    getOrCreateProfile,
    getProfileStats,
    getProfileHistory,
    submitSinglePlayerScore,
    submitMatchResult,
    getLeaderboard,
  };
})(window);
