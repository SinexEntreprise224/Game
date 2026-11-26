import * as THREE from 'three';
import { createRadialShadowTexture } from './materials';
import { FighterPhase, HitboxZone } from './types';

const _worldVec = new THREE.Vector3();

export interface FighterRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rightHandAnchor: THREE.Object3D;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  guardShield: THREE.Mesh;
  contactShadow: THREE.Mesh;
  hitboxes: HitboxZone[];
  updateAnimation: (
    phase: FighterPhase,
    time: number,
    dt: number,
    moveSpeedRatio: number,
    aimYawOffset: number,
    hitFlash: number
  ) => void;
  updateHitboxes: () => void;
  getHandWorldPosition: (out: THREE.Vector3) => THREE.Vector3;
  dispose: () => void;
}

export function createFighterRig(
  id: 1 | 2,
  primaryHex: number,
  accentHex: number
): FighterRig {
  const root = new THREE.Group();

  // Materials with calibrated PBR roughness/metalness contrast
  const armorMat = new THREE.MeshStandardMaterial({
    color: id === 1 ? 0x1e293b : 0x271c19,
    metalness: 0.72,
    roughness: 0.28,
  });
  const underSuitMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.2,
    roughness: 0.78,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    metalness: 0.65,
    roughness: 0.25,
    emissive: accentHex,
    emissiveIntensity: 0.28,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 0.3,
  });

  // Contact shadow disc grounded at y=0.015
  const shadowTex = createRadialShadowTexture();
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.75),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.018;
  root.add(contactShadow);

  // Pelvis (pivot at hip height ~0.95m)
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.94;
  root.add(pelvis);

  const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.22, 10), underSuitMat);
  pelvisMesh.castShadow = true;
  pelvis.add(pelvisMesh);

  const beltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 10), trimMat);
  beltMesh.position.y = 0.05;
  beltMesh.castShadow = true;
  pelvis.add(beltMesh);

  // Torso (sculpted beveled chestplate)
  const torso = new THREE.Group();
  torso.position.y = 0.12;
  pelvis.add(torso);

  const chestShape = new THREE.Shape();
  chestShape.moveTo(-0.22, 0);
  chestShape.lineTo(0.22, 0);
  chestShape.lineTo(0.3, 0.44);
  chestShape.lineTo(0.16, 0.56);
  chestShape.lineTo(-0.16, 0.56);
  chestShape.lineTo(-0.3, 0.44);
  chestShape.closePath();

  const chestGeo = new THREE.ExtrudeGeometry(chestShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  chestGeo.center();
  const chestMesh = new THREE.Mesh(chestGeo, armorMat);
  chestMesh.position.y = 0.28;
  chestMesh.castShadow = true;
  chestMesh.receiveShadow = true;
  torso.add(chestMesh);

  // Spine core accent
  const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.31), visorMat);
  coreMesh.position.set(0, 0.3, -0.02);
  torso.add(coreMesh);

  // Head + Helmet + Glowing Visor
  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8), underSuitMat);
  head.add(neck);

  const helmet = new THREE.Mesh(new THREE.DodecahedronGeometry(0.185, 1), armorMat);
  helmet.position.y = 0.14;
  helmet.scale.set(0.92, 1.08, 1.05);
  helmet.castShadow = true;
  head.add(helmet);

  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.28), trimMat);
  crest.position.set(0, 0.28, -0.02);
  crest.castShadow = true;
  head.add(crest);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.14), visorMat);
  visor.position.set(0, 0.15, 0.12);
  head.add(visor);

  // Left Arm (Off-hand / Guard Arm)
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.36, 0.48, 0);
  torso.add(leftShoulder);

  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), trimMat);
  lPauldron.scale.set(1.1, 0.85, 1.05);
  lPauldron.castShadow = true;
  leftShoulder.add(lPauldron);

  const lUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 6, 8), underSuitMat);
  lUpperArm.position.y = -0.17;
  lUpperArm.castShadow = true;
  leftShoulder.add(lUpperArm);

  const leftElbow = new THREE.Group();
  leftElbow.position.y = -0.34;
  leftShoulder.add(leftElbow);

  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.058, 0.3, 8), armorMat);
  lForearm.position.y = -0.14;
  lForearm.castShadow = true;
  leftElbow.add(lForearm);

  const lBracer = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.12), trimMat);
  lBracer.position.set(-0.02, -0.15, 0.03);
  leftElbow.add(lBracer);

  // Guard energy barrier attached to left forearm
  const guardShield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 0.04, 24, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  guardShield.rotation.x = Math.PI / 2;
  guardShield.rotation.z = Math.PI / 2;
  guardShield.position.set(0.32, 0.1, 0.35);
  guardShield.visible = false;
  torso.add(guardShield);

  // Right Arm (Chain Weapon Hand)
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.36, 0.48, 0);
  torso.add(rightShoulder);

  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), trimMat);
  rPauldron.scale.set(1.15, 0.9, 1.1);
  rPauldron.castShadow = true;
  rightShoulder.add(rPauldron);

  const rUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 6, 8), underSuitMat);
  rUpperArm.position.y = -0.17;
  rUpperArm.castShadow = true;
  rightShoulder.add(rUpperArm);

  const rightElbow = new THREE.Group();
  rightElbow.position.y = -0.34;
  rightShoulder.add(rightElbow);

  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.062, 0.3, 8), armorMat);
  rForearm.position.y = -0.14;
  rForearm.castShadow = true;
  rightElbow.add(rForearm);

  const rGauntletRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.024, 8, 14), visorMat);
  rGauntletRing.rotation.x = Math.PI / 2;
  rGauntletRing.position.y = -0.27;
  rightElbow.add(rGauntletRing);

  const rightHandAnchor = new THREE.Object3D();
  rightHandAnchor.position.set(0, -0.31, 0.04);
  rightElbow.add(rightHandAnchor);

  // Legs
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, -0.04, 0);
    pelvis.add(hip);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.32, 6, 8), underSuitMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);

    const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.14), trimMat);
    kneeGuard.position.set(0, 0.01, 0.04);
    knee.add(kneeGuard);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.062, 0.38, 8), armorMat);
    shin.position.y = -0.21;
    shin.castShadow = true;
    knee.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), armorMat);
    boot.position.set(0, -0.41, 0.04);
    boot.castShadow = true;
    knee.add(boot);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Pre-allocated 4 anatomical hitbox zones
  const hitboxes: HitboxZone[] = [
    { zone: 'HEAD', center: new THREE.Vector3(), radius: 0.28 },
    { zone: 'TORSO', center: new THREE.Vector3(), radius: 0.42 },
    { zone: 'ARMS', center: new THREE.Vector3(), radius: 0.34 },
    { zone: 'LEGS', center: new THREE.Vector3(), radius: 0.36 },
  ];

  const updateHitboxes = () => {
    root.updateMatrixWorld(true);
    // 0: HEAD
    head.getWorldPosition(hitboxes[0].center);
    hitboxes[0].center.y += 0.15;
    // 1: TORSO
    torso.getWorldPosition(hitboxes[1].center);
    hitboxes[1].center.y += 0.28;
    // 2: ARMS (midpoint weighted toward weapon side)
    rightElbow.getWorldPosition(hitboxes[2].center);
    // 3: LEGS
    pelvis.getWorldPosition(hitboxes[3].center);
    hitboxes[3].center.y -= 0.42;
  };

  const updateAnimation = (
    phase: FighterPhase,
    time: number,
    dt: number,
    moveSpeedRatio: number,
    aimYawOffset: number,
    hitFlash: number
  ) => {
    const blend = 1 - Math.exp(-14 * dt);

    let targetPelvisY = 0.94;
    let targetPelvisRotX = 0;
    let targetTorsoRotX = 0.08;
    let targetTorsoRotY = 0;
    let targetHeadRotX = 0;
    let targetLShoulderX = -0.45;
    let targetLShoulderZ = 0.22;
    let targetLElbowX = -0.85;
    let targetRShoulderX = -0.35;
    let targetRShoulderZ = -0.25;
    let targetRElbowX = -0.75;
    let targetLHipX = -0.15;
    let targetLKneeX = 0.22;
    let targetRHipX = 0.15;
    let targetRKneeX = 0.22;

    guardShield.visible = phase === 'GUARD';

    if (phase === 'IDLE') {
      const breath = Math.sin(time * 3.2);
      targetPelvisY = 0.93 + breath * 0.022;
      targetTorsoRotX = 0.1 + breath * 0.02;
      targetTorsoRotY = -0.22;
      targetLShoulderX = -0.55 + breath * 0.04;
      targetRShoulderX = -0.42 - breath * 0.04;
      targetLHipX = -0.2;
      targetLKneeX = 0.3;
      targetRHipX = 0.22;
      targetRKneeX = 0.18;
    } else if (phase === 'DRAWING') {
      // Crouched, coiled throw-ready pose while fighter remains planted
      const coil = Math.sin(time * 8) * 0.03;
      targetPelvisY = 0.86;
      targetTorsoRotX = 0.22;
      targetTorsoRotY = -0.45 + coil;
      targetRShoulderX = -1.05;
      targetRShoulderZ = -0.55;
      targetRElbowX = -0.95;
      targetLShoulderX = -0.8;
      targetLShoulderZ = 0.35;
      targetLHipX = -0.35;
      targetLKneeX = 0.55;
      targetRHipX = 0.25;
      targetRKneeX = 0.45;
    } else if (phase === 'WEAPON_TRAVEL' || phase === 'WEAPON_ARRIVED') {
      // Fighter stays planted at origin while twisting torso & extending chain arm!
      targetPelvisY = 0.88;
      targetTorsoRotX = 0.18;
      targetTorsoRotY = THREE.MathUtils.clamp(aimYawOffset * 0.45, -0.9, 0.9);
      targetRShoulderX = -1.45;
      targetRShoulderZ = -0.18;
      targetRElbowX = -0.12;
      targetLShoulderX = -0.5;
      targetLShoulderZ = 0.45;
      targetLHipX = -0.28;
      targetLKneeX = 0.42;
      targetRHipX = 0.28;
      targetRKneeX = 0.35;
    } else if (phase === 'FIGHTER_FOLLOW') {
      // Dynamic sprint / chain-pulled surge along trajectory!
      const stride = Math.sin(time * 18 * Math.max(0.6, moveSpeedRatio));
      targetPelvisY = 0.89 + Math.abs(stride) * 0.06;
      targetTorsoRotX = 0.38;
      targetTorsoRotY = stride * 0.15;
      targetRShoulderX = -1.25;
      targetRElbowX = -0.25;
      targetLShoulderX = 0.45 * stride - 0.35;
      targetLElbowX = -0.95;
      targetLHipX = stride * 0.72;
      targetLKneeX = Math.max(0.1, -stride * 0.85 + 0.35);
      targetRHipX = -stride * 0.72;
      targetRKneeX = Math.max(0.1, stride * 0.85 + 0.35);
    } else if (phase === 'GUARD') {
      targetPelvisY = 0.85;
      targetTorsoRotX = 0.14;
      targetTorsoRotY = 0.28;
      targetLShoulderX = -1.15;
      targetLShoulderZ = -0.35;
      targetLElbowX = -1.05;
      targetRShoulderX = -0.7;
      targetRShoulderZ = 0.25;
      targetLHipX = -0.3;
      targetLKneeX = 0.48;
      targetRHipX = 0.25;
      targetRKneeX = 0.42;
    } else if (phase === 'DODGE') {
      targetPelvisY = 0.8;
      targetTorsoRotX = 0.42;
      targetTorsoRotY = 0.55;
      targetLHipX = -0.45;
      targetLKneeX = 0.7;
      targetRHipX = 0.45;
      targetRKneeX = 0.65;
    } else if (phase === 'HITSTUN') {
      targetPelvisY = 0.87;
      targetTorsoRotX = -0.35;
      targetHeadRotX = -0.35;
      targetLShoulderX = -0.2;
      targetLShoulderZ = 0.7;
      targetRShoulderX = -0.2;
      targetRShoulderZ = -0.7;
    } else if (phase === 'RECOVER') {
      targetPelvisY = 0.9;
      targetTorsoRotX = 0.22;
      targetRShoulderX = -0.5;
      targetRElbowX = -0.9;
    } else if (phase === 'KO') {
      targetPelvisY = 0.24;
      targetPelvisRotX = -Math.PI / 2.1;
      targetTorsoRotX = 0.15;
      targetLShoulderZ = 0.65;
      targetRShoulderZ = -0.65;
      targetLHipX = 0.1;
      targetLKneeX = 0.15;
      targetRHipX = -0.1;
      targetRKneeX = 0.15;
    } else if (phase === 'VICTORY') {
      const cheer = Math.sin(time * 4) * 0.05;
      targetPelvisY = 0.96;
      targetTorsoRotX = -0.05;
      targetRShoulderX = -2.45 + cheer;
      targetRShoulderZ = -0.35;
      targetRElbowX = -0.2;
      targetLShoulderX = -0.3;
      targetLShoulderZ = 0.4;
    }

    pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, targetPelvisY, blend);
    pelvis.rotation.x = THREE.MathUtils.lerp(pelvis.rotation.x, targetPelvisRotX, blend);
    torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, targetTorsoRotX, blend);
    torso.rotation.y = THREE.MathUtils.lerp(torso.rotation.y, targetTorsoRotY, blend);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetHeadRotX, blend);

    leftShoulder.rotation.x = THREE.MathUtils.lerp(leftShoulder.rotation.x, targetLShoulderX, blend);
    leftShoulder.rotation.z = THREE.MathUtils.lerp(leftShoulder.rotation.z, targetLShoulderZ, blend);
    leftElbow.rotation.x = THREE.MathUtils.lerp(leftElbow.rotation.x, targetLElbowX, blend);

    rightShoulder.rotation.x = THREE.MathUtils.lerp(rightShoulder.rotation.x, targetRShoulderX, blend);
    rightShoulder.rotation.z = THREE.MathUtils.lerp(rightShoulder.rotation.z, targetRShoulderZ, blend);
    rightElbow.rotation.x = THREE.MathUtils.lerp(rightElbow.rotation.x, targetRElbowX, blend);

    leftLeg.hip.rotation.x = THREE.MathUtils.lerp(leftLeg.hip.rotation.x, targetLHipX, blend);
    leftLeg.knee.rotation.x = THREE.MathUtils.lerp(leftLeg.knee.rotation.x, targetLKneeX, blend);
    rightLeg.hip.rotation.x = THREE.MathUtils.lerp(rightLeg.hip.rotation.x, targetRHipX, blend);
    rightLeg.knee.rotation.x = THREE.MathUtils.lerp(rightLeg.knee.rotation.x, targetRKneeX, blend);

    // Hit flash emissive feedback
    armorMat.emissive.setHex(hitFlash > 0.05 ? 0xffffff : 0x000000);
    armorMat.emissiveIntensity = hitFlash * 0.75;
  };

  const getHandWorldPosition = (out: THREE.Vector3): THREE.Vector3 => {
    rightHandAnchor.getWorldPosition(_worldVec);
    return out.copy(_worldVec);
  };

  const dispose = () => {
    shadowTex.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  };

  return {
    root,
    pelvis,
    torso,
    head,
    leftShoulder,
    leftElbow,
    rightShoulder,
    rightElbow,
    rightHandAnchor,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    guardShield,
    contactShadow,
    hitboxes,
    updateAnimation,
    updateHitboxes,
    getHandWorldPosition,
    dispose,
  };
}

