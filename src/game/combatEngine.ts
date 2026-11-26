import * as THREE from 'three';
import { AIController } from './aiController';
import { buildArenaAndLighting, ArenaSetup } from './arena';
import { soundEngine } from './audio';
import { CombatCamera } from './camera';
import { ChainSystem } from './chain';
import {
  checkWeaponClash,
  checkWeaponSweepCollision,
  ImpactEffectsSystem,
} from './collision';
import {
  ARENA_RADIUS,
  BASE_RECOVER_DURATION,
  BASE_WEAPON_DAMAGE,
  BASE_WEAPON_SPEED,
  DODGE_COOLDOWN,
  DODGE_DISTANCE,
  DODGE_DURATION,
  DODGE_STAMINA_COST,
  FIGHTER_FOLLOW_SPEED,
  FIGHTER_RADIUS,
  GUARD_STAMINA_DRAIN_PER_SEC,
  MAX_HP,
  MAX_STAMINA,
  P1_ACCENT_HEX,
  P1_COLOR_HEX,
  P2_ACCENT_HEX,
  P2_COLOR_HEX,
  PARRY_WINDOW_DURATION,
  PHASE_LABELS_FR,
  ROUND_DURATION_SECONDS,
  STAMINA_REGEN_PER_SEC,
  WEAPON_ARRIVED_PAUSE,
  WEAPON_COMBAT_HEIGHT,
  ZONE_DAMAGE_MULTIPLIER,
} from './constants';
import { FighterCommandTarget } from './fighterInterface';
import { GamepadManager } from './gamepad';
import { detectSoftwareWebGL } from './materials';
import {
  createFighterRig,
  createWeaponRig,
  FighterRig,
  WeaponRig,
} from './models';
import { PlayerInputController } from './playerController';
import {
  advanceAlongTrajectory,
  appendTrajectoryPoint,
  createTrajectory,
  prepareFighterFollowPath,
  TrajectoryVisualizer,
  validateTrajectory,
} from './trajectory';
import {
  CombatCallout,
  FighterHUDState,
  FighterPhase,
  FighterStats,
  GameConfig,
  HitZone,
  MatchHUDState,
  ScreenState,
  TrajectoryPath,
} from './types';

const _tmpVec = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _handPos = new THREE.Vector3();
const _projVec = new THREE.Vector3();

class FighterActor implements FighterCommandTarget {
  public readonly id: 1 | 2;
  public name: string;
  public readonly accentHex: number;
  public readonly rig: FighterRig;
  public readonly weaponRig: WeaponRig;
  public readonly chain: ChainSystem;
  public readonly trajectoryVis: TrajectoryVisualizer;

  public phase: FighterPhase = 'IDLE';
  public readonly position = new THREE.Vector3();
  public readonly weaponPosition = new THREE.Vector3();
  public readonly prevWeaponPosition = new THREE.Vector3();
  public readonly weaponVelocityDir = new THREE.Vector3(0, 0, 1);
  public yaw = 0;

  public hp = MAX_HP;
  public maxHp = MAX_HP;
  public stamina = MAX_STAMINA;
  public maxStamina = MAX_STAMINA;
  public roundsWon = 0;

  public activeTrajectory: TrajectoryPath | null = null;
  private followPath: TrajectoryPath | null = null;

  private phaseTimer = 0;
  private hitFlash = 0;
  private legSlowTimer = 0;
  private hitCooldown = 0;
  private dodgeCooldownTimer = 0;
  private dodgeDir = new THREE.Vector3();
  private guardHeld = false;
  private guardElapsed = 0;

  public stats: FighterStats = {
    damageDealt: 0,
    headHits: 0,
    hitsLanded: 0,
    parries: 0,
    dodges: 0,
  };

  constructor(
    id: 1 | 2,
    name: string,
    primaryHex: number,
    accentHex: number,
    scene: THREE.Scene
  ) {
    this.id = id;
    this.name = name;
    this.accentHex = accentHex;

    this.rig = createFighterRig(id, primaryHex, accentHex);
    this.weaponRig = createWeaponRig(id, accentHex);
    this.trajectoryVis = new TrajectoryVisualizer(accentHex);

    const startX = id === 1 ? -4.5 : 4.5;
    this.position.set(startX, 0, 0);
    this.yaw = id === 1 ? Math.PI / 2 : -Math.PI / 2;
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    this.rig.getHandWorldPosition(_handPos);
    this.weaponPosition.set(startX + (id === 1 ? 1.1 : -1.1), WEAPON_COMBAT_HEIGHT, 0.35);
    this.prevWeaponPosition.copy(this.weaponPosition);
    this.weaponRig.root.position.copy(this.weaponPosition);

    this.chain = new ChainSystem(accentHex, _handPos, this.weaponPosition);

    scene.add(this.rig.root);
    scene.add(this.weaponRig.root);
    scene.add(this.chain.mesh);
    scene.add(this.trajectoryVis.group);
  }

