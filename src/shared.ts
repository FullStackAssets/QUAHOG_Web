import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";

// A knockable agent (pedestrian) the player can punch/shove.
export interface Body {
  pos: THREE.Vector3;
  push: THREE.Vector3;
  hit: number; // melee hits queued by the player, consumed by the owner
}

// A drivable traffic car the player can ram (stop) or carjack (steal).
export interface TrafficCar {
  pos: THREE.Vector3;
  yaw: number;
  type: string;
  color: string;
  stop: number;   // seconds the car stays halted after a contact
  stolen: boolean; // taken by the player → hidden from traffic
}

// A fired-shot tracer for the gunplay VFX layer.
export interface Shot {
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number; // seconds remaining
}

// A pursuing police unit, registered by the Police system so the gun can hit it.
export interface Cop {
  pos: THREE.Vector3;
  dmg: number;   // damage queued by the player's gun
  dead: boolean;
}

// A one-shot impact burst (blood/dust) consumed by the particle renderer.
export interface Impact {
  pos: THREE.Vector3;
  color: string;
}

// A traffic signal stop-line published by TrafficLights; traffic halts while red.
export interface StopZone {
  x: number;
  z: number;
  rot: number;
  red: boolean;
}

// A collectible cash drop (from a downed ped), drained by the Pickups layer.
export interface Pickup {
  pos: THREE.Vector3;
  value: number;
  spin: number;
}

// A transient threat point that scatters nearby pedestrians (gunfire/violence).
export interface Alarm {
  pos: THREE.Vector3;
  t: number; // seconds remaining
}

// Cross-component mutable handles shared by the player, car, and camera.
// (Kept out of React state so per-frame updates don't trigger re-renders.)
export const shared = {
  player: null as RapierRigidBody | null,
  car: null as RapierRigidBody | null,
  boat: null as RapierRigidBody | null,
  boatYaw: -Math.PI / 2,
  // Initial facing = -x (west), looking toward Seamen's Bethel from the spawn.
  /** Camera azimuth (radians), eased toward the active target's heading. */
  camYaw: -Math.PI / 2,
  /** Active on-foot heading (radians). */
  heading: -Math.PI / 2,
  /** Car heading (radians). */
  carYaw: -Math.PI / 2,
  /** Pedestrian bodies registered by StreetLife, for melee contact. */
  peds: [] as Body[],
  /** Traffic cars registered by StreetLife, for ramming + carjacking. */
  traffic: [] as TrafficCar[],
  /** Active gun-tracer VFX, drained by the Tracers renderer. */
  shots: [] as Shot[],
  /** Pursuing police units, registered by the Police system. */
  cops: [] as Cop[],
  /** Day factor 0 (night) .. 1 (noon), driven by the day/night cycle. */
  dayT: 1,
  /** Current in-game hour 0..24. */
  hour: 9,
  /** In-game day counter (starts at 1); bumps at midnight or on sleep. */
  day: 1,
  /** Signed forward speed of the car (m/s), written by Car each frame. */
  carSpeed: 0,
  /** True while the car is cornering hard at speed (lays skid marks). */
  skid: false,
  /** Decaying camera-shake impulse; bump it to jolt the chase camera. */
  shake: 0,
  /** Sprint stamina 0..100 (on foot). */
  stamina: 100,
  /** Threat that scatters nearby pedestrians (gunfire/violence). */
  alarm: { pos: new THREE.Vector3(), t: 0 } as Alarm,
  /** Pending impact bursts (blood/dust) drained by the particle renderer. */
  impacts: [] as Impact[],
  /** Signal stop-lines published by TrafficLights; traffic halts at red ones. */
  stopZones: [] as StopZone[],
  /** Collectible cash drops (from downed peds), drained by the Pickups layer. */
  pickups: [] as Pickup[],
  /** Player car body damage 0 (pristine) .. 100 (wrecked) — smokes when high. */
  carDamage: 0,
};

/** Drop a cash pickup at a world point (capped so it can't grow unbounded). */
export function addPickup(x: number, z: number, value: number) {
  if (shared.pickups.length < 48) shared.pickups.push({ pos: new THREE.Vector3(x, 0.8, z), value, spin: Math.random() * Math.PI * 2 });
}

/** Add a one-shot camera shake (juice §23). */
export function addShake(amount: number) {
  shared.shake = Math.min(1.2, shared.shake + amount);
}

/** Raise an alarm at a world point so nearby peds flee (§14). */
export function raiseAlarm(x: number, z: number, seconds = 5) {
  shared.alarm.pos.set(x, 0, z);
  shared.alarm.t = Math.max(shared.alarm.t, seconds);
}

/** Queue an impact burst at a point (§23). */
export function addImpact(pos: THREE.Vector3, color: string) {
  if (shared.impacts.length < 16) shared.impacts.push({ pos: pos.clone(), color });
}
