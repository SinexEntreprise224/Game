import * as THREE from 'three';
import { FighterPhase, TrajectoryPath } from './types';

export interface FighterCommandTarget {
  readonly id: 1 | 2;
  readonly phase: FighterPhase;
  readonly position: THREE.Vector3;
  readonly weaponPosition: THREE.Vector3;
  readonly stamina: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly activeTrajectory: TrajectoryPath | null;

  canStartDrawing(): boolean;
  beginDrawing(worldPoint: THREE.Vector3): boolean;
  addDrawingPoint(worldPoint: THREE.Vector3): boolean;
  commitDrawing(): boolean;
  cancelDrawing(): void;

  setGuardHeld(held: boolean): void;
  triggerDodge(directionHint?: THREE.Vector3): boolean;
}
