import * as THREE from 'three';
import {
  ARENA_RADIUS,
  FIGHTER_RADIUS,
  MAX_CHAIN_REACH,
  MAX_TRAJECTORY_LENGTH,
  MIN_TRAJECTORY_LENGTH,
  SAMPLE_POINT_STEP,
  TURN_ANGLE_THRESHOLD_RAD,
  WEAPON_COMBAT_HEIGHT,
} from './constants';
import { TrajectoryPath, TrajectoryWaypoint } from './types';

const _tmpVec = new THREE.Vector3();
const _prevDir = new THREE.Vector3();
const _newDir = new THREE.Vector3();

const MAX_LINE_POINTS = 128;
const MAX_WAYPOINT_MARKERS = 32;

export class TrajectoryVisualizer {
  public readonly group = new THREE.Group();
  private readonly line: THREE.Line;
  private readonly lineGeo: THREE.BufferGeometry;
  private readonly lineMat: THREE.LineBasicMaterial;
  private readonly linePositions: Float32Array;

  private readonly shadowLine: THREE.Line;
  private readonly shadowGeo: THREE.BufferGeometry;
  private readonly shadowMat: THREE.LineBasicMaterial;
  private readonly shadowPositions: Float32Array;

  private readonly startMarker: THREE.Mesh;
  private readonly endMarkerGroup: THREE.Group;
  private readonly endRingMat: THREE.MeshBasicMaterial;
  private readonly endCoreMat: THREE.MeshBasicMaterial;
  private readonly reachRing: THREE.Mesh;
  private readonly reachRingMat: THREE.MeshBasicMaterial;

  private readonly waypointInstanced: THREE.InstancedMesh;
  private readonly waypointDummy = new THREE.Object3D();

  private fadeAlpha = 0;

