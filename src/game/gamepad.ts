import {
  ConnectedGamepadInfo,
  ControllerSettings,
  GamepadAction,
  GamepadBindings,
  GamepadSnapshot,
  InputSourceSelection,
  ResolvedPlayerInput,
} from './types';

const STORAGE_KEY = 'chain_trace_controller_settings_v1';
const STICK_DEADZONE = 0.18;
const TRIGGER_THRESHOLD = 0.35;

export const XBOX_BUTTON_LABELS: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'View',
  9: 'Menu',
  10: 'LS',
  11: 'RS',
  12: 'Haut',
  13: 'Bas',
  14: 'Gauche',
  15: 'Droite',
  16: 'Guide',
};

export function formatGamepadButton(index: number): string {
  return XBOX_BUTTON_LABELS[index] ?? `Btn ${index}`;
}

export function createDefaultBindings(): GamepadBindings {
  return {
    draw: 7, // RT
    drawAlt: 0, // A
    guard: 6, // LT
    guardAlt: 2, // X
    dodge: 5, // RB
    dodgeAlt: 1, // B
    cancel: 3, // Y
    pause: 9, // Menu / Start
    stick: 'left',
    sensitivity: 1.0,
    vibration: true,
  };
}

export function createDefaultControllerSettings(): ControllerSettings {
  return {
    assignmentMode: 'auto',
    p1ManualSource: { type: 'auto' },
    p2ManualSource: { type: 'auto' },
    p1Bindings: createDefaultBindings(),
    p2Bindings: createDefaultBindings(),
  };
}

export interface PlayerGamepadFrame {
  connected: boolean;
  aimX: number;
  aimY: number;
  drawHeld: boolean;
  drawJustPressed: boolean;
  drawJustReleased: boolean;
  guardHeld: boolean;
  dodgeJustPressed: boolean;
  cancelJustPressed: boolean;
  pauseJustPressed: boolean;
}

const EMPTY_FRAME: PlayerGamepadFrame = {
  connected: false,
  aimX: 0,
  aimY: 0,
  drawHeld: false,
  drawJustPressed: false,
  drawJustReleased: false,
  guardHeld: false,
  dodgeJustPressed: false,
  cancelJustPressed: false,
  pauseJustPressed: false,
};

function shortenGamepadName(rawId: string, index: number): string {
  const lower = rawId.toLowerCase();
  if (lower.includes('xbox')) {
    if (lower.includes('series') || lower.includes('1914')) return `Manette Xbox Series (${index + 1})`;
    if (lower.includes('360')) return `Manette Xbox 360 (${index + 1})`;
    return `Manette Xbox (${index + 1})`;
  }
  if (lower.includes('xinput')) return `Manette XInput (${index + 1})`;
  if (lower.includes('dualsense') || lower.includes('054c') && lower.includes('0ce6')) {
    return `DualSense (${index + 1})`;
  }
  if (lower.includes('dualshock') || lower.includes('sony')) return `Manette PlayStation (${index + 1})`;
  if (lower.includes('nintendo') || lower.includes('pro controller')) return `Switch Pro (${index + 1})`;

  const cleaned = rawId.replace(/\s*\(STANDARD GAMEPAD.*?\)/i, '').trim();
  if (!cleaned) return `Manette ${index + 1}`;
  return cleaned.length > 28 ? `${cleaned.slice(0, 26)}…` : cleaned;
}

function isButtonPressed(pad: Gamepad, buttonIndex: number): boolean {
  if (buttonIndex < 0 || buttonIndex >= pad.buttons.length) return false;
  const btn = pad.buttons[buttonIndex];
  return btn.pressed || btn.value >= TRIGGER_THRESHOLD;
}

