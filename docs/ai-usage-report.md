# AI Usage Report

This project was built with Claude Code (Anthropic's CLI coding agent)
as the sole author of essentially all code, config, tests, and docs in
this repo, working under a human developer's direction through an
iterative, conversational process — the developer set scope and made
product decisions, reviewed and corrected the agent's output at several
points, and asked for verification rather than accepting claims of
"done" at face value. This document describes that process phase by
phase, and calls out concrete cases where AI output was wrong and had
to be caught and corrected.

## Workflow

The project was built in explicit, sequential phases, each on its own
git branch, each reviewed before merging to `main`:

1. **Scope definition.** Rather than being handed a written spec, the
   agent drew one out through one-question-at-a-time interviewing about
   rules, modes, data, and flow, then produced `product-spec.md`:
   features, user stories, yes/no acceptance criteria, and an explicit
   non-goals section.
2. **API contract.** `openapi.yaml` was generated from `product-spec.md`
   plus a frontend "mock services layer" written first specifically to
   pin down the shapes a real API would need — the contract was defined
   *before* any backend code existed, and the agent flagged where the
   mock's shape didn't map cleanly onto REST conventions (see "notable
   corrections" below).
3. **Backend, in-memory.** A FastAPI backend implementing the contract
   exactly, backed by plain Python data structures, with a pytest suite
   written alongside it.
4. **Frontend prototype.** Plain HTML/CSS/JS (no build step, no
   framework) implementing product-spec.md's screens and flow against
   the mock services layer only — no backend involved yet.
5. **Frontend/backend integration.** The mock was replaced with a real
   `fetch`-based client matching the OpenAPI contract, with the mock
   kept available behind a flag (`?api=mock`) rather than deleted.
   Error handling (offline backend, non-2xx responses) was added and
   verified by actually simulating those failures, not just written and
   assumed to work.
6. **Persistence.** The in-memory store was swapped for a SQLite store
   via SQLAlchemy, with the constraint that routers and Pydantic models
   must not need to change — only what backs the `Store` class.
7. **UX polish.** A 3-2-1 countdown before play begins/resumes, with an
   explicit product clarification sought (and answered) mid-task about
   how "Play Again" should behave, since the requested behavior implied
   a small flow change beyond the countdown itself.
8. **Final polish** (this pass). Reviewing test coverage against
   product-spec.md and openapi.yaml and filling in gaps, adding a
   proportionate frontend test suite, and writing this report plus
   `AGENTS.md` and the root README.

## How verification was actually done

Claims of "this works" were backed by running things, not just writing
code and asserting it should work:

- The backend's pytest suite was run after every phase that touched it,
  including after the SQLite migration (all 34 tests, plus new ones
  added in the final-polish pass).
- The frontend prototype and every later frontend change were
  exercised with Playwright (driven headlessly via Python, since no
  Node/browser-automation CLI was preinstalled in the dev environment)
  — actually clicking through screens, playing rounds, and checking
  screenshots and console output, rather than only reading the code.
- The SQLite persistence work was checked beyond its test suite: the
  real server was started, given data, restarted, and the data's
  survival (and the seed data's *non*-duplication) was confirmed by
  hand via `curl`.
- The final-polish frontend tests were run against Node's actual test
  runner (Node's built-in `node:test`) before being considered done,
  not left unverified because Node wasn't part of the everyday toolchain.

## Notable corrections — cases where AI output was wrong

**The 2-player win condition, corrected by the developer.** The
initially-drafted rule was that a match ends the instant either snake
dies. The developer corrected this: the surviving snake should keep
playing (and scoring) solo until it also dies, at which point *it* is
the winner; only a simultaneous double-death (including head-on) is a
draw. `product-spec.md` and the game engine were both updated to match.
This is arguably the single most important product decision in the
repo, and it came from the developer catching a case the initial
interview had glossed over.

**A CSS specificity bug, caught by the agent's own testing — not
written correctly the first time.** In the frontend prototype, every
screen was styled with `.screen { display: flex; ... }` and toggled
via the standard HTML `hidden` attribute. This looks correct, but
`hidden` only works through the browser's default stylesheet rule
`[hidden] { display: none }` — which has the *same specificity* as
`.screen`'s own `display: flex`, and author stylesheets win specificity
ties over the user-agent stylesheet regardless of the `hidden`
attribute's presence. The practical effect: every screen rendered
stacked on top of each other at once, `hidden` attribute or not. This
was not something the developer flagged — it was caught by the agent's
own Playwright verification pass (a screenshot showing all screens
overlapping at once was the tell), diagnosed, and fixed with a global
`[hidden] { display: none !important; }` rule. It's a good example of
why "the code looks right" and "the code was verified running" are
different claims, and why the latter is the one that matters.

**A test-isolation bug in the SQLite migration, also self-caught.**
The first version of `app/deps.py` built the real, file-backed `Store`
eagerly at module import time. Since the test suite imports the same
`app.main` module the real server does, this meant every `pytest` run
was silently creating and seeding the actual `snake_arena.db` file on
disk *before* the test fixture's dependency override even had a chance
to apply — exactly the kind of test/production leakage the task's
requirements had explicitly warned against. This was caught while
manually verifying persistence behavior (noticing the db file appeared
after running tests, not just after running the server), and fixed by
making `Store` construction lazy, so the override fully replaces it
under test with no real construction ever happening.

**A test-authoring bug, caught by actually running the test.** While
adding a self-collision test for the game engine, the first version of
the test set up a snake body where the "collision" cell was actually
the snake's *tail* — which the engine correctly treats as safe (the
tail vacates that same tick), not a collision. The test failed when
run, which was the point of running it; the fix was to correct the
test's setup, and the accidental discovery became a second, explicit
test asserting that moving into the current tail cell is in fact safe.

## What AI-generated code was *not* independently re-derived by a human

All production code, tests, and docs in this repo were written by the
agent. The developer's role was direction (scope, priorities, ordering
of work), review (reading summaries and diffs, asking clarifying
questions when a requirement had more than one reasonable reading —
e.g. whether "Play Again" should skip the start screen), and the one
substantive game-rule correction described above. No code in this repo
should be assumed correct because "an AI wrote it carefully" — the
verification steps described above are the actual basis for confidence
in any given piece of it, and are worth extending (not skipping) as the
project grows.
