import * as THREE from 'three';
import { ARENA_RADIUS, MAX_CHAIN_REACH, WEAPON_COMBAT_HEIGHT } from './constants';
import { FighterCommandTarget } from './fighterInterface';
import { GamepadManager } from './gamepad';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _combatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WEAPON_COMBAT_HEIGHT);
const _hitPoint = new THREE.Vector3();
const _dodgeDir = new THREE.Vector3();

function createCursorReticle(ringColor: number, orbColor: number): THREE.Group {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 24),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -WEAPON_COMBAT_HEIGHT + 0.05;
  group.add(ring);

  const orb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshBasicMaterial({
      color: orbColor,
      transparent: true,
      opacity: 0.95,
    })
  );
  group.add(orb);
  group.visible = false;
  return group;
}

function clampCursorToFighterReach(
  cursorPos: THREE.Vector3,
  fighterPos: THREE.Vector3
): void {
  const dx = cursorPos.x - fighterPos.x;
  const dz = cursorPos.z - fighterPos.z;
  const reachDist = Math.hypot(dx, dz);
  if (reachDist > MAX_CHAIN_REACH) {
    cursorPos.x = fighterPos.x + (dx / reachDist) * MAX_CHAIN_REACH;
    cursorPos.z = fighterPos.z + (dz / reachDist) * MAX_CHAIN_REACH;
  }

  const arenaDist = Math.hypot(cursorPos.x, cursorPos.z);
  const maxArena = ARENA_RADIUS - 0.5;
  if (arenaDist > maxArena) {
    cursorPos.x *= maxArena / arenaDist;
    cursorPos.z *= maxArena / arenaDist;
  }
  cursorPos.y = WEAPON_COMBAT_HEIGHT;
}

/**
 * Handles Player 1 (Mouse/Keyboard + optional Xbox/compatible Gamepad)
 * and Player 2 (Keyboard 3D aiming cursor + Xbox/compatible Gamepad)
 * simultaneously on a single computer.
 */
