/**
 * Pure unit tests for computeParlayRollup.
 *
 * Run with:   npm run test:parlay
 * Requires Node 22.6+ (uses --experimental-strip-types).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { computeParlayRollup } from '../parlayRollup.ts';

test('2-leg WON x WON -> WON with full combined payout', () => {
    const legs = [
        { result: 'WON' as const, odds: 2.0 },
        { result: 'WON' as const, odds: 1.5 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'WON');
    if (r.state === 'WON') {
        assert.equal(r.payout, 300);   // 100 * 2.0 * 1.5
        assert.equal(r.reduced, false);
    }
});

test('3-leg WON x WON x PUSH -> reduced WON dropping the pushed leg', () => {
    const legs = [
        { result: 'WON'  as const, odds: 2.0 },
        { result: 'WON'  as const, odds: 1.5 },
        { result: 'PUSH' as const, odds: 3.0 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'WON');
    if (r.state === 'WON') {
        assert.equal(r.payout, 300);   // 100 * 2.0 * 1.5 (pushed leg dropped, NOT 900)
        assert.equal(r.reduced, true);
    }
});

test('3-leg WON x LOST x PENDING -> LOST (any LOST trumps PENDING)', () => {
    const legs = [
        { result: 'WON'     as const, odds: 2.0 },
        { result: 'LOST'    as const, odds: 1.5 },
        { result: 'PENDING' as const, odds: 3.0 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'LOST');
});

test('2-leg PUSH x PUSH -> PUSH (refund stake)', () => {
    const legs = [
        { result: 'PUSH' as const, odds: 2.0 },
        { result: 'PUSH' as const, odds: 1.5 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'PUSH');
});

test('2-leg WON x PENDING -> PENDING (waiting on the second leg)', () => {
    const legs = [
        { result: 'WON'     as const, odds: 2.0 },
        { result: 'PENDING' as const, odds: 1.5 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'PENDING');
});

test('VOID legs behave like PUSH legs (drop from payout)', () => {
    const legs = [
        { result: 'WON'  as const, odds: 2.0 },
        { result: 'WON'  as const, odds: 1.5 },
        { result: 'VOID' as const, odds: 4.0 },
    ];
    const r = computeParlayRollup(legs, 50);
    assert.equal(r.state, 'WON');
    if (r.state === 'WON') {
        assert.equal(r.payout, 150);   // 50 * 2.0 * 1.5
        assert.equal(r.reduced, true);
    }
});

test('All VOID -> PUSH (no surviving legs)', () => {
    const legs = [
        { result: 'VOID' as const, odds: 2.0 },
        { result: 'VOID' as const, odds: 1.5 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'PUSH');
});

test('Missing result on a leg defaults to PENDING', () => {
    const legs: { result?: string; odds: number }[] = [
        { result: 'WON', odds: 2.0 },
        { odds: 1.5 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'PENDING');
});

test('Decimal payout rounds to 2 dp', () => {
    const legs = [
        { result: 'WON' as const, odds: 1.91 },
        { result: 'WON' as const, odds: 1.91 },
    ];
    const r = computeParlayRollup(legs, 33);
    assert.equal(r.state, 'WON');
    if (r.state === 'WON') {
        // 33 * 1.91 * 1.91 = 120.3873, rounded to 120.39
        assert.equal(r.payout, 120.39);
    }
});

test('Single LOST leg in an otherwise pending parlay -> LOST (early settle)', () => {
    const legs = [
        { result: 'PENDING' as const, odds: 2.0 },
        { result: 'LOST'    as const, odds: 1.5 },
        { result: 'PENDING' as const, odds: 3.0 },
    ];
    const r = computeParlayRollup(legs, 100);
    assert.equal(r.state, 'LOST');
});