  constructor(colorHex: number) {
    // Main elevated 3D trajectory line
    this.linePositions = new Float32Array(MAX_LINE_POINTS * 3);
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.lineGeo.setDrawRange(0, 0);
    this.lineMat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
    });
    this.line = new THREE.Line(this.lineGeo, this.lineMat);
    this.line.frustumCulled = false;
    this.group.add(this.line);

    // Projected ground guide line on arena floor for crystal-clear depth perception
    this.shadowPositions = new Float32Array(MAX_LINE_POINTS * 3);
    this.shadowGeo = new THREE.BufferGeometry();
    this.shadowGeo.setAttribute('position', new THREE.BufferAttribute(this.shadowPositions, 3));
    this.shadowGeo.setDrawRange(0, 0);
    this.shadowMat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.32,
    });
    this.shadowLine = new THREE.Line(this.shadowGeo, this.shadowMat);
    this.shadowLine.frustumCulled = false;
    this.group.add(this.shadowLine);

    // Start point marker
    this.startMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    this.startMarker.visible = false;
    this.group.add(this.startMarker);

    // End target marker (ring on floor + floating diamond)
    this.endMarkerGroup = new THREE.Group();
    this.endRingMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const endRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.48, 28), this.endRingMat);
    endRing.rotation.x = -Math.PI / 2;
    endRing.position.y = 0.04;
    this.endMarkerGroup.add(endRing);

    this.endCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const endDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), this.endCoreMat);
    endDiamond.position.y = WEAPON_COMBAT_HEIGHT;
    this.endMarkerGroup.add(endDiamond);
    this.endMarkerGroup.visible = false;
    this.group.add(this.endMarkerGroup);

    // Max chain reach ring around fighter while drawing
    this.reachRingMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.reachRing = new THREE.Mesh(
      new THREE.RingGeometry(MAX_CHAIN_REACH - 0.1, MAX_CHAIN_REACH, 64),
      this.reachRingMat
    );
    this.reachRing.rotation.x = -Math.PI / 2;
    this.reachRing.position.y = 0.03;
    this.reachRing.visible = false;
    this.group.add(this.reachRing);

    // Key turn waypoint nodes
    const wpGeo = new THREE.SphereGeometry(0.13, 10, 10);
    const wpMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.95,
    });
    this.waypointInstanced = new THREE.InstancedMesh(wpGeo, wpMat, MAX_WAYPOINT_MARKERS);
    this.waypointInstanced.count = 0;
    this.waypointInstanced.frustumCulled = false;
    this.group.add(this.waypointInstanced);
  }

  public update(
    path: TrajectoryPath | null,
    fighterPos: THREE.Vector3,
    isDrawing: boolean,
    isActiveExecution: boolean,
    time: number,
    dt: number
  ): void {
    if (!path || path.waypoints.length < 1) {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - dt * 5);
      if (this.fadeAlpha <= 0.01) {
        this.group.visible = false;
      }
      this.reachRing.visible = isDrawing;
      if (isDrawing) {
        this.group.visible = true;
        this.reachRing.position.set(fighterPos.x, 0.03, fighterPos.z);
        this.reachRingMat.opacity = 0.25;
      }
      return;
    }

    this.group.visible = true;
    const targetAlpha = isDrawing ? 1.0 : isActiveExecution ? 0.85 : 0.0;
    this.fadeAlpha = THREE.MathUtils.damp(this.fadeAlpha, targetAlpha, isDrawing ? 22 : 6, dt);

    if (this.fadeAlpha < 0.02 && !isDrawing && !isActiveExecution) {
      this.group.visible = false;
      return;
    }

    // Reach ring visible only while actively drawing
    this.reachRing.visible = isDrawing;
    if (isDrawing) {
      this.reachRing.position.set(fighterPos.x, 0.03, fighterPos.z);
      this.reachRingMat.opacity = 0.22;
    }

    const count = Math.min(path.waypoints.length, MAX_LINE_POINTS);
    for (let i = 0; i < count; i++) {
      const wp = path.waypoints[i].position;
      this.linePositions[i * 3] = wp.x;
      this.linePositions[i * 3 + 1] = wp.y;
      this.linePositions[i * 3 + 2] = wp.z;

      this.shadowPositions[i * 3] = wp.x;
      this.shadowPositions[i * 3 + 1] = 0.04;
      this.shadowPositions[i * 3 + 2] = wp.z;
    }
    this.lineGeo.attributes.position.needsUpdate = true;
    this.lineGeo.setDrawRange(0, count);
    this.shadowGeo.attributes.position.needsUpdate = true;
    this.shadowGeo.setDrawRange(0, count);

    this.lineMat.opacity = (path.validated ? 0.92 : 0.78) * this.fadeAlpha;
    this.shadowMat.opacity = 0.3 * this.fadeAlpha;

    // Start marker
    const first = path.waypoints[0].position;
    this.startMarker.visible = count >= 1;
    this.startMarker.position.copy(first);
    (this.startMarker.material as THREE.MeshBasicMaterial).opacity = 0.85 * this.fadeAlpha;

    // End marker
    const last = path.waypoints[count - 1].position;
    this.endMarkerGroup.visible = count >= 2;
    this.endMarkerGroup.position.set(last.x, 0, last.z);
    const pulseScale = 1 + Math.sin(time * 7) * 0.08;
    this.endMarkerGroup.scale.set(pulseScale, 1, pulseScale);
    this.endRingMat.opacity = (path.validated ? 0.9 : 0.65) * this.fadeAlpha;
    this.endCoreMat.opacity = 0.95 * this.fadeAlpha;

    // Key intermediate turn waypoints
    let wpCount = 0;
    for (let i = 1; i < count - 1 && wpCount < MAX_WAYPOINT_MARKERS; i++) {
      const wp = path.waypoints[i];
      if (wp.isKeyTurn) {
        this.waypointDummy.position.copy(wp.position);
        const passed = path.validated && i <= path.currentSegmentIndex;
        const s = passed ? 0.55 : 1.0;
        this.waypointDummy.scale.setScalar(s);
        this.waypointDummy.updateMatrix();
        this.waypointInstanced.setMatrixAt(wpCount, this.waypointDummy.matrix);
        wpCount++;
      }
    }
    this.waypointInstanced.count = wpCount;
    this.waypointInstanced.instanceMatrix.needsUpdate = true;
    (this.waypointInstanced.material as THREE.MeshBasicMaterial).opacity = 0.92 * this.fadeAlpha;
  }

  public dispose(): void {
    this.lineGeo.dispose();
    this.lineMat.dispose();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    this.startMarker.geometry.dispose();
    (this.startMarker.material as THREE.Material).dispose();
    this.reachRing.geometry.dispose();
    this.reachRingMat.dispose();
    this.waypointInstanced.geometry.dispose();
    (this.waypointInstanced.material as THREE.Material).dispose();
  }
}