  public resetForRound(keepRounds = true): void {
    const startX = this.id === 1 ? -4.5 : 4.5;
    this.position.set(startX, 0, 0);
    this.yaw = this.id === 1 ? Math.PI / 2 : -Math.PI / 2;
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    if (!keepRounds) {
      this.roundsWon = 0;
      this.stats = {
        damageDealt: 0,
        headHits: 0,
        hitsLanded: 0,
        parries: 0,
        dodges: 0,
      };
    }

    this.phase = 'IDLE';
    this.activeTrajectory = null;
    this.followPath = null;
    this.phaseTimer = 0;
    this.hitFlash = 0;
    this.legSlowTimer = 0;
    this.hitCooldown = 0;
    this.dodgeCooldownTimer = 0;
    this.guardHeld = false;
    this.guardElapsed = 0;

    this.rig.updateAnimation('IDLE', 0, 1, 0, 0, 0);
    this.rig.getHandWorldPosition(_handPos);
    this.weaponPosition.set(
      startX + (this.id === 1 ? 1.15 : -1.15),
      WEAPON_COMBAT_HEIGHT,
      this.id === 1 ? 0.35 : -0.35
    );
    this.prevWeaponPosition.copy(this.weaponPosition);
    this.weaponRig.root.position.copy(this.weaponPosition);
    this.chain.reset(_handPos, this.weaponPosition);
    this.rig.updateHitboxes();
  }

  public canStartDrawing(): boolean {
    return this.phase === 'IDLE';
  }

  public beginDrawing(worldPoint: THREE.Vector3): boolean {
    if (!this.canStartDrawing()) return false;
    this.phase = 'DRAWING';
    this.guardHeld = false;
    this.activeTrajectory = createTrajectory(this.weaponPosition);
    appendTrajectoryPoint(this.activeTrajectory, worldPoint, this.position);
    return true;
  }

  public addDrawingPoint(worldPoint: THREE.Vector3): boolean {
    if (this.phase !== 'DRAWING' || !this.activeTrajectory) return false;
    const added = appendTrajectoryPoint(this.activeTrajectory, worldPoint, this.position);
    if (added && this.id === 1) {
      soundEngine.playDrawTick(this.activeTrajectory.waypoints.length % 6);
    }
    return added;
  }

  public commitDrawing(): boolean {
    if (this.phase !== 'DRAWING' || !this.activeTrajectory) return false;
    if (!validateTrajectory(this.activeTrajectory)) {
      this.cancelDrawing();
      return false;
    }

    this.phase = 'WEAPON_TRAVEL';
    this.hitCooldown = 0;
    soundEngine.playWeaponLaunch();
    return true;
  }

  public cancelDrawing(): void {
    if (this.phase === 'DRAWING') {
      this.phase = 'IDLE';
      this.activeTrajectory = null;
    }
  }

  public setGuardHeld(held: boolean): void {
    this.guardHeld = held;
    if (held && (this.phase === 'IDLE' || this.phase === 'RECOVER') && this.stamina > 8) {
      this.phase = 'GUARD';
      this.guardElapsed = 0;
    } else if (!held && this.phase === 'GUARD') {
      this.phase = 'IDLE';
      this.guardElapsed = 0;
    }
  }

  public isParryActive(): boolean {
    return this.phase === 'GUARD' && this.guardElapsed <= PARRY_WINDOW_DURATION;
  }

  public isInvulnerable(): boolean {
    return this.phase === 'DODGE' && this.phaseTimer > 0.04;
  }

  public triggerDodge(directionHint?: THREE.Vector3): boolean {
    if (
      this.dodgeCooldownTimer > 0 ||
      this.stamina < DODGE_STAMINA_COST ||
      (this.phase !== 'IDLE' && this.phase !== 'DRAWING' && this.phase !== 'RECOVER' && this.phase !== 'GUARD')
    ) {
      return false;
    }

    this.activeTrajectory = null;
    this.guardHeld = false;
    this.stamina = Math.max(0, this.stamina - DODGE_STAMINA_COST);
    this.dodgeCooldownTimer = DODGE_COOLDOWN;
    this.phase = 'DODGE';
    this.phaseTimer = DODGE_DURATION;
    this.stats.dodges++;

    if (directionHint && directionHint.lengthSq() > 0.01) {
      this.dodgeDir.copy(directionHint).setY(0).normalize();
    } else {
      // Default evade laterally perpendicular to facing yaw
      this.dodgeDir.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    }

    soundEngine.playDodge();
    return true;
  }

