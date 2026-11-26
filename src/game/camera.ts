import * as THREE from 'three';

const _midpoint = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _shakeOffset = new THREE.Vector3();

/**
 * Dynamic 3D combat camera that frames both fighters and active chain weapons
 * cleanly from an elevated tactical 3/4 combat angle.
 */
export class CombatCamera {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly currentTarget = new THREE.Vector3(0, 1.0, 0);
  private readonly currentPos = new THREE.Vector3(0, 13.5, 16.5);
  private shakeTrauma = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.2, 160);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public addShake(amount: number): void {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  public update(
    p1Pos: THREE.Vector3,
    p2Pos: THREE.Vector3,
    p1WeaponPos: THREE.Vector3,
    p2WeaponPos: THREE.Vector3,
    isMenuMode: boolean,
    time: number,
    dt: number
  ): void {
    if (isMenuMode) {
      // Gentle slow orbit around the arena during menu preview
      const angle = time * 0.14;
      _desiredPos.set(Math.sin(angle) * 16.5, 10.5, Math.cos(angle) * 16.5);
      _desiredTarget.set(0, 1.1, 0);
    } else {
      // Weighted combat focus: 70% fighters midpoint, 30% weapons midpoint so chains stay visible
      _midpoint
        .addVectors(p1Pos, p2Pos)
        .multiplyScalar(0.35)
        .addScaledVector(p1WeaponPos, 0.15)
        .addScaledVector(p2WeaponPos, 0.15);

      const fighterSpread = p1Pos.distanceTo(p2Pos);
      const weaponSpread = Math.max(
        p1Pos.distanceTo(p1WeaponPos),
        p2Pos.distanceTo(p2WeaponPos)
      );
      const effectiveSpan = Math.max(fighterSpread, weaponSpread * 0.9);

      // Pull back smoothly as fighters separate or chains extend wide
      const distanceFactor = THREE.MathUtils.clamp(effectiveSpan, 5.5, 18.0);
      const camDist = 11.5 + distanceFactor * 0.62;
      const camHeight = 10.5 + distanceFactor * 0.42;

      _desiredTarget.set(_midpoint.x * 0.72, 0.95, _midpoint.z * 0.72);
      _desiredPos.set(
        _desiredTarget.x * 0.55,
        camHeight,
        _desiredTarget.z + camDist
      );
    }

    const posLambda = isMenuMode ? 3.5 : 5.5;
    const tgtLambda = isMenuMode ? 4.0 : 7.5;

    this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, _desiredPos.x, posLambda, dt);
    this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, _desiredPos.y, posLambda, dt);
    this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, _desiredPos.z, posLambda, dt);

    this.currentTarget.x = THREE.MathUtils.damp(this.currentTarget.x, _desiredTarget.x, tgtLambda, dt);
    this.currentTarget.y = THREE.MathUtils.damp(this.currentTarget.y, _desiredTarget.y, tgtLambda, dt);
    this.currentTarget.z = THREE.MathUtils.damp(this.currentTarget.z, _desiredTarget.z, tgtLambda, dt);

    // Damped trauma camera shake
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.4);
    const shakeMag = this.shakeTrauma * this.shakeTrauma * 0.45;
    _shakeOffset.set(
      (Math.random() * 2 - 1) * shakeMag,
      (Math.random() * 2 - 1) * shakeMag * 0.7,
      (Math.random() * 2 - 1) * shakeMag
    );

    this.camera.position.copy(this.currentPos).add(_shakeOffset);
    this.camera.lookAt(this.currentTarget);
  }
}
