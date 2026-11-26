import * as THREE from 'three';

export type GameMode = 'ai' | 'local2p';
export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type ScreenState = 'menu' | 'playing' | 'paused' | 'round_end' | 'match_end';

/**
 * Strict 5+ phase state machine enforcing:
 * IDLE -> DRAWING -> WEAPON_TRAVEL -> WEAPON_ARRIVED -> FIGHTER_FOLLOW -> RECOVER -> IDLE
 */
export type FighterPhase =
  | 'IDLE'
  | 'DRAWING'
  | 'WEAPON_TRAVEL'
  | 'WEAPON_ARRIVED'
  | 'FIGHTER_FOLLOW'
  | 'RECOVER'
  | 'GUARD'
  | 'DODGE'
  | 'HITSTUN'
  | 'KO'
  | 'VICTORY';

export type HitZone = 'HEAD' | 'TORSO' | 'ARMS' | 'LEGS';

export interface TrajectoryWaypoint {
  position: THREE.Vector3;
  isKeyTurn: boolean;
  cumulativeDistance: number;
}

export interface TrajectoryPath {
  waypoints: TrajectoryWaypoint[];
  totalLength: number;
  validated: boolean;
  currentSegmentIndex: number;
  segmentProgress: number; // 0..1 within current segment
  distanceTraveled: number;
}

export interface HitboxZone {
  zone: HitZone;
  center: THREE.Vector3;
  radius: number;
}

export interface CombatCallout {
  id: number;
  text: string;
  subtext?: string;
  color: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  screenX: number;
  screenY: number;
  createdAt: number;
  duration: number;
}

export interface FighterStats {
  damageDealt: number;
  headHits: number;
  hitsLanded: number;
  parries: number;
  dodges: number;
}

export interface FighterHUDState {
  id: 1 | 2;
  name: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  roundsWon: number;
  phase: FighterPhase;
  phaseLabel: string;
  waypointCount: number;
  visitedWaypoints: number;
  chainTension: number; // 0..1
  isGuarding: boolean;
  parryWindowActive: boolean;
  stats: FighterStats;
}

export interface MatchHUDState {
  screen: ScreenState;
  mode: GameMode;
  difficulty: AIDifficulty;
  roundsToWin: number;
  currentRound: number;
  roundTimeRemaining: number;
  bannerText: string | null;
  bannerSubtext: string | null;
  winnerId: 1 | 2 | null;
  roundWinnerId: 1 | 2 | null;
  p1: FighterHUDState;
  p2: FighterHUDState;
  callouts: CombatCallout[];
}

export interface GameConfig {
  mode: GameMode;
  difficulty: AIDifficulty;
  roundsToWin: number;
}