  public interruptToHitstun(duration: number): void {
    this.activeTrajectory = null;
    this.followPath = null;
    this.guardHeld = false;
    this.phase = 'HITSTUN';
    this.phaseTimer = duration;
  }

  public deflectWeaponToRecover(): void {
    this.activeTrajectory = null;
    this.followPath = null;
    this.phase = 'RECOVER';
    this.phaseTimer = 0.48;
  }

  public applyDamage(
    rawDamage: number,
    zone: HitZone,
    attacker: FighterActor
  ): { applied: number; blocked: boolean; parried: boolean; dodged: boolean } {
    if (this.phase === 'KO' || this.phase === 'VICTORY') {
      return { applied: 0, blocked: false, parried: false, dodged: false };
    }

    if (this.isInvulnerable()) {
      return { applied: 0, blocked: false, parried: false, dodged: true };
    }

    if (this.isParryActive()) {
      this.stats.parries++;
      this.stamina = Math.min(this.maxStamina, this.stamina + 18);
      attacker.deflectWeaponToRecover();
      return { applied: 0, blocked: true, parried: true, dodged: false };
    }

    let dmg = rawDamage * ZONE_DAMAGE_MULTIPLIER[zone];
    let blocked = false;

    if (this.phase === 'GUARD') {
      blocked = true;
      dmg *= 0.28;
      this.stamina = Math.max(0, this.stamina - 22);
      if (this.stamina <= 0) {
        // Guard break!
        this.interruptToHitstun(0.45);
      }
    } else {
      if (zone === 'HEAD') {
        this.interruptToHitstun(0.32);
      } else if (zone === 'ARMS' && this.phase === 'DRAWING') {
        this.interruptToHitstun(0.2);
      } else if (zone === 'LEGS') {
        this.legSlowTimer = 1.6;
        if (this.phase === 'DRAWING') this.interruptToHitstun(0.18);
      } else if (this.phase === 'IDLE' || this.phase === 'DRAWING') {
        this.interruptToHitstun(0.16);
      }
    }

    const roundedDmg = Math.max(1, Math.round(dmg));
    this.hp = Math.max(0, this.hp - roundedDmg);
    this.hitFlash = 1.0;

    attacker.stats.damageDealt += roundedDmg;
    attacker.stats.hitsLanded++;
    if (zone === 'HEAD' && !blocked) {
      attacker.stats.headHits++;
    }

    if (this.hp <= 0) {
      this.phase = 'KO';
      this.activeTrajectory = null;
      this.followPath = null;
    }

    return { applied: roundedDmg, blocked, parried: false, dodged: false };
  }

  public update(opponent: FighterActor, time: number, dt: number): void {
    this.prevWeaponPosition.copy(this.weaponPosition);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5.5);
    this.legSlowTimer = Math.max(0, this.legSlowTimer - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.dodgeCooldownTimer = Math.max(0, this.dodgeCooldownTimer - dt);

    // Stamina regeneration when not guarding/dodging
    if (this.phase !== 'GUARD' && this.phase !== 'DODGE' && this.phase !== 'KO') {
      this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN_PER_SEC * dt);
    }

    // Face opponent unless currently following a trajectory path
    if (this.phase !== 'FIGHTER_FOLLOW' && this.phase !== 'KO') {
      const targetYaw = Math.atan2(
        opponent.position.x - this.position.x,
        opponent.position.z - this.position.z
      );
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * (1 - Math.exp(-10 * dt));
    }

    let moveSpeedRatio = 0;

