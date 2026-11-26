import * as THREE from 'three';
import { ARENA_RADIUS, MAX_CHAIN_REACH, WEAPON_COMBAT_HEIGHT } from './constants';
import { FighterCommandTarget } from './fighterInterface';
import { AIDifficulty } from './types';

const _toOpp = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _pt = new THREE.Vector3();

/**
 * Tactical AI controller obeying the EXACT same physics, trajectory drawing,
 * and weapon-first-then-fighter state machine as human players.
 */
export class AIController {
  private readonly self: FighterCommandTarget;
  private readonly opponent: FighterCommandTarget;
  private difficulty: AIDifficulty = 'normal';

  private thinkTimer = 0.4;
  private plannedPoints: THREE.Vector3[] = [];
  private drawStepIndex = 0;
  private drawStepTimer = 0;
  private guardTimer = 0;

  constructor(self: FighterCommandTarget, opponent: FighterCommandTarget) {
    this.self = self;
    this.opponent = opponent;
  }

  public setDifficulty(diff: AIDifficulty): void {
    this.difficulty = diff;
  }

  public reset(): void {
    this.thinkTimer = 0.35;
    this.plannedPoints = [];
    this.drawStepIndex = 0;
    this.drawStepTimer = 0;
    this.guardTimer = 0;
    this.self.setGuardHeld(false);
  }

  public update(dt: number): void {
    // Handle active defensive guard hold duration
    if (this.guardTimer > 0) {
      this.guardTimer -= dt;
      this.self.setGuardHeld(this.guardTimer > 0);
      if (this.guardTimer > 0) return;
    } else {
      this.self.setGuardHeld(false);
    }

    // If AI is currently drawing a planned trajectory point by point (realistic draw pacing)
    if (this.self.phase === 'DRAWING') {
      this.drawStepTimer -= dt;
      if (this.drawStepTimer <= 0) {
        if (this.drawStepIndex < this.plannedPoints.length) {
          this.self.addDrawingPoint(this.plannedPoints[this.drawStepIndex]);
          this.drawStepIndex++;
          this.drawStepTimer = this.difficulty === 'hard' ? 0.025 : this.difficulty === 'normal' ? 0.04 : 0.06;
        } else {
          this.self.commitDrawing();
          this.plannedPoints = [];
          this.thinkTimer = this.getReactionDelay();
        }
      }
      return;
    }

    // Wait while weapon travels, fighter follows, or recovering
    if (!this.self.canStartDrawing()) {
      return;
    }

    // Threat assessment: check if opponent's weapon is flying toward AI!
    const incomingThreat = this.assessIncomingThreat();
    if (incomingThreat) {
      const dodgeChance = this.difficulty === 'hard' ? 0.55 : this.difficulty === 'normal' ? 0.3 : 0.08;
      const guardChance = this.difficulty === 'hard' ? 0.88 : this.difficulty === 'normal' ? 0.62 : 0.2;

      if (Math.random() < dodgeChance && this.self.stamina >= 35) {
        _toOpp.subVectors(this.opponent.position, this.self.position).setY(0).normalize();
        _perp.set(-_toOpp.z, 0, _toOpp.x).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
        if (this.self.triggerDodge(_perp)) {
          this.thinkTimer = 0.25;
          return;
        }
      }

      if (Math.random() < guardChance && this.self.stamina >= 20) {
        this.guardTimer = this.difficulty === 'hard' ? 0.34 : 0.48;
        this.self.setGuardHeld(true);
        return;
      }
    }

    // Cooldown between tactical decisions
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;

    // Choose and plan a combat trajectory
    this.planNextTrajectory();
  }

  private getReactionDelay(): number {
    if (this.difficulty === 'easy') return 0.75 + Math.random() * 0.55;
    if (this.difficulty === 'normal') return 0.35 + Math.random() * 0.32;
    return 0.14 + Math.random() * 0.16;
  }

  private assessIncomingThreat(): boolean {
    if (this.opponent.phase !== 'WEAPON_TRAVEL') return false;
    const distToWeapon = this.self.position.distanceTo(this.opponent.weaponPosition);
    return distToWeapon < 3.4;
  }

