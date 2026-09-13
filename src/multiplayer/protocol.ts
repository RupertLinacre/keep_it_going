import { isDifficulty } from "../difficulty";
import type { Difficulty } from "../types";
import { normalizeTables } from "../questions";

export const PROTOCOL = 3;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;
export type Vec = [number, number, number];
export type Quat = [number, number, number, number];
export type Body = { id: string; color: number; cargo: number; cargoAge: number; position: Vec; rotation: Quat };
export type Link = { start: Vec; end: Vec; stress: number };
export type Impact = { id: number; position: Vec; age: number; color: number; water: boolean; particles: { position: Vec; size: number }[] };
export type RideState = {
  seq: number; time: number; distance: number; speed: number; correct: number;
  ended: boolean; impacts: Impact[]; bodies: Body[]; parcels: { position: Vec; rotation: Quat }[]; links: Link[];
};
export type RaceResult = { distance: number; correct: number; score: number; water: boolean };
export type Round = { id: string; seed: number; questionSeed: number; tables: number[]; difficulty: Difficulty; guestDifficulty: Difficulty };
export type Wire =
  | { kind: "hello"; version: number; name: string; difficulty: Difficulty }
  | { kind: "lobby"; name: string; tables: number[]; difficulty: Difficulty }
  | { kind: "prepare"; round: Round }
  | { kind: "ready"; round: string }
  | { kind: "go"; round: string; delay: number }
  | { kind: "state"; round: string; state: RideState }
  | { kind: "finish"; round: string; result: RaceResult }
  | { kind: "pause"; round: string; paused: boolean }
  | { kind: "rematch"; round: string }
  | { kind: "ping"; at: number }
  | { kind: "pong"; at: number }
  | { kind: "leave" }
  | { kind: "error"; message: string };

export function inviteCode(random = Math.random) {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join("");
}
export const cleanCode = (value: string) => value.trim().toUpperCase();
export const validCode = (value: string) => value.length === CODE_LENGTH && [...value].every(c => CODE_ALPHABET.includes(c));
export const cleanName = (value: string) => value.trim().replace(/[\u0000-\u001f]/g, "").slice(0, 18) || "Rider";
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const number = (v: unknown, min = 0, max = 1e8): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max = 80): v is string => typeof v === "string" && v.length <= max;
const vector = (v: unknown, length: number) => Array.isArray(v) && v.length === length && v.every(n => number(n, -1e8));
const quaternion = (v: unknown) => vector(v, 4) && Math.abs((v as number[]).reduce((s, n) => s + n * n, 0) - 1) < 0.05;
const tables = (v: unknown) => Array.isArray(v) && v.length > 0 && v.length <= 12 && v.every(n => Number.isInteger(n) && n >= 1 && n <= 12);
export function validRideState(v: unknown): v is RideState {
  if (!object(v) || !Number.isSafeInteger(v.seq) || !number(v.seq) || !number(v.time) || !number(v.distance) || !number(v.speed, 0, 2000)
    || !Number.isSafeInteger(v.correct) || !number(v.correct) || typeof v.ended !== "boolean") return false;
  if (!Array.isArray(v.bodies) || !v.bodies.length || v.bodies.length > 25 || !v.bodies.every(b => object(b) && text(b.id, 32)
    && Number.isInteger(b.color) && number(b.color) && Number.isInteger(b.cargo) && number(b.cargo, 0, 4) && number(b.cargoAge)
    && vector(b.position, 3) && quaternion(b.rotation))) return false;
  if (new Set(v.bodies.map(b => b.id)).size !== v.bodies.length) return false;
  if (!Array.isArray(v.impacts) || v.impacts.length > 6 || !v.impacts.every(e => object(e) && Number.isInteger(e.id) && number(e.id)
    && vector(e.position, 3) && number(e.age, 0, 3) && number(e.color) && typeof e.water === "boolean"
    && Array.isArray(e.particles) && e.particles.length <= 28 && e.particles.every(p => object(p) && vector(p.position, 3) && number(p.size, 0, 2)))) return false;
  return Array.isArray(v.parcels) && v.parcels.length <= 64 && v.parcels.every(p => object(p) && vector(p.position, 3) && quaternion(p.rotation))
    && Array.isArray(v.links) && v.links.length <= 10 && v.links.every(l => object(l) && vector(l.start, 3) && vector(l.end, 3) && number(l.stress, 0, 10));
}
export function validResult(v: unknown): v is RaceResult {
  return object(v) && number(v.distance) && Number.isSafeInteger(v.correct) && number(v.correct)
    && number(v.score) && typeof v.water === "boolean";
}
/** Treat the data channel as input, never as trusted HTML or simulation commands. */
export function parseWire(value: unknown): Wire | undefined {
  if (!object(value)) return;
  const v = value;
  if (["ready", "go", "state", "finish", "pause", "rematch"].includes(String(v.kind)) && !text(v.round, 64)) return;
  switch (v.kind) {
    case "hello": if (Number.isInteger(v.version) && text(v.name, 80) && isDifficulty(v.difficulty)) return v as Wire; break;
    case "lobby": if (text(v.name, 80) && tables(v.tables) && isDifficulty(v.difficulty)) return { kind: "lobby", name: cleanName(v.name), tables: normalizeTables(v.tables), difficulty: v.difficulty }; break;
    case "prepare": if (object(v.round) && text(v.round.id, 64) && Number.isInteger(v.round.seed) && number(v.round.seed, 0, 0xffffffff)
      && Number.isInteger(v.round.questionSeed) && number(v.round.questionSeed, 0, 0xffffffff) && tables(v.round.tables) && isDifficulty(v.round.difficulty) && isDifficulty(v.round.guestDifficulty)) return v as Wire; break;
    case "ready": case "rematch": case "leave": return v as Wire;
    case "go": if (number(v.delay, 0, 5000)) return v as Wire; break;
    case "state": if (validRideState(v.state)) return v as Wire; break;
    case "finish": if (validResult(v.result)) return v as Wire; break;
    case "pause": if (typeof v.paused === "boolean") return v as Wire; break;
    case "ping": case "pong": if (number(v.at, 0, 1e16)) return v as Wire; break;
    case "error": if (text(v.message, 200)) return v as Wire; break;
  }
}
export function raceWinner(a: RaceResult, b: RaceResult): "local" | "remote" | "draw" {
  const difference = Math.round(a.distance * 10) - Math.round(b.distance * 10);
  return difference === 0 ? "draw" : difference > 0 ? "local" : "remote";
}