    switch (this.phase) {
      case 'IDLE':
      case 'DRAWING': {
        // Fighter stays completely stationary during IDLE and DRAWING
        this.settleWeaponAtReady(dt);
        break;
      }

      case 'GUARD': {
        this.guardElapsed += dt;
        this.stamina = Math.max(0, this.stamina - GUARD_STAMINA_DRAIN_PER_SEC * dt);
        if (!this.guardHeld || this.stamina <= 0) {
          this.phase = 'IDLE';
        }
        this.settleWeaponAtReady(dt);
        break;
      }

      case 'DODGE': {
        this.phaseTimer -= dt;
        const speed = DODGE_DISTANCE / DODGE_DURATION;
        this.position.addScaledVector(this.dodgeDir, speed * dt);
        this.clampPositionToArena();
        this.settleWeaponAtReady(dt);
        if (this.phaseTimer <= 0) {
          this.phase = 'IDLE';
        }
        break;
      }

      case 'WEAPON_TRAVEL': {
        // CRITICAL: Fighter does NOT move during WEAPON_TRAVEL!
        if (!this.activeTrajectory) {
          this.phase = 'IDLE';
          break;
        }
        const step = advanceAlongTrajectory(
          this.activeTrajectory,
          BASE_WEAPON_SPEED,
          dt,
          this.weaponPosition,
          this.weaponVelocityDir
        );
        if (step.finished) {
          this.phase = 'WEAPON_ARRIVED';
          this.phaseTimer = WEAPON_ARRIVED_PAUSE;
        }
        break;
      }

      case 'WEAPON_ARRIVED': {
        // Weapon has finished its trajectory and anchored; fighter prepares to follow
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          if (this.activeTrajectory) {
            this.followPath = prepareFighterFollowPath(this.activeTrajectory, this.position);
            this.phase = 'FIGHTER_FOLLOW';
            soundEngine.playFighterFollow();
          } else {
            this.phase = 'IDLE';
          }
        }
        break;
      }

      case 'FIGHTER_FOLLOW': {
        // NOW the fighter moves along the exact path toward the weapon's final endpoint!
        if (!this.followPath || this.followPath.waypoints.length < 2) {
          this.phase = 'RECOVER';
          this.phaseTimer = BASE_RECOVER_DURATION;
          break;
        }

        const followSpeed =
          FIGHTER_FOLLOW_SPEED * (this.legSlowTimer > 0 ? 0.68 : 1.0);
        const step = advanceAlongTrajectory(
          this.followPath,
          followSpeed,
          dt,
          this.position,
          _tmpDir
        );
        this.clampPositionToArena();
        moveSpeedRatio = 1.0;

        if (_tmpDir.lengthSq() > 0.01) {
          const moveYaw = Math.atan2(_tmpDir.x, _tmpDir.z);
          let diff = moveYaw - this.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.yaw += diff * (1 - Math.exp(-14 * dt));
        }

        // Keep weapon anchored at destination until fighter arrives close, then draw back smoothly
        const lastWp = this.followPath.waypoints[this.followPath.waypoints.length - 1].position;
        if (this.position.distanceTo(lastWp) < 1.2) {
          this.settleWeaponAtReady(dt * 0.65);
        }

        if (step.finished) {
          this.followPath = null;
          this.activeTrajectory = null;
          this.phase = 'RECOVER';
          this.phaseTimer = BASE_RECOVER_DURATION;
        }
        break;
      }

      case 'RECOVER':
      case 'HITSTUN': {
        this.phaseTimer -= dt;
        this.settleWeaponAtReady(dt);
        if (this.phaseTimer <= 0) {
          this.phase = this.guardHeld && this.stamina > 10 ? 'GUARD' : 'IDLE';
          this.guardElapsed = 0;
        }
        break;
      }

