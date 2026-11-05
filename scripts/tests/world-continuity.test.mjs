import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyWorldLedger, addWorldEvent, decodeWorldLedger, catchUpWorldClock,
  weatherBusinessMultiplier, MAX_WORLD_EVENTS, MAX_OFFLINE_GAME_HOURS,
} from '../../src/world/worldContinuity.ts';

const entry = (text, day = 1, hour = 9) => ({ day, hour, kind: 'weather', text });

describe('bounded, recoverable local world events', () => {
  it('records monotonic ids and trims old entries without resetting identity', () => {
    let log = emptyWorldLedger();
    for (let i = 0; i < 90; i++) log = addWorldEvent(log, entry(`Event ${i}`));
    assert.equal(log.events.length, MAX_WORLD_EVENTS);
    assert.equal(log.events[0].id, 27);
    assert.equal(log.events.at(-1).id, 90);
    assert.equal(log.nextId, 91);
    assert.deepEqual(decodeWorldLedger(JSON.stringify(log)), log);
    const next = addWorldEvent(log, entry('New event'));
    assert.equal(next.events.at(-1).id, 91);
  });
  it('rejects incompatible and tampered histories without executing contents', () => {
    assert.equal(decodeWorldLedger(JSON.stringify({version: 99, nextId: 1, events: []})), null);
    assert.equal(decodeWorldLedger('{bad'), null);
    assert.equal(decodeWorldLedger('x'.repeat(50000)), null);
    assert.equal(decodeWorldLedger(JSON.stringify({version: 1, nextId: 4, events: [
      {id: 3, day: 1, hour: 9, kind: 'weather', text: 'ok'},
      {id: 2, day: 1, hour: 9, kind: 'weather', text: 'out of order'},
    ]})), null);
    assert.equal(decodeWorldLedger(JSON.stringify({version: 1, nextId: 2, events: [
      {id: 1, day: 1, hour: Number.POSITIVE_INFINITY, kind: 'weather', text: 'invalid'},
    ]})), null);
    assert.equal(decodeWorldLedger(JSON.stringify({version: 1, nextId: 2, events: [
      {id: 1, day: 1, hour: 9, kind: 'arbitrary_command', text: 'ignore'},
    ]})), null);
  });
  it('accepts mission consequences and bounds oversize story text', () => {
    const previous = emptyWorldLedger();
    const next = addWorldEvent(previous, {day: 3, hour: 7.5, kind: 'mission', text: 'M'.repeat(300)});
    assert.equal(previous.events.length, 0);
    assert.equal(next.events[0].kind, 'mission');
    assert.equal(next.events[0].text.length, 180);
    assert.deepEqual(decodeWorldLedger(JSON.stringify(next)), next);
  });
  it('refuses invalid event time and keeps previous save untouched', () => {
    const state = addWorldEvent(emptyWorldLedger(), entry('Rain'));
    assert.equal(addWorldEvent(state, entry('Invalid', 0)), state);
    assert.equal(addWorldEvent(state, entry('Invalid', 1, 24)), state);
    assert.equal(addWorldEvent(state, entry('Invalid', 1, NaN)), state);
  });
});

describe('safe offline continuity', () => {
  const savedAtMs = 1_760_000_000_000;
  it('resumes the correct game day across midnight', () => {
    const after = catchUpWorldClock({day: 4, hour: 23}, savedAtMs, savedAtMs + 90_000);
    assert.equal(after.day, 5);
    assert.ok(after.hour > 2.59 && after.hour < 2.61);
  });
  it('caps long absences and avoids zero, future or corrupted timestamps', () => {
    const after = catchUpWorldClock({day: 10, hour: 3}, savedAtMs, savedAtMs + 10 ** 9);
    assert.equal(after.elapsedGameHours, MAX_OFFLINE_GAME_HOURS);
    assert.equal(after.hour, 9);
    assert.equal(catchUpWorldClock({day: 2, hour: 3}, undefined, savedAtMs).elapsedGameHours, 0);
    assert.equal(catchUpWorldClock({day: 2, hour: 3}, savedAtMs + 10, savedAtMs).elapsedGameHours, 0);
    assert.equal(catchUpWorldClock({day: 2, hour: 3}, savedAtMs, savedAtMs + 200).elapsedGameHours, 0);
  });
  it('does not modify saves or pay economy rewards while offline', () => {
    const clock = {day: 8, hour: 7};
    catchUpWorldClock(clock, savedAtMs, savedAtMs + 720_000);
    assert.deepEqual(clock, {day: 8, hour: 7});
  });
});

describe('observable cross-system economy', () => {
  it('weather lowers live income but never makes it negative', () => {
    assert.equal(weatherBusinessMultiplier('clear'), 1);
    assert.equal(weatherBusinessMultiplier('fog'), 1);
    assert.equal(weatherBusinessMultiplier('rain'), 0.93);
    assert.equal(weatherBusinessMultiplier('snow'), 0.85);
  });
});
