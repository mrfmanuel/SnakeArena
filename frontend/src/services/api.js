/**
 * Snake Arena — services layer entry point.
 *
 * ALL backend interaction for the frontend goes through
 * `window.SnakeArenaAPI`, set up here. Nothing else in the app should
 * import api.mock.js / api.real.js directly.
 *
 * Real backend calls (api.real.js) are the default. The in-memory mock
 * (api.mock.js) is kept for working on the frontend without the backend
 * running, or if the backend needs to be temporarily bypassed. Switch
 * to it with EITHER:
 *   - a URL query param:      index.html?api=mock   (and ?api=real to force real)
 *   - a localStorage flag:    localStorage.setItem('snakeArena:useMockApi', 'true')
 * or by flipping USE_MOCK_API_DEFAULT below.
 *
 * Load order matters: api.mock.js and api.real.js must be loaded before
 * this file (see index.html).
 */

(function (global) {
  'use strict';

  const USE_MOCK_API_DEFAULT = false;

  function resolveUseMock() {
    try {
      const params = new URLSearchParams(global.location.search);
      const override = params.get('api');
      if (override === 'mock') return true;
      if (override === 'real') return false;

      const stored = global.localStorage.getItem('snakeArena:useMockApi');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (e) {
      // URL/localStorage access can throw in some contexts (sandboxed
      // iframes, privacy modes) — fall back to the default rather than
      // breaking the app over a convenience feature.
    }
    return USE_MOCK_API_DEFAULT;
  }

  const useMock = resolveUseMock();

  global.SnakeArenaAPI = useMock ? global.SnakeArenaMockApi.createMockApi() : global.SnakeArenaRealApi.createRealApi();

  if (useMock) {
    console.info('[Snake Arena] Using the in-memory mock API — no backend calls will be made.');
  }
})(window);
