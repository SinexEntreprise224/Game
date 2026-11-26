import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARENA_RADIUS } from './constants';
import { createArenaFloorTexture } from './materials';

export interface ArenaSetup {
  group: THREE.Group;
  floorMesh: THREE.Mesh;
  dispose: () => void;
}

export function buildArenaAndLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): ArenaSetup {
  // Horizon-matched dark atmospheric background & exponential fog
  const bgColor = new THREE.Color(0x070a11);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(0x070a11, 0.022);

  // Mandatory Studio Environment Reflection (RoomEnvironment) on every device
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  // Balanced 3-Point Studio & Combat Lighting Rig (Warm/Cool contrast)
  const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.85);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.1);
  keyLight.position.set(11, 18, 12);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 48;
    const d = ARENA_RADIUS + 3;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
  rimLight.position.set(-14, 10, -14);
  scene.add(rimLight);

  const accentLight = new THREE.PointLight(0xf97316, 1.4, 34, 1.5);
  accentLight.position.set(0, 6, -12);
  scene.add(accentLight);

  const group = new THREE.Group();
  scene.add(group);

  // Main circular combat floor with procedural engraved tactical markings
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const floorTex = createArenaFloorTexture(maxAniso);
  const floorGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS * 1.04, 0.6, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.48,
    metalness: 0.35,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -0.3;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Raised beveled outer arena curb ring
  const curbGeo = new THREE.TorusGeometry(ARENA_RADIUS + 0.15, 0.24, 10, 64);
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25,
  });
  const curb = new THREE.Mesh(curbGeo, curbMat);
  curb.rotation.x = Math.PI / 2;
  curb.position.y = 0.06;
  curb.receiveShadow = true;
  group.add(curb);

  // Glowing boundary warning ring (offset slightly above floor to prevent Z-fighting)
  const boundaryRingGeo = new THREE.RingGeometry(ARENA_RADIUS - 0.12, ARENA_RADIUS - 0.02, 64);
  const boundaryRingMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const boundaryRing = new THREE.Mesh(boundaryRingGeo, boundaryRingMat);
  boundaryRing.rotation.x = -Math.PI / 2;
  boundaryRing.position.y = 0.022;
  group.add(boundaryRing);

  // 8 Perimeter Energy Pylons around the arena edge
  const pylonBodyGeo = new THREE.BoxGeometry(0.55, 2.8, 0.55);
  const pylonTrimGeo = new THREE.BoxGeometry(0.22, 1.9, 0.62);
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.8,
    roughness: 0.3,
  });
  const pylonGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const dist = ARENA_RADIUS + 0.85;
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    pylonGroup.rotation.y = -angle;

    const body = new THREE.Mesh(pylonBodyGeo, pylonMat);
    body.position.y = 1.2;
    body.castShadow = !isSoftwareGl;
    pylonGroup.add(body);

    const strip = new THREE.Mesh(pylonTrimGeo, pylonGlowMat);
    strip.position.y = 1.3;
    pylonGroup.add(strip);

    group.add(pylonGroup);
  }

  // Extended sub-arena abyssal terrace & distant architectural monoliths so world extends into fog
  const subDeckGeo = new THREE.CylinderGeometry(ARENA_RADIUS + 9, ARENA_RADIUS + 14, 2.0, 32);
  const subDeckMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    metalness: 0.5,
    roughness: 0.75,
  });
  const subDeck = new THREE.Mesh(subDeckGeo, subDeckMat);
  subDeck.position.y = -1.65;
  group.add(subDeck);

  const monolithCount = 16;
  const monolithGeo = new THREE.BoxGeometry(2.2, 14, 2.2);
  const monolithMat = new THREE.MeshStandardMaterial({
    color: 0x0d131f,
    metalness: 0.6,
    roughness: 0.65,
  });
  const monolithInstanced = new THREE.InstancedMesh(monolithGeo, monolithMat, monolithCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < monolithCount; i++) {
    const angle = (i / monolithCount) * Math.PI * 2;
    const radius = ARENA_RADIUS + 11 + (i % 3) * 3.5;
    const heightScale = 0.7 + ((i * 37) % 10) * 0.08;
    dummy.position.set(Math.cos(angle) * radius, 2.0, Math.sin(angle) * radius);
    dummy.rotation.y = -angle;
    dummy.scale.set(1, heightScale, 1);
    dummy.updateMatrix();
    monolithInstanced.setMatrixAt(i, dummy.matrix);
  }
  monolithInstanced.instanceMatrix.needsUpdate = true;
  monolithInstanced.computeBoundingSphere();
  group.add(monolithInstanced);

  const dispose = () => {
    envTex.dispose();
    floorTex.dispose();
    group.traverse((obj) => {
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

  return { group, floorMesh, dispose };
}