/**
 * Pure Trajectory Math & Waypoint Traversal Logic (independent of character controller).
 */
export function clampPointToCombatSpace(
  point: THREE.Vector3,
  fighterAnchor: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  out.copy(point);
  out.y = WEAPON_COMBAT_HEIGHT;

  // 1. Clamp radially from fighter anchor so chain reach stays physically coherent
  const dx = out.x - fighterAnchor.x;
  const dz = out.z - fighterAnchor.z;
  const distFromFighter = Math.hypot(dx, dz);
  if (distFromFighter > MAX_CHAIN_REACH) {
    const scale = MAX_CHAIN_REACH / distFromFighter;
    out.x = fighterAnchor.x + dx * scale;
    out.z = fighterAnchor.z + dz * scale;
  }

  // 2. Clamp inside circular arena boundary
  const arenaDist = Math.hypot(out.x, out.z);
  const maxArena = ARENA_RADIUS - 0.45;
  if (arenaDist > maxArena) {
    const scale = maxArena / arenaDist;
    out.x *= scale;
    out.z *= scale;
  }

  return out;
}

export function createTrajectory(startPos: THREE.Vector3): TrajectoryPath {
  return {
    waypoints: [
      {
        position: startPos.clone().setY(WEAPON_COMBAT_HEIGHT),
        isKeyTurn: false,
        cumulativeDistance: 0,
      },
    ],
    totalLength: 0,
    validated: false,
    currentSegmentIndex: 0,
    segmentProgress: 0,
    distanceTraveled: 0,
  };
}

export function appendTrajectoryPoint(
  path: TrajectoryPath,
  rawWorldPoint: THREE.Vector3,
  fighterAnchor: THREE.Vector3
): boolean {
  if (path.validated || path.waypoints.length >= MAX_LINE_POINTS) {
    return false;
  }

  const clamped = clampPointToCombatSpace(rawWorldPoint, fighterAnchor, _tmpVec);
  const lastWp = path.waypoints[path.waypoints.length - 1];
  const segDist = clamped.distanceTo(lastWp.position);

  if (segDist < SAMPLE_POINT_STEP) {
    return false;
  }

  // Respect max cumulative path length (allows rich curves & loops without infinite paths)
  let nextPos = clamped.clone();
  let actualSegDist = segDist;
  if (path.totalLength + segDist > MAX_TRAJECTORY_LENGTH) {
    const remaining = MAX_TRAJECTORY_LENGTH - path.totalLength;
    if (remaining < 0.25) return false;
    nextPos = lastWp.position
      .clone()
      .lerp(clamped, remaining / segDist);
    nextPos.y = WEAPON_COMBAT_HEIGHT;
    actualSegDist = remaining;
  }

  // Detect sharp turn / direction change to mark key waypoint
  if (path.waypoints.length >= 2) {
    const prevWp = path.waypoints[path.waypoints.length - 2];
    _prevDir.subVectors(lastWp.position, prevWp.position).normalize();
    _newDir.subVectors(nextPos, lastWp.position).normalize();
    const dot = THREE.MathUtils.clamp(_prevDir.dot(_newDir), -1, 1);
    const angle = Math.acos(dot);
    if (angle >= TURN_ANGLE_THRESHOLD_RAD) {
      lastWp.isKeyTurn = true;
    }
  }

  path.totalLength += actualSegDist;
  path.waypoints.push({
    position: nextPos,
    isKeyTurn: false,
    cumulativeDistance: path.totalLength,
  });

  return true;
}

export function validateTrajectory(path: TrajectoryPath): boolean {
  if (path.waypoints.length < 2 || path.totalLength < MIN_TRAJECTORY_LENGTH) {
    return false;
  }
  path.validated = true;
  path.currentSegmentIndex = 0;
  path.segmentProgress = 0;
  path.distanceTraveled = 0;
  return true;
}

