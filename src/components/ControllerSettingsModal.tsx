import React, { useEffect, useState } from 'react';
import { Gamepad2, RotateCcw, ArrowLeftRight, X, Check } from 'lucide-react';
import { formatGamepadButton, GamepadManager } from '../game/gamepad';
import {
  GamepadAction,
  GamepadBindings,
  GamepadSnapshot,
  InputSourceSelection,
} from '../game/types';

interface ControllerSettingsModalProps {
  gamepadManager: GamepadManager;
  snapshot: GamepadSnapshot;
  onClose: () => void;
}

const ACTION_ROWS: { action: GamepadAction; label: string; hint: string }[] = [
  { action: 'draw', label: 'Tracer & lancer l’arme', hint: 'Maintenir pour tracer, relâcher pour lancer' },
  { action: 'guard', label: 'Garde / Parade', hint: 'Maintenir pour bloquer (parade au début)' },
  { action: 'dodge', label: 'Esquive', hint: 'Pas rapide directionnel avec invulnérabilité' },
  { action: 'cancel', label: 'Annuler le tracé', hint: 'Annule la trajectoire en cours' },
  { action: 'pause', label: 'Pause / Menu', hint: 'Met le combat en pause' },
];

type ListeningState =
  | { kind: 'assign_player'; playerId: 1 | 2 }
  | { kind: 'remap_button'; playerId: 1 | 2; action: GamepadAction }
  | null;

