/**
 * Pure unit tests for validateParlayAdd (strict-parlay rules).
 *
 * Run with:   npm run test:parlay
 * Requires Node 22.6+ (uses --experimental-strip-types).
 *
 * Product rules under test (5.8.2026):
 *   - MAX_PARLAY_LEGS = 10
 *   - Same marketId + same marketKey + different optionId => BOTH_SIDES (reject)
 *   - Same marketId + DIFFERENT marketKey                 => allowed (loose SGP)
 *   - Different marketId                                  => always allowed
 *   - Exact-duplicate handled by caller as a toggle, not by this helper.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateParlayAdd, MAX_PARLAY_LEGS, type ParlayCandidate } from '../parlayRules.ts';

const make = (marketId: string, marketKey: string, optionId: string): ParlayCandidate =>
    ({ marketId, marketKey, optionId });

test('empty existing slip accepts any candidate', () => {
    const r = validateParlayAdd([], make('evt-1', 'h2h', 'team-a'));
    assert.equal(r.ok, true);
});

test('different markets are always compatible', () => {
    const existing = [make('evt-1', 'h2h', 'team-a')];
    const r = validateParlayAdd(existing, make('evt-2', 'h2h', 'team-c'));
    assert.equal(r.ok, true);
});

test('same event different market types is allowed (loose SGP)', () => {
    // Lakers ML + Lakers/Knicks Over -> ok
    const existing = [make('evt-1', 'h2h', 'lakers-ml')];
    const r = validateParlayAdd(existing, make('evt-1', 'totals', 'over-220'));
    assert.equal(r.ok, true);
});

test('same event h2h both sides is rejected as BOTH_SIDES', () => {
    // Yankees ML + Red Sox ML -> rejected
    const existing = [make('evt-1', 'h2h', 'yankees-ml')];
    const r = validateParlayAdd(existing, make('evt-1', 'h2h', 'redsox-ml'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'BOTH_SIDES');
});

test('same event totals over+under is rejected as BOTH_SIDES', () => {
    const existing = [make('evt-1', 'totals', 'over-220')];
    const r = validateParlayAdd(existing, make('evt-1', 'totals', 'under-220'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'BOTH_SIDES');
});

test('same event spreads opposite sides is rejected as BOTH_SIDES', () => {
    // Lakers -3.5 + Knicks +3.5 -> rejected
    const existing = [make('evt-1', 'spreads', 'lakers-minus35')];
    const r = validateParlayAdd(existing, make('evt-1', 'spreads', 'knicks-plus35'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'BOTH_SIDES');
});

test('reaching MAX_PARLAY_LEGS rejects further adds', () => {
    const existing: ParlayCandidate[] = Array.from({ length: MAX_PARLAY_LEGS }, (_, i) =>
        make(`evt-${i}`, 'h2h', `opt-${i}`),
    );
    const r = validateParlayAdd(existing, make('evt-extra', 'h2h', 'opt-extra'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'MAX_LEGS');
});

test('one short of MAX_PARLAY_LEGS still accepts', () => {
    const existing: ParlayCandidate[] = Array.from({ length: MAX_PARLAY_LEGS - 1 }, (_, i) =>
        make(`evt-${i}`, 'h2h', `opt-${i}`),
    );
    const r = validateParlayAdd(existing, make('evt-extra', 'h2h', 'opt-extra'));
    assert.equal(r.ok, true);
});

test('MAX_LEGS takes precedence over BOTH_SIDES when both would apply', () => {
    // Slip is full AND the candidate would also be a both-sides match.
    // Helper should report MAX_LEGS first.
    const existing: ParlayCandidate[] = Array.from({ length: MAX_PARLAY_LEGS }, (_, i) =>
        i === 0 ? make('evt-1', 'h2h', 'team-a') : make(`evt-${i}`, 'h2h', `opt-${i}`),
    );
    const r = validateParlayAdd(existing, make('evt-1', 'h2h', 'team-b'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'MAX_LEGS');
});

test('exact duplicate (same marketId + marketKey + optionId) does NOT trip BOTH_SIDES', () => {
    // The caller handles exact duplicates as a toggle BEFORE calling this
    // helper, so we should be defensive: if it does ever come through,
    // treat it as "ok" rather than wrongly flagging it as both-sides.
    // Production paths never hit this because selectBet's toggle check
    // short-circuits first.
    const existing = [make('evt-1', 'h2h', 'team-a')];
    const r = validateParlayAdd(existing, make('evt-1', 'h2h', 'team-a'));
    assert.equal(r.ok, true);
});

test('BOTH_SIDES check ignores legs from other events with the same marketKey', () => {
    // Lakers ML (evt-1) + Knicks ML (evt-1) -> rejected, but
    // Lakers ML (evt-1) + Bucks ML (evt-2) -> fine, even though both are h2h.
    const existing = [
        make('evt-1', 'h2h', 'lakers-ml'),
        make('evt-3', 'spreads', 'celtics-minus5'),
    ];
    const r = validateParlayAdd(existing, make('evt-2', 'h2h', 'bucks-ml'));
    assert.equal(r.ok, true);
});
