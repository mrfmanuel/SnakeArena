/**
 * Snake Arena — real backend client.
 *
 * Talks to the FastAPI backend in backend/ over HTTP, following the
 * paths and shapes in /openapi.yaml exactly (same request/response
 * bodies as backend/app/models.py). Same function signatures as the
 * mock in api.mock.js, so callers never need to know which is active.
 */

(function (global) {
  'use strict';

  const DEFAULT_BASE_URL = 'http://127.0.0.1:8000/api';

  /**
   * Thrown for both network failures and non-2xx HTTP responses, so
   * callers can branch on `.status` (null for a network failure) and
   * always get a human-readable `.message`.
   */
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status; // HTTP status code, or null if the request never got a response
    }
  }

  function createRealApi(baseUrl) {
    const base = baseUrl || DEFAULT_BASE_URL;

    async function request(path, options = {}) {
      let response;
      try {
        response = await fetch(base + path, {
          headers: { 'Content-Type': 'application/json' },
          ...options,
        });
      } catch (networkError) {
        throw new ApiError(`Can't reach the server at ${base}. Is the backend running?`, null);
      }

      const text = await response.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch (parseError) {
          // Non-JSON body (e.g. an HTML error page from a proxy) — fall
          // through and let the status-based message below handle it.
        }
      }

      if (!response.ok) {
        const message = (body && body.message) || `Request failed (HTTP ${response.status}).`;
        throw new ApiError(message, response.status);
      }

      return body;
    }

    function getOrCreateProfile(name) {
      return request('/profiles', { method: 'POST', body: JSON.stringify({ name }) });
    }

    function getProfileStats(name) {
      return request(`/profiles/${encodeURIComponent(name)}`, { method: 'GET' }).catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      });
    }

    function getProfileHistory(name) {
      return request(`/profiles/${encodeURIComponent(name)}/history`, { method: 'GET' }).catch((err) => {
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      });
    }

    function submitSinglePlayerScore({ profileName, length }) {
      return request('/scores', {
        method: 'POST',
        body: JSON.stringify({ profileName, length }),
      });
    }

    function submitMatchResult({ players, outcome, winnerName = null }) {
      return request('/matches', {
        method: 'POST',
        body: JSON.stringify({ players, outcome, winnerName }),
      });
    }

    function getLeaderboard() {
      return request('/leaderboard', { method: 'GET' });
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

  global.SnakeArenaRealApi = { createRealApi, DEFAULT_BASE_URL, ApiError };
})(window);