  private clampToArena(p: THREE.Vector3): THREE.Vector3 {
    const dx = p.x - this.self.position.x;
    const dz = p.z - this.self.position.z;
    const reach = Math.hypot(dx, dz);
    if (reach > MAX_CHAIN_REACH - 0.3) {
      const s = (MAX_CHAIN_REACH - 0.3) / reach;
      p.x = this.self.position.x + dx * s;
      p.z = this.self.position.z + dz * s;
    }

    const r = Math.hypot(p.x, p.z);
    if (r > ARENA_RADIUS - 0.8) {
      p.x *= (ARENA_RADIUS - 0.8) / r;
      p.z *= (ARENA_RADIUS - 0.8) / r;
    }
    p.y = WEAPON_COMBAT_HEIGHT;
    return p;
  }

  private planNextTrajectory(): void {
    const selfPos = this.self.position;
    const oppPos = this.opponent.position;
    _toOpp.subVectors(oppPos, selfPos).setY(0);
    const dist = Math.max(0.01, _toOpp.length());
    _toOpp.divideScalar(dist);
    _perp.set(-_toOpp.z, 0, _toOpp.x);

    const selfEdgeDist = Math.hypot(selfPos.x, selfPos.z);
    const points: THREE.Vector3[] = [];
    const side = Math.random() < 0.5 ? 1 : -1;

    // 1. Retreat / Reposition if cornered near edge or low stamina
    if (selfEdgeDist > ARENA_RADIUS - 2.3 || (this.self.hp < 35 && dist < 3.0 && Math.random() < 0.5)) {
      const toCenter = new THREE.Vector3(-selfPos.x, 0, -selfPos.z).normalize();
      const sweep = toCenter.clone().addScaledVector(_perp, side * 0.65).normalize();
      for (let i = 1; i <= 5; i++) {
        const pt = selfPos
          .clone()
          .addScaledVector(sweep, i * 1.15)
          .addScaledVector(_toOpp, i === 2 ? 0.7 : 0);
        points.push(this.clampToArena(pt));
      }
    }
    // 2. Hard AI exploits opponent recovery or weapon travel with feints & wrap-around loops
    else if (
      this.difficulty === 'hard' &&
      (this.opponent.phase === 'RECOVER' || this.opponent.phase === 'GUARD' || Math.random() < 0.45)
    ) {
      // Feint out to the side, loop behind/through opponent, then exit to safe flank
      const reach = Math.min(MAX_CHAIN_REACH - 0.6, dist + 1.8);
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const arcOut = Math.sin(t * Math.PI) * 2.6 * side;
        const forward = t <= 0.65 ? (t / 0.65) * reach : reach - ((t - 0.65) / 0.35) * 2.2;
        const pt = selfPos
          .clone()
          .addScaledVector(_toOpp, forward)
          .addScaledVector(_perp, arcOut);
        points.push(this.clampToArena(pt));
      }
    }
    // 3. Close range: direct thrust or tight circular slash
    else if (dist < 4.2) {
      if (this.difficulty === 'easy' || Math.random() < 0.42) {
        // Direct strike through opponent
        const strikeLen = Math.min(MAX_CHAIN_REACH - 0.8, dist + 1.6);
        for (let i = 1; i <= 4; i++) {
          const pt = selfPos
            .clone()
            .addScaledVector(_toOpp, (i / 4) * strikeLen)
            .addScaledVector(_perp, (this.difficulty === 'easy' ? 0.5 : 0.15) * side);
          points.push(this.clampToArena(pt));
        }
      } else {
        // Circular sweeping arc around opponent
        const steps = 7;
        for (let i = 1; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 1.15 * side;
          const r = Math.min(dist * 0.95, 3.2);
          const center = oppPos.clone();
          const baseAngle = Math.atan2(selfPos.z - center.z, selfPos.x - center.x);
          const a = baseAngle + angle;
          const pt = new THREE.Vector3(
            center.x + Math.cos(a) * r,
            WEAPON_COMBAT_HEIGHT,
            center.z + Math.sin(a) * r
          );
          points.push(this.clampToArena(pt));
        }
      }
    }
    // 4. Mid/Long range: close the distance with a sweeping chain arc
    else {
      const approachDist = Math.min(MAX_CHAIN_REACH - 0.6, dist * 0.88);
      const steps = 6;
      const curveAmp = this.difficulty === 'easy' ? 0.8 : 2.1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        _pt
          .copy(selfPos)
          .addScaledVector(_toOpp, t * approachDist)
          .addScaledVector(_perp, Math.sin(t * Math.PI) * curveAmp * side);
        points.push(this.clampToArena(_pt.clone()));
      }
    }

    if (points.length >= 2 && this.self.beginDrawing(points[0])) {
      this.plannedPoints = points;
      this.drawStepIndex = 0;
      this.drawStepTimer = 0.03;
    } else {
      this.thinkTimer = 0.25;
    }
  }
}