export class PlayerInputController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.Camera;
  private readonly p1: FighterCommandTarget;
  private readonly p2: FighterCommandTarget;
  private readonly gamepadManager: GamepadManager;
  private readonly onPauseToggle?: () => void;

  private isLocal2P = false;
  private isActive = false;
  private allowGamepadPause = false;

  // P1 drawing states (Mouse or Gamepad)
  private p1MouseDrawing = false;
  private p1PadDrawing = false;
  public readonly p1CursorPos = new THREE.Vector3(-2.3, WEAPON_COMBAT_HEIGHT, 0);
  public readonly p1CursorMesh: THREE.Group;

  // P2 drawing states (Keyboard or Gamepad)
  public readonly p2CursorPos = new THREE.Vector3(2.3, WEAPON_COMBAT_HEIGHT, 0);
  private p2KeyDrawing = false;
  private p2PadDrawing = false;
  public readonly p2CursorMesh: THREE.Group;

  private readonly keys = new Set<string>();

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    p1: FighterCommandTarget,
    p2: FighterCommandTarget,
    gamepadManager: GamepadManager,
    onPauseToggle?: () => void
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.p1 = p1;
    this.p2 = p2;
    this.gamepadManager = gamepadManager;
    this.onPauseToggle = onPauseToggle;

    this.p1CursorMesh = createCursorReticle(0x06b6d4, 0x67e8f9);
    this.p2CursorMesh = createCursorReticle(0xf97316, 0xfef08a);

    this.bindEvents();
  }

  public setMode(isLocal2P: boolean, isActive: boolean, allowPause = false): void {
    this.isLocal2P = isLocal2P;
    this.isActive = isActive;
    this.allowGamepadPause = allowPause;

    if (!isActive) {
      this.p1MouseDrawing = false;
      this.p1PadDrawing = false;
      this.p2KeyDrawing = false;
      this.p2PadDrawing = false;
      this.keys.clear();
      this.p1.setGuardHeld(false);
      this.p2.setGuardHeld(false);
      this.p1CursorMesh.visible = false;
      this.p2CursorMesh.visible = false;
    }
  }

  public resetCursors(): void {
    this.p1MouseDrawing = false;
    this.p1PadDrawing = false;
    this.p2KeyDrawing = false;
    this.p2PadDrawing = false;

    this.p1CursorPos.set(
      this.p1.position.x + 2.2,
      WEAPON_COMBAT_HEIGHT,
      this.p1.position.z
    );
    this.p2CursorPos.set(
      this.p2.position.x - 2.2,
      WEAPON_COMBAT_HEIGHT,
      this.p2.position.z
    );
  }

  private screenToCombatPlane(clientX: number, clientY: number, out: THREE.Vector3): boolean {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_ndc, this.camera);
    const hit = _raycaster.ray.intersectPlane(_combatPlane, out);
    return hit !== null;
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    if (!this.isActive) return;

    const resolved = this.gamepadManager.resolveInputs();
    if (!resolved.p1UsesKeyboardMouse) return;

    if (e.button === 2) {
      if (this.p1MouseDrawing) {
        this.p1MouseDrawing = false;
        this.p1.cancelDrawing();
      }
      return;
    }

    if (e.button !== 0) return;

    if (this.p1.canStartDrawing() && this.screenToCombatPlane(e.clientX, e.clientY, _hitPoint)) {
      if (this.p1.beginDrawing(_hitPoint)) {
        this.p1MouseDrawing = true;
        this.p1.addDrawingPoint(_hitPoint);
      }
    }
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.isActive || !this.p1MouseDrawing) return;
    if (this.screenToCombatPlane(e.clientX, e.clientY, _hitPoint)) {
      this.p1.addDrawingPoint(_hitPoint);
    }
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0 || !this.p1MouseDrawing) return;
    this.p1MouseDrawing = false;
    if (this.isActive) {
      if (this.screenToCombatPlane(e.clientX, e.clientY, _hitPoint)) {
        this.p1.addDrawingPoint(_hitPoint);
      }
      this.p1.commitDrawing();
    } else {
      this.p1.cancelDrawing();
    }
  };

  private readonly onContextMenu = (e: MouseEvent) => {
    if (this.isActive) {
      e.preventDefault();
    }
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!this.isActive) return;

    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
    ) {
      e.preventDefault();
    }

    const resolved = this.gamepadManager.resolveInputs();
    const firstPress = !this.keys.has(e.code);
    this.keys.add(e.code);

    if (resolved.p1UsesKeyboardMouse) {
      // Player 1 Dodge (E or Q)
      if (firstPress && (e.code === 'KeyE' || e.code === 'KeyQ')) {
        const dx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
        const dz = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
        if (dx !== 0 || dz !== 0) {
          _dodgeDir.set(dx, 0, dz).normalize();
          this.p1.triggerDodge(_dodgeDir);
        } else {
          this.p1.triggerDodge();
        }
      }

      if (firstPress && e.code === 'Escape' && this.p1MouseDrawing) {
        this.p1MouseDrawing = false;
        this.p1.cancelDrawing();
      }
    }

    // Player 2 Keyboard Controls in Local 2P Mode
    if (this.isLocal2P && resolved.p2UsesKeyboard) {
      if (
        firstPress &&
        (e.code === 'Enter' || e.code === 'KeyM' || e.code === 'Numpad0')
      ) {
        if (this.p2.canStartDrawing()) {
          if (this.p2.beginDrawing(this.p2CursorPos)) {
            this.p2KeyDrawing = true;
            this.p2.addDrawingPoint(this.p2CursorPos);
          }
        }
      }

      if (
        firstPress &&
        (e.code === 'Period' || e.code === 'KeyO' || e.code === 'NumpadDecimal')
      ) {
        this.p2.triggerDodge();
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);

    if (
      this.isLocal2P &&
      this.p2KeyDrawing &&
      (e.code === 'Enter' || e.code === 'KeyM' || e.code === 'Numpad0')
    ) {
      this.p2KeyDrawing = false;
      if (this.isActive) {
        this.p2.addDrawingPoint(this.p2CursorPos);
        this.p2.commitDrawing();
      } else {
        this.p2.cancelDrawing();
      }
    }
  };

  /**
   * Polls gamepads even when paused so Menu/Start can unpause on consoles.
   */
  public pollPauseOnly(): void {
    const frames = this.gamepadManager.pollFrames();
    if (this.allowGamepadPause && (frames.p1.pauseJustPressed || frames.p2.pauseJustPressed)) {
      this.onPauseToggle?.();
    }
  }

  public update(dt: number, time: number): void {
    const frames = this.gamepadManager.pollFrames();
    if (this.allowGamepadPause && (frames.p1.pauseJustPressed || frames.p2.pauseJustPressed)) {
      this.onPauseToggle?.();
      return;
    }

    if (!this.isActive) return;

    const settings = this.gamepadManager.getSettings();
    const resolved = this.gamepadManager.resolveInputs();

    // --- PLAYER 1 ---
    const p1Pad = frames.p1;
    const p1KeyGuard =
      resolved.p1UsesKeyboardMouse &&
      (this.keys.has('Space') || this.keys.has('ShiftLeft'));
    this.p1.setGuardHeld(p1KeyGuard || p1Pad.guardHeld);

    if (p1Pad.connected) {
      const p1Speed = 14.0 * settings.p1Bindings.sensitivity;
      if (p1Pad.aimX !== 0 || p1Pad.aimY !== 0) {
        this.p1CursorPos.x += p1Pad.aimX * p1Speed * dt;
        this.p1CursorPos.z += p1Pad.aimY * p1Speed * dt;
      }
      clampCursorToFighterReach(this.p1CursorPos, this.p1.position);

      this.p1CursorMesh.visible = !this.p1MouseDrawing;
      this.p1CursorMesh.position.copy(this.p1CursorPos);
      this.p1CursorMesh.rotation.y = time * 2.5;

      if (p1Pad.dodgeJustPressed) {
        this.p1PadDrawing = false;
        if (p1Pad.aimX !== 0 || p1Pad.aimY !== 0) {
          _dodgeDir.set(p1Pad.aimX, 0, p1Pad.aimY).normalize();
          this.p1.triggerDodge(_dodgeDir);
        } else {
          this.p1.triggerDodge();
        }
      }

      if (p1Pad.cancelJustPressed && this.p1PadDrawing) {
        this.p1PadDrawing = false;
        this.p1.cancelDrawing();
      }

      if (p1Pad.drawJustPressed && !this.p1MouseDrawing && this.p1.canStartDrawing()) {
        if (this.p1.beginDrawing(this.p1CursorPos)) {
          this.p1PadDrawing = true;
          this.p1.addDrawingPoint(this.p1CursorPos);
        }
      }

      if (this.p1PadDrawing) {
        if (p1Pad.drawHeld) {
          this.p1.addDrawingPoint(this.p1CursorPos);
        } else {
          this.p1PadDrawing = false;
          this.p1.addDrawingPoint(this.p1CursorPos);
          this.p1.commitDrawing();
        }
      }
    } else {
      this.p1PadDrawing = false;
      this.p1CursorMesh.visible = false;
    }

    // --- PLAYER 2 (Local 2-Player Mode) ---
    if (this.isLocal2P) {
      const p2Pad = frames.p2;
      const p2KeyGuard =
        resolved.p2UsesKeyboard &&
        (this.keys.has('ShiftRight') || this.keys.has('Slash') || this.keys.has('KeyU'));
      this.p2.setGuardHeld(p2KeyGuard || p2Pad.guardHeld);

      // Keyboard cursor movement for P2
      if (resolved.p2UsesKeyboard) {
        const moveX =
          (this.keys.has('ArrowRight') || this.keys.has('KeyL') ? 1 : 0) -
          (this.keys.has('ArrowLeft') || this.keys.has('KeyJ') ? 1 : 0);
        const moveZ =
          (this.keys.has('ArrowDown') || this.keys.has('KeyK') ? 1 : 0) -
          (this.keys.has('ArrowUp') || this.keys.has('KeyI') ? 1 : 0);

        if (moveX !== 0 || moveZ !== 0) {
          const len = Math.hypot(moveX, moveZ);
          const speed = 13.5;
          this.p2CursorPos.x += (moveX / len) * speed * dt;
          this.p2CursorPos.z += (moveZ / len) * speed * dt;
        }
      }

      // Gamepad cursor movement & actions for P2
      if (p2Pad.connected) {
        const p2Speed = 14.0 * settings.p2Bindings.sensitivity;
        if (p2Pad.aimX !== 0 || p2Pad.aimY !== 0) {
          this.p2CursorPos.x += p2Pad.aimX * p2Speed * dt;
          this.p2CursorPos.z += p2Pad.aimY * p2Speed * dt;
        }

        if (p2Pad.dodgeJustPressed) {
          this.p2PadDrawing = false;
          if (p2Pad.aimX !== 0 || p2Pad.aimY !== 0) {
            _dodgeDir.set(p2Pad.aimX, 0, p2Pad.aimY).normalize();
            this.p2.triggerDodge(_dodgeDir);
          } else {
            this.p2.triggerDodge();
          }
        }

        if (p2Pad.cancelJustPressed && this.p2PadDrawing) {
          this.p2PadDrawing = false;
          this.p2.cancelDrawing();
        }

        if (p2Pad.drawJustPressed && !this.p2KeyDrawing && this.p2.canStartDrawing()) {
          if (this.p2.beginDrawing(this.p2CursorPos)) {
            this.p2PadDrawing = true;
            this.p2.addDrawingPoint(this.p2CursorPos);
          }
        }

        if (this.p2PadDrawing) {
          if (p2Pad.drawHeld) {
            this.p2.addDrawingPoint(this.p2CursorPos);
          } else {
            this.p2PadDrawing = false;
            this.p2.addDrawingPoint(this.p2CursorPos);
            this.p2.commitDrawing();
          }
        }
      } else {
        this.p2PadDrawing = false;
      }

      clampCursorToFighterReach(this.p2CursorPos, this.p2.position);
      this.p2CursorMesh.visible = true;
      this.p2CursorMesh.position.copy(this.p2CursorPos);
      this.p2CursorMesh.rotation.y = time * 2.5;

      if (this.p2KeyDrawing) {
        this.p2.addDrawingPoint(this.p2CursorPos);
      }
    } else {
      this.p2PadDrawing = false;
      this.p2CursorMesh.visible = false;
    }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    [this.p1CursorMesh, this.p2CursorMesh].forEach((group) => {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    });
  }
}