      case 'KO':
      case 'VICTORY': {
        this.settleWeaponAtReady(dt * 0.4);
        break;
      }
    }

    // Apply transform & procedural rig animation
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    // Compute torso twist toward weapon direction during WEAPON_TRAVEL
    _tmpDir.subVectors(this.weaponPosition, this.position);
    const weaponYaw = Math.atan2(_tmpDir.x, _tmpDir.z);
    let aimOffset = weaponYaw - this.yaw;
    while (aimOffset > Math.PI) aimOffset -= Math.PI * 2;
    while (aimOffset < -Math.PI) aimOffset += Math.PI * 2;

    this.rig.updateAnimation(
      this.phase,
      time,
      dt,
      moveSpeedRatio,
      aimOffset,
      this.hitFlash
    );
    this.rig.updateHitboxes();
    this.rig.getHandWorldPosition(_handPos);

    // Update Weapon mesh & Chain simulation
    this.weaponRig.root.position.copy(this.weaponPosition);
    this.weaponRig.updateVisuals(
      this.weaponVelocityDir,
      this.phase === 'WEAPON_TRAVEL',
      dt
    );

    this.chain.update(
      _handPos,
      this.weaponPosition,
      this.position,
      dt,
      this.phase === 'WEAPON_TRAVEL'
    );

    // Update Trajectory 3D visualizer
    const isDrawing = this.phase === 'DRAWING';
    const isActiveExecution =
      this.phase === 'WEAPON_TRAVEL' ||
      this.phase === 'WEAPON_ARRIVED' ||
      this.phase === 'FIGHTER_FOLLOW';
    this.trajectoryVis.update(
      this.activeTrajectory,
      this.position,
      isDrawing,
      isActiveExecution,
      time,
      dt
    );
  }

  public canDealHit(): boolean {
    return this.phase === 'WEAPON_TRAVEL' && this.hitCooldown <= 0;
  }

  public registerHitDealt(): void {
    this.hitCooldown = 0.24;
  }

  private settleWeaponAtReady(dt: number): void {
    // Ready guard float position slightly right-forward of fighter
    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    _tmpVec.set(
      this.position.x + forwardX * 0.95 + rightX * 0.65,
      WEAPON_COMBAT_HEIGHT,
      this.position.z + forwardZ * 0.95 + rightZ * 0.65
    );

    const alpha = 1 - Math.exp(-11 * dt);
    this.weaponPosition.lerp(_tmpVec, alpha);
    this.weaponVelocityDir.set(forwardX, 0, forwardZ);
  }

  private clampPositionToArena(): void {
    const r = Math.hypot(this.position.x, this.position.z);
    const maxR = ARENA_RADIUS - FIGHTER_RADIUS;
    if (r > maxR) {
      this.position.x *= maxR / r;
      this.position.z *= maxR / r;
    }
    this.position.y = 0;
  }

  public toHUDState(): FighterHUDState {
    const visited = this.activeTrajectory
      ? this.activeTrajectory.currentSegmentIndex
      : 0;
    const totalWps = this.activeTrajectory
      ? this.activeTrajectory.waypoints.length
      : 0;

    return {
      id: this.id,
      name: this.name,
      hp: this.hp,
      maxHp: this.maxHp,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      roundsWon: this.roundsWon,
      phase: this.phase,
      phaseLabel: PHASE_LABELS_FR[this.phase] || this.phase,
      waypointCount: totalWps,
      visitedWaypoints: visited,
      chainTension: this.chain.tension,
      isGuarding: this.phase === 'GUARD',
      parryWindowActive: this.isParryActive(),
      stats: { ...this.stats },
    };
  }

  public dispose(): void {
    this.rig.dispose();
    this.weaponRig.dispose();
    this.chain.dispose();
    this.trajectoryVis.dispose();
  }
}

