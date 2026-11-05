import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FEBRUARY_2026_BLIZZARD as storm, isBlizzardMission, snowVehicleLimits, snowfallParticleCount } from "../../src/weather/snowstorm.ts";

test("storm is a February 2026 event", () => {
  assert.equal(storm.date, "2026-02-23");
  assert.equal(storm.gameDriftInches, 52);
  assert.equal(storm.newBedfordMeasuredInches, 37);
  assert.equal(storm.fallRiverReportedInches, 41);
});

test("only active blizzard mission locks weather", () => {
  assert.equal(isBlizzardMission(storm.missionTitle, false), true);
  assert.equal(isBlizzardMission(storm.missionTitle, true), false);
  assert.equal(isBlizzardMission("Off the Boat", false), false);
});

test("snow slows cars without changing normal road speed", () => {
  const dry = snowVehicleLimits(false);
  const snow = snowVehicleLimits(true);
  assert.equal(dry.forward, 44);
  assert.ok(snow.forward < dry.forward && snow.forward > 0);
  assert.ok(snow.reverse < dry.reverse);
  assert.ok(snow.steer < dry.steer);
  assert.ok(snow.throttleResponse < dry.throttleResponse);
});

test("snow flakes are quality-scaled for mobile", () => {
  assert.ok(snowfallParticleCount(0) < snowfallParticleCount(1));
  assert.ok(snowfallParticleCount(1) < snowfallParticleCount(2));
  assert.ok(snowfallParticleCount(2) < 1000);
});

test("story replaces hurricane without removing other missions", () => {
  const mission = readFileSync(new URL("../../src/mission.ts", import.meta.url), "utf8");
  assert.match(mission, /Blizzard of '26/);
  assert.match(mission, /52-inch drifts/);
  assert.doesNotMatch(mission, /title: "Gloria"/);
  assert.match(mission, /title: "Off the Boat"/);
});

test("snow is wired to rendering, ground and roads", () => {
  const read = (p) => readFileSync(new URL("../../src/" + p, import.meta.url), "utf8");
  assert.match(read("Experience.tsx"), /<Snow \/>/);
  assert.match(read("world/AerialGround.tsx"), /snowGround/);
  assert.match(read("world/Roads.tsx"), /snowy \?/);
  assert.match(read("world/DayNight.tsx"), /weather === "snow"/);
  assert.match(read("world/Snowbanks.tsx"), /MAX_BANKS/);
  assert.match(read("Experience.tsx"), /<Snowbanks roads={slice.roads} \/>/);
});

test("storm gates changes and restores previous weather", () => {
  const store = readFileSync(new URL("../../src/store.ts", import.meta.url), "utf8");
  assert.match(store, /weatherBeforeBlizzard: s\.weather/);
  assert.match(store, /weather: s\.weatherBeforeBlizzard/);
  assert.match(store, /s\.blizzardActive \? s/);
});
