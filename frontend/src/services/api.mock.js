/**
 * Snake Arena — in-memory MOCK backend.
 *
 * Kept around (not the default anymore — see api.js) as a fallback for
 * working on the frontend without the backend running, and as a
 * reference for the shapes the real API in api.real.js has to match.
 *
 * Call `SnakeArenaMockApi.createMockApi()` to get a fresh, isolated
 * in-memory store behind the same function signatures as the real API:
 * getOrCreateProfile, getProfileStats, getProfileHistory,
 * submitSinglePlayerScore, submitMatchResult, getLeaderboard. See
 * openapi.yaml / backend/app/models.py for the authoritative shapes.
 */

(function (global) {
  'use strict';

  // Simulated network latency, so UI code that awaits these calls behaves
  // the same way it does against the real (or a slow) backend.
  const SIMULATED_LATENCY_MS = 150;

  function createMockApi() {
    /** @type {Map<string, object>} keyed by exact (case-sensitive) profile name */
    const profiles = new Map();
    const scores = [];
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

    function getOrCreateProfile(name) {
      const profile = ensureProfile(name);
      return delay(deepClone(profile));
    }

    function getProfileStats(name) {
      const profile = profiles.get(name);
      return delay(profile ? deepClone(profile) : null);
    }

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

    return {
      getOrCreateProfile,
      getProfileStats,
      getProfileHistory,
      submitSinglePlayerScore,
      submitMatchResult,
      getLeaderboard,
    };
  }

  global.SnakeArenaMockApi = { createMockApi };
})(window);
