import * as THREE from 'three';
import { CHAIN_LINK_COUNT, MAX_CHAIN_REACH } from './constants';

const _dir = new THREE.Vector3();
const _target = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _quat = new THREE.Quaternion();
const _rollQuat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _push = new THREE.Vector3();

/**
 * Multi-link Verlet/constrained chain simulation between fighter hand and weapon head.
 * Renders all links in a single InstancedMesh with alternating 90-degree interlocking links,
 * realistic sag, whip inertia, body repulsion, and visual tension feedback.
 */
export class ChainSystem {
  public readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly nodes: THREE.Vector3[] = [];
  private readonly prevNodes: THREE.Vector3[] = [];
  private readonly baseColor: THREE.Color;
  private readonly tensionColor: THREE.Color;
  private readonly currentEmissive = new THREE.Color();
  public tension = 0;

  constructor(accentHex: number, initialHandPos: THREE.Vector3, initialWeaponPos: THREE.Vector3) {
    const linkGeo = new THREE.TorusGeometry(0.085, 0.028, 7, 14);
    // Elongate torus slightly to look like a forged oval chain link
    linkGeo.scale(1.45, 0.9, 1.0);

    this.material = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.25,
      emissive: accentHex,
      emissiveIntensity: 0.15,
    });

    this.baseColor = new THREE.Color(accentHex);
    this.tensionColor = new THREE.Color(0xfef08a);

    this.mesh = new THREE.InstancedMesh(linkGeo, this.material, CHAIN_LINK_COUNT);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;

    for (let i = 0; i <= CHAIN_LINK_COUNT; i++) {
      const t = i / CHAIN_LINK_COUNT;
      const p = new THREE.Vector3().lerpVectors(initialHandPos, initialWeaponPos, t);
      this.nodes.push(p.clone());
      this.prevNodes.push(p.clone());
    }

    this.syncInstances();
  }

  public reset(handPos: THREE.Vector3, weaponPos: THREE.Vector3): void {
    for (let i = 0; i <= CHAIN_LINK_COUNT; i++) {
      const t = i / CHAIN_LINK_COUNT;
      this.nodes[i].lerpVectors(handPos, weaponPos, t);
      this.prevNodes[i].copy(this.nodes[i]);
    }
    this.tension = 0;
    this.syncInstances();
  }

  public update(
    handPos: THREE.Vector3,
    weaponPos: THREE.Vector3,
    fighterCenterPos: THREE.Vector3,
    dt: number,
    isWeaponTraveling: boolean
  ): void {
    const safeDt = Math.min(dt, 0.033);
    const totalSpan = handPos.distanceTo(weaponPos);
    this.tension = THREE.MathUtils.clamp(totalSpan / MAX_CHAIN_REACH, 0, 1);

    // Effective segment rest length: taut when weapon travels far, gentle slack when resting
    const minChainRest = Math.max(1.3, totalSpan * (isWeaponTraveling ? 1.02 : 1.12));
    const segLen = minChainRest / CHAIN_LINK_COUNT;
    const gravity = isWeaponTraveling ? -5.5 : -12.0;
    const damping = isWeaponTraveling ? 0.88 : 0.84;

    // 1. Verlet integration for interior chain nodes
    for (let i = 1; i < CHAIN_LINK_COUNT; i++) {
      const cur = this.nodes[i];
      const prev = this.prevNodes[i];

      const vx = (cur.x - prev.x) * damping;
      const vy = (cur.y - prev.y) * damping;
      const vz = (cur.z - prev.z) * damping;

      prev.copy(cur);
      cur.x += vx;
      cur.y += vy + gravity * safeDt * safeDt;
      cur.z += vz;
    }

    // 2. Pin endpoints to fighter's weapon hand and weapon head
    this.nodes[0].copy(handPos);
    this.nodes[CHAIN_LINK_COUNT].copy(weaponPos);

    // 3. Distance constraints + body repulsion + ground clamp
    const iterations = 6;
    for (let iter = 0; iter < iterations; iter++) {
      this.nodes[0].copy(handPos);
      this.nodes[CHAIN_LINK_COUNT].copy(weaponPos);

      for (let i = 0; i < CHAIN_LINK_COUNT; i++) {
        const a = this.nodes[i];
        const b = this.nodes[i + 1];
        _dir.subVectors(b, a);
        const dist = _dir.length();
        if (dist > 0.0001) {
          const diff = (dist - segLen) / dist;
          if (i === 0) {
            b.addScaledVector(_dir, -diff);
          } else if (i === CHAIN_LINK_COUNT - 1) {
            a.addScaledVector(_dir, diff);
          } else {
            a.addScaledVector(_dir, diff * 0.5);
            b.addScaledVector(_dir, -diff * 0.5);
          }
        }
      }

      // Prevent chain from clipping awkwardly through the fighter's own torso or floor
      for (let i = 1; i < CHAIN_LINK_COUNT; i++) {
        const n = this.nodes[i];
        if (n.y < 0.09) n.y = 0.09;

        const dx = n.x - fighterCenterPos.x;
        const dz = n.z - fighterCenterPos.z;
        const radial = Math.hypot(dx, dz);
        if (radial < 0.58 && n.y < 1.65) {
          if (radial > 0.001) {
            _push.set(dx / radial, 0, dz / radial);
            n.x = fighterCenterPos.x + _push.x * 0.58;
            n.z = fighterCenterPos.z + _push.z * 0.58;
          } else {
            n.z = fighterCenterPos.z + 0.58;
          }
        }
      }
    }

    // Visual tension feedback on chain links
    this.currentEmissive.lerpColors(this.baseColor, this.tensionColor, Math.pow(this.tension, 1.5));
    this.material.emissive.copy(this.currentEmissive);
    this.material.emissiveIntensity = 0.12 + this.tension * 0.75;

    this.syncInstances();
  }

  private syncInstances(): void {
    for (let i = 0; i < CHAIN_LINK_COUNT; i++) {
      const a = this.nodes[i];
      const b = this.nodes[i + 1];

      _target.addVectors(a, b).multiplyScalar(0.5);
      _dir.subVectors(b, a);
      const len = Math.max(0.05, _dir.length());
      _dir.divideScalar(len);

      // Orient link along chain segment (+X of torus aligned to segment)
      _quat.setFromUnitVectors(_xAxis, _dir);
      // Alternate 90 degrees around segment axis for true interlocking links
      _rollQuat.setFromAxisAngle(_dir, (i % 2) * (Math.PI / 2));
      _quat.premultiply(_rollQuat);

      const linkStretch = THREE.MathUtils.clamp(len / 0.22, 0.75, 1.85);
      _scale.set(linkStretch, 1, 1);

      _mat.compose(_target, _quat, _scale);
      this.mesh.setMatrixAt(i, _mat);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