function applyRadialDeadzone(rawX: number, rawY: number): { x: number; y: number } {
  const mag = Math.hypot(rawX, rawY);
  if (mag < STICK_DEADZONE) return { x: 0, y: 0 };
  const clamped = Math.min(1, mag);
  const rescaled = (clamped - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return {
    x: (rawX / mag) * rescaled,
    y: (rawY / mag) * rescaled,
  };
}

export class GamepadManager {
  private settings: ControllerSettings;
  private readonly prevButtons = new Map<number, boolean[]>();
  private readonly lastActiveButton = new Map<number, number | null>();
  private readonly listeners = new Set<(snapshot: GamepadSnapshot) => void>();
  private lastConnectedSignature = '';

  constructor() {
    this.settings = this.loadSettings();
    window.addEventListener('gamepadconnected', this.handleGamepadEvent);
    window.addEventListener('gamepaddisconnected', this.handleGamepadEvent);
  }

  private loadSettings(): ControllerSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultControllerSettings();
      const parsed = JSON.parse(raw) as Partial<ControllerSettings>;
      const defaults = createDefaultControllerSettings();
      return {
        assignmentMode: parsed.assignmentMode === 'manual' ? 'manual' : 'auto',
        p1ManualSource: parsed.p1ManualSource ?? defaults.p1ManualSource,
        p2ManualSource: parsed.p2ManualSource ?? defaults.p2ManualSource,
        p1Bindings: { ...defaults.p1Bindings, ...(parsed.p1Bindings ?? {}) },
        p2Bindings: { ...defaults.p2Bindings, ...(parsed.p2Bindings ?? {}) },
      };
    } catch {
      return createDefaultControllerSettings();
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage quota errors
    }
  }

  private readonly handleGamepadEvent = () => {
    this.notifyListeners();
  };

  public subscribe(cb: (snapshot: GamepadSnapshot) => void): () => void {
    this.listeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public notifyListeners(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((cb) => cb(snap));
  }

  public getSettings(): ControllerSettings {
    return this.settings;
  }

  public updateSettings(next: ControllerSettings): void {
    this.settings = {
      ...next,
      p1Bindings: { ...next.p1Bindings },
      p2Bindings: { ...next.p2Bindings },
    };
    this.saveSettings();
    this.notifyListeners();
  }

  public setAssignmentMode(mode: 'auto' | 'manual'): void {
    this.settings = { ...this.settings, assignmentMode: mode };
    this.saveSettings();
    this.notifyListeners();
  }

  public setManualSource(playerId: 1 | 2, source: InputSourceSelection): void {
    if (playerId === 1) {
      this.settings = { ...this.settings, assignmentMode: 'manual', p1ManualSource: source };
    } else {
      this.settings = { ...this.settings, assignmentMode: 'manual', p2ManualSource: source };
    }
    this.saveSettings();
    this.notifyListeners();
  }

  public swapPlayers(): void {
    const res = this.resolveInputs();
    const p1Next: InputSourceSelection =
      res.p2GamepadIndex !== null
        ? { type: 'gamepad', index: res.p2GamepadIndex }
        : { type: 'keyboard_mouse' };
    const p2Next: InputSourceSelection =
      res.p1GamepadIndex !== null
        ? { type: 'gamepad', index: res.p1GamepadIndex }
        : { type: 'keyboard_mouse' };

    this.settings = {
      ...this.settings,
      assignmentMode: 'manual',
      p1ManualSource: p1Next,
      p2ManualSource: p2Next,
    };
    this.saveSettings();
    this.notifyListeners();
  }

  public updatePlayerBinding(
    playerId: 1 | 2,
    action: GamepadAction,
    buttonIndex: number
  ): void {
    const target = playerId === 1 ? { ...this.settings.p1Bindings } : { ...this.settings.p2Bindings };
    const previousButton = target[action];

    // Swap or clear any conflicting primary/alt binding on the same controller
    const primaryActions: GamepadAction[] = ['draw', 'guard', 'dodge', 'cancel', 'pause'];
    for (const other of primaryActions) {
      if (other !== action && target[other] === buttonIndex) {
        target[other] = previousButton;
      }
    }
    if (action !== 'draw' && target.drawAlt === buttonIndex) target.drawAlt = -1;
    if (action !== 'guard' && target.guardAlt === buttonIndex) target.guardAlt = -1;
    if (action !== 'dodge' && target.dodgeAlt === buttonIndex) target.dodgeAlt = -1;

    target[action] = buttonIndex;
    this.settings =
      playerId === 1
        ? { ...this.settings, p1Bindings: target }
        : { ...this.settings, p2Bindings: target };
    this.saveSettings();
    this.notifyListeners();
  }

  public updatePlayerOptions(
    playerId: 1 | 2,
    patch: Partial<Pick<GamepadBindings, 'stick' | 'sensitivity' | 'vibration'>>
  ): void {
    const target =
      playerId === 1
        ? { ...this.settings.p1Bindings, ...patch }
        : { ...this.settings.p2Bindings, ...patch };
    this.settings =
      playerId === 1
        ? { ...this.settings, p1Bindings: target }
        : { ...this.settings, p2Bindings: target };
    this.saveSettings();
    this.notifyListeners();
  }

  public resetToDefaults(): void {
    this.settings = createDefaultControllerSettings();
    this.saveSettings();
    this.notifyListeners();
  }

  private getRawConnectedPads(): Gamepad[] {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return [];
    }
    const list = navigator.getGamepads();
    const result: Gamepad[] = [];
    for (let i = 0; i < list.length; i++) {
      const pad = list[i];
      if (pad && pad.connected) {
        result.push(pad);
      }
    }
    return result;
  }

  public resolveInputs(): ResolvedPlayerInput {
    const pads = this.getRawConnectedPads();
    const availableIndices = new Set(pads.map((p) => p.index));

    if (this.settings.assignmentMode === 'auto') {
      const p1GamepadIndex = pads.length >= 1 ? pads[0].index : null;
      const p2GamepadIndex = pads.length >= 2 ? pads[1].index : null;
      return {
        p1GamepadIndex,
        p2GamepadIndex,
        p1UsesKeyboardMouse: true,
        p2UsesKeyboard: true,
      };
    }

    // Manual mode
    let p1GamepadIndex: number | null = null;
    if (this.settings.p1ManualSource.type === 'gamepad') {
      if (availableIndices.has(this.settings.p1ManualSource.index)) {
        p1GamepadIndex = this.settings.p1ManualSource.index;
      }
    } else if (this.settings.p1ManualSource.type === 'auto') {
      p1GamepadIndex = pads.length >= 1 ? pads[0].index : null;
    }

    let p2GamepadIndex: number | null = null;
    if (this.settings.p2ManualSource.type === 'gamepad') {
      if (availableIndices.has(this.settings.p2ManualSource.index)) {
        p2GamepadIndex = this.settings.p2ManualSource.index;
      }
    } else if (this.settings.p2ManualSource.type === 'auto') {
      const second = pads.find((p) => p.index !== p1GamepadIndex);
      p2GamepadIndex = second ? second.index : null;
    }

    const p1UsesKeyboardMouse = this.settings.p1ManualSource.type !== 'gamepad' || p1GamepadIndex === null;
    const p2UsesKeyboard = this.settings.p2ManualSource.type !== 'gamepad' || p2GamepadIndex === null;

    return {
      p1GamepadIndex,
      p2GamepadIndex,
      p1UsesKeyboardMouse,
      p2UsesKeyboard,
    };
  }

  public getSnapshot(): GamepadSnapshot {
    const pads = this.getRawConnectedPads();
    const connected: ConnectedGamepadInfo[] = pads.map((pad) => {
      let hasActivity = false;
      for (let b = 0; b < pad.buttons.length; b++) {
        if (isButtonPressed(pad, b)) {
          hasActivity = true;
          this.lastActiveButton.set(pad.index, b);
          break;
        }
      }
      if (!hasActivity && pad.axes.length >= 2) {
        const dz = applyRadialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
        if (dz.x !== 0 || dz.y !== 0) hasActivity = true;
      }
      return {
        index: pad.index,
        id: pad.id,
        shortName: shortenGamepadName(pad.id, pad.index),
        mapping: pad.mapping || 'standard',
        buttonCount: pad.buttons.length,
        axesCount: pad.axes.length,
        hasActivity,
        lastPressedButton: this.lastActiveButton.get(pad.index) ?? null,
      };
    });

    return {
      connected,
      settings: this.settings,
      resolved: this.resolveInputs(),
    };
  }

  /**
   * Checks for newly pressed button across either all pads or a specific pad index.
   * Used by the console-style interactive remapping / player assignment UI.
   */
  public detectFreshButtonPress(
    targetPadIndex: number | null = null
  ): { padIndex: number; buttonIndex: number } | null {
    const pads = this.getRawConnectedPads();
    for (const pad of pads) {
      if (targetPadIndex !== null && pad.index !== targetPadIndex) continue;
      const prev = this.prevButtons.get(pad.index) ?? [];
      for (let b = 0; b < pad.buttons.length; b++) {
        const now = isButtonPressed(pad, b);
        const was = prev[b] ?? false;
        if (now && !was) {
          this.commitPreviousButtons(pads);
          return { padIndex: pad.index, buttonIndex: b };
        }
      }
    }
    this.commitPreviousButtons(pads);
    return null;
  }

  /**
   * Polls all connected gamepads once per frame and returns processed state for P1 and P2.
   */
  public pollFrames(): { p1: PlayerGamepadFrame; p2: PlayerGamepadFrame } {
    const pads = this.getRawConnectedPads();
    const signature = pads.map((p) => `${p.index}:${p.id}`).join('|');
    if (signature !== this.lastConnectedSignature) {
      this.lastConnectedSignature = signature;
      this.notifyListeners();
    }

    const resolved = this.resolveInputs();
    const padByIndex = new Map<number, Gamepad>();
    pads.forEach((p) => padByIndex.set(p.index, p));

    const p1Pad = resolved.p1GamepadIndex !== null ? padByIndex.get(resolved.p1GamepadIndex) : undefined;
    const p2Pad = resolved.p2GamepadIndex !== null ? padByIndex.get(resolved.p2GamepadIndex) : undefined;

    const p1 = p1Pad ? this.buildPlayerFrame(p1Pad, this.settings.p1Bindings) : { ...EMPTY_FRAME };
    const p2 = p2Pad ? this.buildPlayerFrame(p2Pad, this.settings.p2Bindings) : { ...EMPTY_FRAME };

    this.commitPreviousButtons(pads);
    return { p1, p2 };
  }

  private buildPlayerFrame(pad: Gamepad, bindings: GamepadBindings): PlayerGamepadFrame {
    const prev = this.prevButtons.get(pad.index) ?? [];
    const curPressed = (idx: number) => isButtonPressed(pad, idx);
    const prevPressed = (idx: number) => prev[idx] ?? false;

    const axIdxX = bindings.stick === 'right' ? 2 : 0;
    const axIdxY = bindings.stick === 'right' ? 3 : 1;
    const rawX = pad.axes[axIdxX] ?? 0;
    const rawY = pad.axes[axIdxY] ?? 0;
    const stick = applyRadialDeadzone(rawX, rawY);

    let aimX = stick.x;
    let aimY = stick.y;

    // D-Pad steering fallback when stick is neutral
    if (aimX === 0 && aimY === 0) {
      const dUp = curPressed(12) ? -1 : 0;
      const dDown = curPressed(13) ? 1 : 0;
      const dLeft = curPressed(14) ? -1 : 0;
      const dRight = curPressed(15) ? 1 : 0;
      const dx = dLeft + dRight;
      const dy = dUp + dDown;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        aimX = dx / len;
        aimY = dy / len;
      }
    }

    const drawNow = curPressed(bindings.draw) || curPressed(bindings.drawAlt);
    const drawPrev = prevPressed(bindings.draw) || prevPressed(bindings.drawAlt);

    const guardNow = curPressed(bindings.guard) || curPressed(bindings.guardAlt);

    const dodgeNow = curPressed(bindings.dodge) || curPressed(bindings.dodgeAlt);
    const dodgePrev = prevPressed(bindings.dodge) || prevPressed(bindings.dodgeAlt);

    const cancelNow = curPressed(bindings.cancel);
    const cancelPrev = prevPressed(bindings.cancel);

    const pauseNow = curPressed(bindings.pause);
    const pausePrev = prevPressed(bindings.pause);

    return {
      connected: true,
      aimX,
      aimY,
      drawHeld: drawNow,
      drawJustPressed: drawNow && !drawPrev,
      drawJustReleased: !drawNow && drawPrev,
      guardHeld: guardNow,
      dodgeJustPressed: dodgeNow && !dodgePrev,
      cancelJustPressed: cancelNow && !cancelPrev,
      pauseJustPressed: pauseNow && !pausePrev,
    };
  }

  private commitPreviousButtons(pads: Gamepad[]): void {
    const activeSet = new Set<number>();
    for (const pad of pads) {
      activeSet.add(pad.index);
      const arr = this.prevButtons.get(pad.index) ?? [];
      arr.length = pad.buttons.length;
      for (let b = 0; b < pad.buttons.length; b++) {
        arr[b] = isButtonPressed(pad, b);
      }
      this.prevButtons.set(pad.index, arr);
    }
    for (const key of this.prevButtons.keys()) {
      if (!activeSet.has(key)) {
        this.prevButtons.delete(key);
        this.lastActiveButton.delete(key);
      }
    }
  }

  public rumble(
    playerId: 1 | 2,
    strongMagnitude: number,
    weakMagnitude: number,
    durationMs: number
  ): void {
    const bindings = playerId === 1 ? this.settings.p1Bindings : this.settings.p2Bindings;
    if (!bindings.vibration) return;

    const resolved = this.resolveInputs();
    const padIndex = playerId === 1 ? resolved.p1GamepadIndex : resolved.p2GamepadIndex;
    if (padIndex === null) return;

    const pads = this.getRawConnectedPads();
    const pad = pads.find((p) => p.index === padIndex);
    if (!pad) return;

    const actuator = (pad as Gamepad & {
      vibrationActuator?: {
        playEffect?: (
          type: string,
          params: {
            startDelay?: number;
            duration: number;
            weakMagnitude: number;
            strongMagnitude: number;
          }
        ) => Promise<void>;
      };
    }).vibrationActuator;

    if (actuator && typeof actuator.playEffect === 'function') {
      actuator
        .playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: Math.min(1, Math.max(0, weakMagnitude)),
          strongMagnitude: Math.min(1, Math.max(0, strongMagnitude)),
        })
        .catch(() => {});
    }
  }

  public dispose(): void {
    window.removeEventListener('gamepadconnected', this.handleGamepadEvent);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadEvent);
    this.listeners.clear();
  }
}
