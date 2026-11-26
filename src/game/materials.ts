import * as THREE from 'three';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createArenaFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Deep obsidian slate radial gradient
  const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.52);
  grad.addColorStop(0, '#161b26');
  grad.addColorStop(0.55, '#10141d');
  grad.addColorStop(0.92, '#0b0e15');
  grad.addColorStop(1, '#07090e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle brushed metal / stone micro-grain
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 64; i++) {
    const y = (i / 64) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let i = 0; i < 64; i++) {
    const x = (i / 64) * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  // Concentric tactical combat rings
  const rings = [0.14, 0.28, 0.42, 0.48];
  rings.forEach((ratio, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, size * ratio, 0, Math.PI * 2);
    ctx.strokeStyle =
      idx === rings.length - 1
        ? 'rgba(249, 115, 22, 0.35)'
        : 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = idx === rings.length - 1 ? 4 : 2;
    ctx.stroke();
  });

  // Radial sector lines (8 sectors)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * size * 0.14, cy + Math.sin(angle) * size * 0.14);
    ctx.lineTo(cx + Math.cos(angle) * size * 0.48, cy + Math.sin(angle) * size * 0.48);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Center duel emblem
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.05, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBrushedSteelNormalNoise(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const streak = Math.sin(y * 0.7) * 14;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const v = Math.max(0, Math.min(255, Math.round(180 + streak + (Math.random() - 0.5) * 16)));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  return tex;
}