export const ControllerSettingsModal: React.FC<ControllerSettingsModalProps> = ({
  gamepadManager,
  snapshot,
  onClose,
}) => {
  const [selectedTab, setSelectedTab] = useState<1 | 2>(1);
  const [listening, setListening] = useState<ListeningState>(null);

  const { connected, settings, resolved } = snapshot;
  const activeBindings: GamepadBindings =
    selectedTab === 1 ? settings.p1Bindings : settings.p2Bindings;
  const activePadIndex =
    selectedTab === 1 ? resolved.p1GamepadIndex : resolved.p2GamepadIndex;

  // Poll raw gamepad presses while modal is open for interactive console assignment / remapping
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      if (listening) {
        const targetIndex =
          listening.kind === 'remap_button' ? activePadIndex : null;
        const press = gamepadManager.detectFreshButtonPress(targetIndex);
        if (press) {
          if (listening.kind === 'assign_player') {
            gamepadManager.setManualSource(listening.playerId, {
              type: 'gamepad',
              index: press.padIndex,
            });
          } else {
            gamepadManager.updatePlayerBinding(
              listening.playerId,
              listening.action,
              press.buttonIndex
            );
          }
          setListening(null);
        }
      } else {
        // Refresh connected activity snapshot smoothly
        gamepadManager.pollFrames();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gamepadManager, listening, activePadIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (listening) setListening(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listening, onClose]);

  const handleSourceChange = (playerId: 1 | 2, val: string) => {
    let source: InputSourceSelection = { type: 'auto' };
    if (val === 'keyboard_mouse') source = { type: 'keyboard_mouse' };
    else if (val.startsWith('pad:')) {
      source = { type: 'gamepad', index: Number(val.slice(4)) };
    }
    gamepadManager.setManualSource(playerId, source);
  };

  const getCurrentSelectValue = (playerId: 1 | 2): string => {
    if (settings.assignmentMode === 'auto') return 'auto';
    const src = playerId === 1 ? settings.p1ManualSource : settings.p2ManualSource;
    if (src.type === 'keyboard_mouse') return 'keyboard_mouse';
    if (src.type === 'gamepad') return `pad:${src.index}`;
    return 'auto';
  };

  const formatAssignedLabel = (playerId: 1 | 2): string => {
    const padIdx = playerId === 1 ? resolved.p1GamepadIndex : resolved.p2GamepadIndex;
    const pad = connected.find((c) => c.index === padIdx);
    if (pad) return pad.shortName;
    return playerId === 1 ? 'Souris + Clavier' : 'Clavier J2 (Flèches / IJKL)';
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-[#060910]/90">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0e131d] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                Configuration des manettes Xbox &amp; compatibles
              </h2>
              <p className="text-xs text-slate-400">
                Détection automatique à l’entrée · Attribution manuelle par joueur et mappage personnalisé
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Connected Controllers Detection Bar */}
          <div className="bg-[#090d16] border border-slate-800 rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="text-xs font-semibold text-slate-300">
                Manettes détectées ({connected.length})
              </div>
              <div className="text-xs text-slate-400">
                {connected.length === 0
                  ? 'Branchez une manette Xbox / USB / Bluetooth et appuyez sur A pour l’activer.'
                  : 'Attribution prête pour 1 ou 2 joueurs.'}
              </div>
            </div>

            {connected.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {connected.map((pad) => {
                  const owner =
                    resolved.p1GamepadIndex === pad.index
                      ? 'Joueur 1'
                      : resolved.p2GamepadIndex === pad.index
                      ? 'Joueur 2'
                      : 'Non assignée';
                  return (
                    <div
                      key={pad.index}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-900/90 border border-slate-800 rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {pad.shortName}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums truncate">
                          Slot #{pad.index + 1} · {pad.buttonCount} boutons
                          {pad.lastPressedButton !== null
                            ? ` · Dernier : ${formatGamepadButton(pad.lastPressedButton)}`
                            : ''}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                          owner === 'Joueur 1'
                            ? 'text-cyan-400'
                            : owner === 'Joueur 2'
                            ? 'text-orange-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {owner}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assignment Mode: Auto vs Manual */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-300">
                  Mode d’attribution des joueurs
                </div>
                <div className="text-xs text-slate-400">
                  Automatique attribue la 1re manette à J1 et la 2e à J2 dès leur connexion.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => gamepadManager.setAssignmentMode('auto')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      settings.assignmentMode === 'auto'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Automatique
                  </button>
                  <button
                    type="button"
                    onClick={() => gamepadManager.setAssignmentMode('manual')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      settings.assignmentMode === 'manual'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Manuel
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => gamepadManager.swapPlayers()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Échanger J1 ↔ J2</span>
                </button>
              </div>
            </div>

            {/* Per-Player Assignment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([1, 2] as const).map((pid) => {
                const isAssignListening =
                  listening?.kind === 'assign_player' && listening.playerId === pid;
                const accentBorder =
                  pid === 1 ? 'border-cyan-500/40' : 'border-orange-500/40';
                const accentText = pid === 1 ? 'text-cyan-400' : 'text-orange-400';

                return (
                  <div
                    key={pid}
                    className={`bg-[#090d16] border ${accentBorder} rounded-lg p-4 space-y-3`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-display text-sm font-bold ${accentText}`}>
                        Joueur {pid}
                      </span>
                      <span className="text-xs text-slate-300 truncate">
                        Actif : {formatAssignedLabel(pid)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={getCurrentSelectValue(pid)}
                        onChange={(e) => handleSourceChange(pid, e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="auto">Automatique</option>
                        <option value="keyboard_mouse">
                          {pid === 1 ? 'Souris + Clavier' : 'Clavier J2 (Flèches / IJKL)'}
                        </option>
                        {connected.map((pad) => (
                          <option key={pad.index} value={`pad:${pad.index}`}>
                            {pad.shortName} (Slot #{pad.index + 1})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          setListening(
                            isAssignListening
                              ? null
                              : { kind: 'assign_player', playerId: pid }
                          )
                        }
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isAssignListening
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {isAssignListening ? 'Appuyez sur manette…' : 'Détecter par bouton'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-Player Button Remapping & Options */}
          <div className="border-t border-slate-800 pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setListening(null);
                    setSelectedTab(1);
                  }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    selectedTab === 1
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Commandes Joueur 1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setListening(null);
                    setSelectedTab(2);
                  }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    selectedTab === 2
                      ? 'bg-orange-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Commandes Joueur 2
                </button>
              </div>

              <button
                type="button"
                onClick={() => gamepadManager.resetToDefaults()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Button Bindings List */}
              <div className="lg:col-span-7 space-y-2">
                {ACTION_ROWS.map((row) => {
                  const isWaiting =
                    listening?.kind === 'remap_button' &&
                    listening.playerId === selectedTab &&
                    listening.action === row.action;
                  const currentBtn = activeBindings[row.action];

                  return (
                    <div
                      key={row.action}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#090d16] border border-slate-800 rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">
                          {row.label}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {row.hint}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setListening(
                            isWaiting
                              ? null
                              : {
                                  kind: 'remap_button',
                                  playerId: selectedTab,
                                  action: row.action,
                                }
                          )
                        }
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isWaiting
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-800 text-slate-100 border-slate-700 hover:border-cyan-400'
                        }`}
                      >
                        {isWaiting
                          ? 'Appuyez sur un bouton…'
                          : formatGamepadButton(currentBtn)}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Stick, Sensitivity & Vibration */}
              <div className="lg:col-span-5 bg-[#090d16] border border-slate-800 rounded-lg p-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2">
                    Stick de tracé de trajectoire
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['left', 'right'] as const).map((stick) => (
                      <button
                        key={stick}
                        type="button"
                        onClick={() =>
                          gamepadManager.updatePlayerOptions(selectedTab, { stick })
                        }
                        className={`py-2 px-3 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                          activeBindings.stick === stick
                            ? 'bg-slate-800 border-cyan-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {stick === 'left' ? 'Stick Gauche' : 'Stick Droit'}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    La croix directionnelle (D-Pad) reste utilisable en secours.
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-300">
                      Sensibilité du viseur 3D
                    </span>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {activeBindings.sensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.8}
                    step={0.1}
                    value={activeBindings.sensitivity}
                    onChange={(e) =>
                      gamepadManager.updatePlayerOptions(selectedTab, {
                        sensitivity: Number(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-xs font-semibold text-slate-300">
                      Vibrations (Rumble)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Impacts, parades et chocs d’armes
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !activeBindings.vibration;
                      gamepadManager.updatePlayerOptions(selectedTab, { vibration: next });
                      if (next) gamepadManager.rumble(selectedTab, 0.5, 0.5, 160);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                      activeBindings.vibration
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {activeBindings.vibration ? 'Activées' : 'Coupées'}
                  </button>
                </div>

                {activePadIndex !== null && (
                  <button
                    type="button"
                    onClick={() => gamepadManager.rumble(selectedTab, 0.7, 0.7, 220)}
                    className="w-full py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Tester la vibration (J{selectedTab})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0a0e16]">
          <div className="text-xs text-slate-400">
            Raccourcis Xbox par défaut : Stick Gauche (tracer) · RT / A (lancer) · LT / X (garde) · RB / B (esquive)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Valider</span>
          </button>
        </div>
      </div>
    </div>
  );
};
