import * as THREE from 'three';
import { HitboxZone, HitZone } from './types';

const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _closest = new THREE.Vector3();

export interface SweepHitResult {
  hit: boolean;
  zone: HitZone;
  point: THREE.Vector3;
}

/**
 * Closest distance squared from point C to line segment [A, B].
 * Prevents fast chain-weapons from tunneling through hitboxes.
 */
function segmentPointDistSq(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  outClosest: THREE.Vector3
): number {
  _ab.subVectors(b, a);
  _ac.subVectors(c, a);
  const abLenSq = _ab.lengthSq();
  if (abLenSq < 0.000001) {
    outClosest.copy(a);
    return a.distanceToSquared(c);
  }
  const t = THREE.MathUtils.clamp(_ac.dot(_ab) / abLenSq, 0, 1);
  outClosest.copy(a).addScaledVector(_ab, t);
  return outClosest.distanceToSquared(c);
}

/**
 * Checks swept weapon movement [prevWeaponPos -> currWeaponPos] against all 4 anatomical hitboxes.
 * Evaluates true 3D closest distance to each zone (HEAD, TORSO, ARMS, LEGS) and selects the closest impacted zone.
 */
export function checkWeaponSweepCollision(
  prevWeaponPos: THREE.Vector3,
  currWeaponPos: THREE.Vector3,
  weaponRadius: number,
  targetHitboxes: HitboxZone[]
): SweepHitResult | null {
  let bestHit: SweepHitResult | null = null;
  let bestNormalizedDist = Infinity;

  for (let i = 0; i < targetHitboxes.length; i++) {
    const hb = targetHitboxes[i];
    const combinedR = weaponRadius + hb.radius;
    const distSq = segmentPointDistSq(prevWeaponPos, currWeaponPos, hb.center, _closest);

    // Slight vertical grace only for TORSO/ARMS/LEGS so standard horizontal sweeps connect reliably,
    // while HEAD requires an accurate strike (e.g. opponent crouched/coiled or direct close hit)
    const verticalGrace = hb.zone === 'HEAD' ? 0.08 : 0.42;
    const verticalDiff = Math.abs(_closest.y - hb.center.y);
    const horizDistSq =
      (_closest.x - hb.center.x) * (_closest.x - hb.center.x) +
      (_closest.z - hb.center.z) * (_closest.z - hb.center.z);

    const hitDirect = distSq <= combinedR * combinedR;
    const hitVerticalGrace =
      hb.zone !== 'HEAD' &&
      horizDistSq <= combinedR * combinedR &&
      verticalDiff <= hb.radius + verticalGrace;

    if (hitDirect || hitVerticalGrace) {
      const normalized = Math.sqrt(distSq) / combinedR;
      if (normalized < bestNormalizedDist) {
        bestNormalizedDist = normalized;
        bestHit = {
          hit: true,
          zone: hb.zone,
          point: _closest.clone(),
        };
      }
    }
  }

  return bestHit;
}

export function checkWeaponClash(
  p1Prev: THREE.Vector3,
  p1Curr: THREE.Vector3,
  p2Prev: THREE.Vector3,
  p2Curr: THREE.Vector3,
  clashRadius = 0.55
): THREE.Vector3 | null {
  const mid1 = _ab.addVectors(p1Prev, p1Curr).multiplyScalar(0.5);
  const mid2 = _ac.addVectors(p2Prev, p2Curr).multiplyScalar(0.5);
  if (mid1.distanceToSquared(mid2) <= clashRadius * clashRadius) {
    return new THREE.Vector3().addVectors(mid1, mid2).multiplyScalar(0.5);
  }
  return null;
}

interface SparkParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  active: boolean;
}

const MAX_SPARKS = 80;
const MAX_RINGS = 8;

export class ImpactEffectsSystem {
  public readonly group = new THREE.Group();
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly sparks: SparkParticle[] = [];
  private readonly rings: ShockwaveRing[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor() {
    const sparkGeo = new THREE.OctahedronGeometry(0.08, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = 0;
    this.group.add(this.sparkMesh);

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparks.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        color: new THREE.Color(0xffffff),
      });
    }

    const ringGeo = new THREE.RingGeometry(0.25, 0.36, 24);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.32,
        active: false,
      });
    }
  }

  public spawnImpact(point: THREE.Vector3, colorHex: number, count = 16, scale = 1): void {
    let spawned = 0;
    for (let i = 0; i < this.sparks.length && spawned < count; i++) {
      const s = this.sparks[i];
      if (!s.active) {
        s.active = true;
        s.pos.copy(point);
        const theta = Math.random() * Math.PI * 2;
        const speed = (4 + Math.random() * 7) * scale;
        s.vel.set(
          Math.cos(theta) * speed,
          (2 + Math.random() * 5) * scale,
          Math.sin(theta) * speed
        );
        s.life = 0;
        s.maxLife = 0.25 + Math.random() * 0.25;
        s.color.setHex(spawned % 3 === 0 ? 0xffffff : colorHex);
        spawned++;
      }
    }

    // Spawn shockwave ring
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.active) {
        r.active = true;
        r.life = 0;
        r.maxLife = 0.28;
        r.mesh.position.copy(point);
        r.mesh.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.6, 0, Math.random() * Math.PI);
        r.mesh.scale.setScalar(0.5 * scale);
        r.mat.color.setHex(colorHex);
        r.mat.opacity = 0.9;
        r.mesh.visible = true;
        break;
      }
    }
  }

  public update(dt: number): void {
    let activeCount = 0;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;

      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        continue;
      }

      s.vel.y -= 16 * dt;
      s.pos.addScaledVector(s.vel, dt);
      if (s.pos.y < 0.05) {
        s.pos.y = 0.05;
        s.vel.y *= -0.4;
      }

      const ratio = 1 - s.life / s.maxLife;
      this.dummy.position.copy(s.pos);
      this.dummy.scale.set(ratio * 0.8, ratio * 1.4, ratio * 0.8);
      this.dummy.rotation.set(s.life * 8, s.life * 11, 0);
      this.dummy.updateMatrix();

      this.sparkMesh.setMatrixAt(activeCount, this.dummy.matrix);
      this.sparkMesh.setColorAt(activeCount, s.color);
      activeCount++;
    }

    this.sparkMesh.count = activeCount;
    if (activeCount > 0) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) {
        this.sparkMesh.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      r.life += dt;
      if (r.life >= r.maxLife) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.life / r.maxLife;
      r.mesh.scale.setScalar(0.5 + t * 2.8);
      r.mat.opacity = (1 - t) * 0.85;
    }
  }

  public dispose(): void {
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.rings.forEach((r) => {
      r.mesh.geometry.dispose();
      r.mat.dispose();
    });
  }
}