export interface WeaponRig {
  root: THREE.Group;
  updateVisuals: (velocityDir: THREE.Vector3, isTraveling: boolean, dt: number) => void;
  dispose: () => void;
}

const TRAIL_POINTS = 18;

export function createWeaponRig(id: 1 | 2, accentHex: number): WeaponRig {
  const root = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    metalness: 0.94,
    roughness: 0.16,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.32,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.65,
    metalness: 0.35,
    roughness: 0.2,
  });

  const headGroup = new THREE.Group();
  root.add(headGroup);

  if (id === 1) {
    // Player 1: Crescent Chain-Scythe Blade (Kusarigama)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.28, 10), darkMetalMat);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    headGroup.add(hub);

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.quadraticCurveTo(0.28, 0.22, 0.56, 0.05);
    bladeShape.quadraticCurveTo(0.25, 0.08, 0.05, -0.09);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    bladeGeo.center();
    const blade = new THREE.Mesh(bladeGeo, steelMat);
    blade.rotation.x = Math.PI / 2;
    blade.position.set(0.18, 0, 0.16);
    blade.castShadow = true;
    headGroup.add(blade);

    const glowEdge = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI * 0.9), edgeMat);
    glowEdge.rotation.x = Math.PI / 2;
    glowEdge.position.set(0.12, 0, 0.14);
    headGroup.add(glowEdge);
  } else {
    // Player 2 / AI: Spiked Meteor War-Flail
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), darkMetalMat);
    core.castShadow = true;
    headGroup.add(core);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.032, 8, 16), edgeMat);
    ring.rotation.x = Math.PI / 2;
    headGroup.add(ring);

    const spikeGeo = new THREE.ConeGeometry(0.065, 0.24, 6);
    const dirs = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    dirs.forEach(([dx, dy, dz]) => {
      const spike = new THREE.Mesh(spikeGeo, steelMat);
      spike.position.set(dx * 0.24, dy * 0.24, dz * 0.24);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz));
      spike.castShadow = true;
      headGroup.add(spike);
    });
  }

  // Motion trail ribbon in world space (kept as sibling or updated via world coordinates)
  const trailPositions = new Float32Array(TRAIL_POINTS * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMat = new THREE.LineBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.75,
  });
  const trailLine = new THREE.Line(trailGeo, trailMat);
  trailLine.frustumCulled = false;

  const trailHistory: THREE.Vector3[] = [];
  for (let i = 0; i < TRAIL_POINTS; i++) {
    trailHistory.push(new THREE.Vector3());
  }
  let trailInitialized = false;

  const targetQuat = new THREE.Quaternion();
  const zForward = new THREE.Vector3(0, 0, 1);

  const updateVisuals = (velocityDir: THREE.Vector3, isTraveling: boolean, dt: number) => {
    if (velocityDir.lengthSq() > 0.01) {
      targetQuat.setFromUnitVectors(zForward, velocityDir);
      headGroup.quaternion.slerp(targetQuat, 1 - Math.exp(-16 * dt));
    }

    if (isTraveling) {
      headGroup.rotation.z += dt * 16;
      edgeMat.emissiveIntensity = 2.2;
    } else {
      edgeMat.emissiveIntensity = 1.25;
    }

    if (!trailInitialized) {
      for (let i = 0; i < TRAIL_POINTS; i++) {
        trailHistory[i].copy(root.position);
      }
      trailInitialized = true;
    }

    // Shift trail history
    for (let i = TRAIL_POINTS - 1; i > 0; i--) {
      trailHistory[i].copy(trailHistory[i - 1]);
    }
    trailHistory[0].copy(root.position);

    for (let i = 0; i < TRAIL_POINTS; i++) {
      // Convert world trail history into local coordinates of root so trail stays attached cleanly
      trailPositions[i * 3] = trailHistory[i].x - root.position.x;
      trailPositions[i * 3 + 1] = trailHistory[i].y - root.position.y;
      trailPositions[i * 3 + 2] = trailHistory[i].z - root.position.z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailMat.opacity = isTraveling ? 0.88 : 0.15;
  };

  root.add(trailLine);

  const dispose = () => {
    trailGeo.dispose();
    trailMat.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  };

  return { root, updateVisuals, dispose };
}