export class CombatEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly combatCamera: CombatCamera;
  private readonly arena: ArenaSetup;
  private readonly impacts: ImpactEffectsSystem;
  private readonly isSoftwareGl: boolean;

  private readonly p1: FighterActor;
  private readonly p2: FighterActor;
  public readonly gamepadManager: GamepadManager;
  private readonly playerController: PlayerInputController;
  private readonly aiController: AIController;

  private screen: ScreenState = 'menu';
  private config: GameConfig = {
    mode: 'ai',
    difficulty: 'normal',
    roundsToWin: 2,
  };
  private currentRound = 1;
  private roundTimeRemaining = ROUND_DURATION_SECONDS;
  private bannerText: string | null = null;
  private bannerSubtext: string | null = null;
  private bannerTimer = 0;
  private roundEndTimer = 0;
  private winnerId: 1 | 2 | null = null;
  private roundWinnerId: 1 | 2 | null = null;

  private readonly callouts: CombatCallout[] = [];
  private nextCalloutId = 1;

  private frameId = 0;
  private lastTimestamp = 0;
  private elapsedTime = 0;
  private hudSyncAccumulator = 0;
  private disposed = false;

  private readonly onHUDUpdate: (state: MatchHUDState) => void;
  private readonly onContextLostCallback?: () => void;

  constructor(
    container: HTMLElement,
    gamepadManager: GamepadManager,
    onHUDUpdate: (state: MatchHUDState) => void,
    onContextLost?: () => void
  ) {
    this.container = container;
    this.gamepadManager = gamepadManager;
    this.onHUDUpdate = onHUDUpdate;
    this.onContextLostCallback = onContextLost;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLostCallback?.();
    });

    this.scene = new THREE.Scene();
    this.combatCamera = new CombatCamera(width / Math.max(1, height));
    this.arena = buildArenaAndLighting(this.scene, this.renderer, this.isSoftwareGl);

    this.impacts = new ImpactEffectsSystem();
    this.scene.add(this.impacts.group);

    this.p1 = new FighterActor(1, 'Kuro · J1', P1_COLOR_HEX, P1_ACCENT_HEX, this.scene);
    this.p2 = new FighterActor(2, 'Valkor · IA', P2_COLOR_HEX, P2_ACCENT_HEX, this.scene);

    this.playerController = new PlayerInputController(
      this.renderer.domElement,
      this.combatCamera.camera,
      this.p1,
      this.p2,
      this.gamepadManager,
      () => this.togglePause()
    );
    this.scene.add(this.playerController.p1CursorMesh);
    this.scene.add(this.playerController.p2CursorMesh);

    this.aiController = new AIController(this.p2, this.p1);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.combatCamera.camera);
    }

    window.addEventListener('resize', this.handleResize);

    this.emitHUD();
    this.lastTimestamp = performance.now();
    this.startLoop();
  }

  public startMatch(config: GameConfig): void {
    this.config = { ...config };
    this.p2.name = config.mode === 'ai' ? `Valkor · IA` : 'Valkor · J2';
    this.aiController.setDifficulty(config.difficulty);

    this.currentRound = 1;
    this.winnerId = null;
    this.roundWinnerId = null;
    this.callouts.length = 0;

    this.p1.resetForRound(false);
    this.p2.resetForRound(false);
    this.playerController.resetCursors();
    this.aiController.reset();

    this.beginRound();
  }

  private beginRound(): void {
    this.p1.resetForRound(true);
    this.p2.resetForRound(true);
    this.playerController.resetCursors();
    this.aiController.reset();

    this.roundTimeRemaining = ROUND_DURATION_SECONDS;
    this.roundWinnerId = null;
    this.screen = 'playing';
    this.bannerText = `MANCHE ${this.currentRound}`;
    this.bannerSubtext = 'Tracez la trajectoire de votre arme !';
    this.bannerTimer = 1.6;

    this.playerController.setMode(this.config.mode === 'local2p', true, true);
    soundEngine.playRoundGong(false);
    this.emitHUD();
  }

  public togglePause(): void {
    if (this.screen === 'playing') {
      this.screen = 'paused';
      this.playerController.setMode(this.config.mode === 'local2p', false, true);
      this.emitHUD();
    } else if (this.screen === 'paused') {
      this.screen = 'playing';
      this.playerController.setMode(this.config.mode === 'local2p', true, true);
      this.emitHUD();
    }
  }

  public returnToMenu(): void {
    this.screen = 'menu';
    this.bannerText = null;
    this.bannerSubtext = null;
    this.playerController.setMode(false, false, false);
    this.p1.resetForRound(false);
    this.p2.resetForRound(false);
    this.callouts.length = 0;
    this.emitHUD();
  }

  public restartMatch(): void {
    this.startMatch(this.config);
  }

  private readonly handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.combatCamera.resize(width / Math.max(1, height));
    this.renderer.setSize(width, height);
  };

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.step(dt);
      this.renderer.render(this.scene, this.combatCamera.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = requestAnimationFrame(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private step(dt: number): void {
    this.elapsedTime += dt;

    if (this.screen === 'menu') {
      // Keep gamepads auto-detected on menu entry
      this.gamepadManager.pollFrames();
      // Idle animated showcase in menu background
      this.p1.update(this.p2, this.elapsedTime, dt);
      this.p2.update(this.p1, this.elapsedTime, dt);
      this.impacts.update(dt);
      this.combatCamera.update(
        this.p1.position,
        this.p2.position,
        this.p1.weaponPosition,
        this.p2.weaponPosition,
        true,
        this.elapsedTime,
        dt
      );
      return;
    }

    if (this.screen === 'paused') {
      this.playerController.pollPauseOnly();
      return;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.screen === 'playing') {
        this.bannerText = null;
        this.bannerSubtext = null;
      }
    }

    if (this.screen === 'playing') {
      this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - dt);

      this.playerController.update(dt, this.elapsedTime);
      if (this.config.mode === 'ai') {
        this.aiController.update(dt);
      }

      this.p1.update(this.p2, this.elapsedTime, dt);
      this.p2.update(this.p1, this.elapsedTime, dt);

      this.resolveFighterBodySeparation();
      this.resolveWeaponCollisions();
      this.checkRoundOutcome();
    } else if (this.screen === 'round_end') {
      this.p1.update(this.p2, this.elapsedTime, dt);
      this.p2.update(this.p1, this.elapsedTime, dt);
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        this.currentRound++;
        this.beginRound();
      }
    } else if (this.screen === 'match_end') {
      this.p1.update(this.p2, this.elapsedTime, dt);
      this.p2.update(this.p1, this.elapsedTime, dt);
    }

    this.impacts.update(dt);
    this.updateCallouts(dt);

    this.combatCamera.update(
      this.p1.position,
      this.p2.position,
      this.p1.weaponPosition,
      this.p2.weaponPosition,
      false,
      this.elapsedTime,
      dt
    );

    this.hudSyncAccumulator += dt;
    if (this.hudSyncAccumulator >= 0.04) {
      this.hudSyncAccumulator = 0;
      this.emitHUD();
    }
  }

  private resolveFighterBodySeparation(): void {
    const dx = this.p2.position.x - this.p1.position.x;
    const dz = this.p2.position.z - this.p1.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = FIGHTER_RADIUS * 2.05;
    if (dist < minDist) {
      const nx = dist > 0.001 ? dx / dist : 1;
      const nz = dist > 0.001 ? dz / dist : 0;
      const overlap = (minDist - dist) * 0.5;
      this.p1.position.x -= nx * overlap;
      this.p1.position.z -= nz * overlap;
      this.p2.position.x += nx * overlap;
      this.p2.position.z += nz * overlap;
    }
  }

  private resolveWeaponCollisions(): void {
    // 1. Check mid-air Weapon vs Weapon clash
    if (this.p1.phase === 'WEAPON_TRAVEL' && this.p2.phase === 'WEAPON_TRAVEL') {
      const clashPt = checkWeaponClash(
        this.p1.prevWeaponPosition,
        this.p1.weaponPosition,
        this.p2.prevWeaponPosition,
        this.p2.weaponPosition
      );
      if (clashPt && this.p1.canDealHit() && this.p2.canDealHit()) {
        this.p1.registerHitDealt();
        this.p2.registerHitDealt();
        this.p1.deflectWeaponToRecover();
        this.p2.deflectWeaponToRecover();
        this.impacts.spawnImpact(clashPt, 0xfef08a, 24, 1.3);
        this.combatCamera.addShake(0.45);
        soundEngine.playClash();
        this.gamepadManager.rumble(1, 0.55, 0.7, 160);
        this.gamepadManager.rumble(2, 0.55, 0.7, 160);
        this.spawnCallout('CHOC D’ARMES !', 'Déviation mutuelle', '#fef08a', clashPt);
        return;
      }
    }

    // 2. Player 1 weapon vs Player 2 hitboxes
    if (this.p1.canDealHit()) {
      const hit = checkWeaponSweepCollision(
        this.p1.prevWeaponPosition,
        this.p1.weaponPosition,
        0.34,
        this.p2.rig.hitboxes
      );
      if (hit) {
        this.p1.registerHitDealt();
        this.handleHitResolution(this.p1, this.p2, hit.zone, hit.point);
      }
    }

    // 3. Player 2 weapon vs Player 1 hitboxes
    if (this.p2.canDealHit()) {
      const hit = checkWeaponSweepCollision(
        this.p2.prevWeaponPosition,
        this.p2.weaponPosition,
        0.34,
        this.p1.rig.hitboxes
      );
      if (hit) {
        this.p2.registerHitDealt();
        this.handleHitResolution(this.p2, this.p1, hit.zone, hit.point);
      }
    }
  }

  private handleHitResolution(
    attacker: FighterActor,
    defender: FighterActor,
    zone: HitZone,
    point: THREE.Vector3
  ): void {
    const res = defender.applyDamage(BASE_WEAPON_DAMAGE, zone, attacker);

    if (res.dodged) {
      this.spawnCallout('ESQUIVE', undefined, '#38bdf8', point);
      return;
    }

    if (res.parried) {
      this.impacts.spawnImpact(point, 0xfacc15, 22, 1.25);
      this.combatCamera.addShake(0.42);
      soundEngine.playParry();
      this.gamepadManager.rumble(defender.id, 0.65, 0.85, 180);
      this.gamepadManager.rumble(attacker.id, 0.4, 0.5, 130);
      this.spawnCallout('PARADE !', 'Arme repoussée', '#facc15', point);
      return;
    }

    if (res.blocked) {
      this.impacts.spawnImpact(point, 0x94a3b8, 12, 0.85);
      this.combatCamera.addShake(0.2);
      soundEngine.playHit(false, true);
      this.gamepadManager.rumble(defender.id, 0.35, 0.25, 110);
      this.spawnCallout(`BLOQUÉ -${res.applied}`, this.translateZone(zone), '#cbd5e1', point);
      return;
    }

    const isCrit = zone === 'HEAD';
    this.impacts.spawnImpact(point, attacker.accentHex, isCrit ? 24 : 16, isCrit ? 1.3 : 1.0);
    this.combatCamera.addShake(isCrit ? 0.55 : 0.32);
    soundEngine.playHit(isCrit, false);
    this.gamepadManager.rumble(defender.id, isCrit ? 0.9 : 0.55, isCrit ? 0.8 : 0.4, isCrit ? 240 : 150);
    this.gamepadManager.rumble(attacker.id, isCrit ? 0.45 : 0.25, 0.35, 110);

    this.spawnCallout(
      `-${res.applied}`,
      isCrit ? 'CRITIQUE · TÊTE' : this.translateZone(zone),
      isCrit ? '#f43f5e' : '#ffffff',
      point
    );
  }

  private translateZone(zone: HitZone): string {
    switch (zone) {
      case 'HEAD':
        return 'TÊTE';
      case 'TORSO':
        return 'TORSE';
      case 'ARMS':
        return 'BRAS';
      case 'LEGS':
        return 'JAMBES';
    }
  }

  private spawnCallout(
    text: string,
    subtext: string | undefined,
    color: string,
    worldPos: THREE.Vector3
  ): void {
    this.callouts.push({
      id: this.nextCalloutId++,
      text,
      subtext,
      color,
      worldX: worldPos.x,
      worldY: worldPos.y + 0.55,
      worldZ: worldPos.z,
      screenX: 50,
      screenY: 50,
      createdAt: this.elapsedTime,
      duration: 0.95,
    });
    if (this.callouts.length > 8) {
      this.callouts.shift();
    }
  }

  private updateCallouts(dt: number): void {
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      const age = this.elapsedTime - c.createdAt;
      if (age >= c.duration) {
        this.callouts.splice(i, 1);
        continue;
      }
      c.worldY += dt * 0.9;
      _projVec.set(c.worldX, c.worldY, c.worldZ).project(this.combatCamera.camera);
      c.screenX = ((_projVec.x + 1) * 0.5) * 100;
      c.screenY = ((-_projVec.y + 1) * 0.5) * 100;
    }
  }

  private checkRoundOutcome(): void {
    let roundWinner: 1 | 2 | null = null;
    let reason = 'K.O.';

    if (this.p1.hp <= 0 && this.p2.hp <= 0) {
      roundWinner = this.p1.stats.damageDealt >= this.p2.stats.damageDealt ? 1 : 2;
      reason = 'DOUBLE K.O.';
    } else if (this.p2.hp <= 0) {
      roundWinner = 1;
    } else if (this.p1.hp <= 0) {
      roundWinner = 2;
    } else if (this.roundTimeRemaining <= 0) {
      roundWinner = this.p1.hp >= this.p2.hp ? 1 : 2;
      reason = 'TEMPS ÉCOULÉ';
    }

    if (roundWinner === null) return;

    this.playerController.setMode(this.config.mode === 'local2p', false);
    this.roundWinnerId = roundWinner;
    if (roundWinner === 1) {
      this.p1.roundsWon++;
      this.p1.phase = 'VICTORY';
    } else {
      this.p2.roundsWon++;
      this.p2.phase = 'VICTORY';
    }

    soundEngine.playRoundGong(true);
    const winnerName = roundWinner === 1 ? this.p1.name : this.p2.name;

    if (
      this.p1.roundsWon >= this.config.roundsToWin ||
      this.p2.roundsWon >= this.config.roundsToWin
    ) {
      this.winnerId = roundWinner;
      this.screen = 'match_end';
      this.bannerText = `${winnerName} REMPORTE LE DUEL`;
      this.bannerSubtext = reason;
    } else {
      this.screen = 'round_end';
      this.roundEndTimer = 2.6;
      this.bannerText = `${reason} — ${winnerName}`;
      this.bannerSubtext = `Manche suivante...`;
    }

    this.emitHUD();
  }

  private emitHUD(): void {
    this.onHUDUpdate({
      screen: this.screen,
      mode: this.config.mode,
      difficulty: this.config.difficulty,
      roundsToWin: this.config.roundsToWin,
      currentRound: this.currentRound,
      roundTimeRemaining: Math.ceil(this.roundTimeRemaining),
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      winnerId: this.winnerId,
      roundWinnerId: this.roundWinnerId,
      p1: this.p1.toHUDState(),
      p2: this.p2.toHUDState(),
      callouts: this.callouts.map((c) => ({ ...c })),
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);

    this.playerController.dispose();
    this.p1.dispose();
    this.p2.dispose();
    this.impacts.dispose();
    this.arena.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
