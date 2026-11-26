import * as THREE from 'three';
import { ARENA_RADIUS, MAX_CHAIN_REACH, WEAPON_COMBAT_HEIGHT } from './constants';
import { FighterCommandTarget } from './fighterInterface';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _combatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WEAPON_COMBAT_HEIGHT);
const _hitPoint = new THREE.Vector3();
const _dodgeDir = new THREE.Vector3();

/**
 * Handles Player 1 (Mouse 3D trajectory drawing + Space/E defense)
 * and Player 2 (Keyboard 3D aiming cursor + Enter/M draw + ShiftRight/. defense)
 * on a single computer.
 */
export class PlayerInputController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.Camera;
  private readonly p1: FighterCommandTarget;
  private readonly p2: FighterCommandTarget;
  private isLocal2P = false;
  private isActive = false;

  // P1 mouse drawing state
  private p1MouseDrawing = false;

  // P2 keyboard 3D cursor state
  public readonly p2CursorPos = new THREE.Vector3(4.5, WEAPON_COMBAT_HEIGHT, 0);
  private p2Drawing = false;
  public readonly p2CursorMesh: THREE.Group;

  private readonly keys = new Set<string>();

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    p1: FighterCommandTarget,
    p2: FighterCommandTarget
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.p1 = p1;
    this.p2 = p2;

    // 3D reticle for Player 2 keyboard trajectory drawing
    this.p2CursorMesh = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.42, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -WEAPON_COMBAT_HEIGHT + 0.05;
    this.p2CursorMesh.add(ring);

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.95,
      })
    );
    this.p2CursorMesh.add(orb);
    this.p2CursorMesh.visible = false;

    this.bindEvents();
  }

  public setMode(isLocal2P: boolean, isActive: boolean): void {
    this.isLocal2P = isLocal2P;
    this.isActive = isActive;
    this.p2CursorMesh.visible = isLocal2P && isActive;
    if (!isActive) {
      this.p1MouseDrawing = false;
      this.p2Drawing = false;
      this.keys.clear();
      this.p1.setGuardHeld(false);
      this.p2.setGuardHeld(false);
    }
  }

  public resetCursors(): void {
    this.p1MouseDrawing = false;
    this.p2Drawing = false;
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

    const firstPress = !this.keys.has(e.code);
    this.keys.add(e.code);

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

    // Player 2 Controls in Local 2P Mode
    if (this.isLocal2P) {
      // Start P2 trajectory draw: Enter, KeyM, or Numpad0
      if (
        firstPress &&
        (e.code === 'Enter' || e.code === 'KeyM' || e.code === 'Numpad0')
      ) {
        if (this.p2.canStartDrawing()) {
          if (this.p2.beginDrawing(this.p2CursorPos)) {
            this.p2Drawing = true;
            this.p2.addDrawingPoint(this.p2CursorPos);
          }
        }
      }

      // P2 Dodge: Period, KeyO, or NumpadDecimal
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
      this.p2Drawing &&
      (e.code === 'Enter' || e.code === 'KeyM' || e.code === 'Numpad0')
    ) {
      this.p2Drawing = false;
      if (this.isActive) {
        this.p2.addDrawingPoint(this.p2CursorPos);
        this.p2.commitDrawing();
      } else {
        this.p2.cancelDrawing();
      }
    }
  };

  public update(dt: number, time: number): void {
    if (!this.isActive) return;

    // P1 Guard hold
    const p1Guard = this.keys.has('Space') || this.keys.has('ShiftLeft');
    this.p1.setGuardHeld(p1Guard);

    // P2 Local Controls
    if (this.isLocal2P) {
      const p2Guard =
        this.keys.has('ShiftRight') || this.keys.has('Slash') || this.keys.has('KeyU');
      this.p2.setGuardHeld(p2Guard);

      // Move P2 3D cursor via Arrow keys or IJKL
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

      // Clamp P2 cursor within chain reach of P2 and inside arena
      const dx = this.p2CursorPos.x - this.p2.position.x;
      const dz = this.p2CursorPos.z - this.p2.position.z;
      const reachDist = Math.hypot(dx, dz);
      if (reachDist > MAX_CHAIN_REACH) {
        this.p2CursorPos.x = this.p2.position.x + (dx / reachDist) * MAX_CHAIN_REACH;
        this.p2CursorPos.z = this.p2.position.z + (dz / reachDist) * MAX_CHAIN_REACH;
      }

      const arenaDist = Math.hypot(this.p2CursorPos.x, this.p2CursorPos.z);
      const maxArena = ARENA_RADIUS - 0.5;
      if (arenaDist > maxArena) {
        this.p2CursorPos.x *= maxArena / arenaDist;
        this.p2CursorPos.z *= maxArena / arenaDist;
      }

      this.p2CursorPos.y = WEAPON_COMBAT_HEIGHT;
      this.p2CursorMesh.visible = true;
      this.p2CursorMesh.position.copy(this.p2CursorPos);
      this.p2CursorMesh.rotation.y = time * 2.5;

      if (this.p2Drawing) {
        this.p2.addDrawingPoint(this.p2CursorPos);
      }
    } else {
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

    this.p2CursorMesh.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
  }
}