export interface TraversalStepResult {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  reachedWaypoints: number;
  finished: boolean;
}

/**
 * Advances along the exact ordered waypoints A -> B -> C -> D -> E at controlled speed.
 * Guarantees no intermediate waypoint is ever skipped.
 */
export function advanceAlongTrajectory(
  path: TrajectoryPath,
  speed: number,
  dt: number,
  outPos: THREE.Vector3,
  outTangent: THREE.Vector3
): TraversalStepResult {
  const wps = path.waypoints;
  if (wps.length < 2) {
    outPos.copy(wps[0].position);
    outTangent.set(0, 0, 1);
    return {
      position: outPos,
      tangent: outTangent,
      reachedWaypoints: 0,
      finished: true,
    };
  }

  let remainingDist = speed * dt;
  let reachedWaypoints = 0;

  while (remainingDist > 0 && path.currentSegmentIndex < wps.length - 1) {
    const a = wps[path.currentSegmentIndex].position;
    const b = wps[path.currentSegmentIndex + 1].position;
    const segLen = Math.max(0.0001, a.distanceTo(b));
    const distLeftInSeg = segLen * (1 - path.segmentProgress);

    if (remainingDist >= distLeftInSeg) {
      remainingDist -= distLeftInSeg;
      path.distanceTraveled += distLeftInSeg;
      path.currentSegmentIndex++;
      path.segmentProgress = 0;
      reachedWaypoints++;
    } else {
      path.segmentProgress += remainingDist / segLen;
      path.distanceTraveled += remainingDist;
      remainingDist = 0;
    }
  }

  if (path.currentSegmentIndex >= wps.length - 1) {
    const lastIdx = wps.length - 1;
    outPos.copy(wps[lastIdx].position);
    outTangent.subVectors(wps[lastIdx].position, wps[lastIdx - 1].position).normalize();
    return {
      position: outPos,
      tangent: outTangent,
      reachedWaypoints,
      finished: true,
    };
  }

  const a = wps[path.currentSegmentIndex].position;
  const b = wps[path.currentSegmentIndex + 1].position;
  outPos.lerpVectors(a, b, path.segmentProgress);
  outTangent.subVectors(b, a).normalize();

  return {
    position: outPos,
    tangent: outTangent,
    reachedWaypoints,
    finished: false,
  };
}

/**
 * Computes the fighter's ground-projected follow destination from the completed weapon trajectory.
 * Resets traversal index so the fighter follows the exact same ordered path!
 */
export function prepareFighterFollowPath(
  weaponPath: TrajectoryPath,
  fighterStartPos: THREE.Vector3
): TrajectoryPath {
  const wps: TrajectoryWaypoint[] = [];
  let cumDist = 0;

  const startGround = new THREE.Vector3(fighterStartPos.x, 0, fighterStartPos.z);
  wps.push({
    position: startGround,
    isKeyTurn: false,
    cumulativeDistance: 0,
  });

  // Follow the drawn path waypoints on the ground plane
  for (let i = 1; i < weaponPath.waypoints.length; i++) {
    const src = weaponPath.waypoints[i];
    const groundPt = new THREE.Vector3(src.position.x, 0, src.position.z);

    // Clamp inside safe fighter arena bounds
    const r = Math.hypot(groundPt.x, groundPt.z);
    const maxR = ARENA_RADIUS - FIGHTER_RADIUS - 0.15;
    if (r > maxR) {
      groundPt.x *= maxR / r;
      groundPt.z *= maxR / r;
    }

    const prev = wps[wps.length - 1].position;
    const d = prev.distanceTo(groundPt);
    if (d > 0.15 || i === weaponPath.waypoints.length - 1) {
      cumDist += d;
      wps.push({
        position: groundPt,
        isKeyTurn: src.isKeyTurn,
        cumulativeDistance: cumDist,
      });
    }
  }

  return {
    waypoints: wps,
    totalLength: cumDist,
    validated: true,
    currentSegmentIndex: 0,
    segmentProgress: 0,
    distanceTraveled: 0,
  };
}
