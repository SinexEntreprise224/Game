import React from 'react';
import { Swords, Users, Cpu, Volume2, VolumeX, Gamepad2 } from 'lucide-react';
import { formatGamepadButton } from '../game/gamepad';
import { AIDifficulty, GameConfig, GameMode, GamepadSnapshot } from '../game/types';

interface MainMenuProps {
  config: GameConfig;
  muted: boolean;
  gamepadSnapshot: GamepadSnapshot;
  onChangeConfig: (next: GameConfig) => void;
  onToggleMute: () => void;
  onOpenControllerSettings: () => void;
  onStartMatch: () => void;
}

const DIFFICULTY_OPTIONS: { value: AIDifficulty; label: string; desc: string }[] = [
  {
    value: 'easy',
    label: 'Facile',
    desc: 'Trajectoires simples et ouvertures fréquentes.',
  },
  {
    value: 'normal',
    label: 'Normal',
    desc: 'Attaques variées, garde active et repositionnement.',
  },
  {
    value: 'hard',
    label: 'Difficile',
    desc: 'Feintes, boucles tactiques, parades et contre-attaques.',
  },
];

export const MainMenu: React.FC<MainMenuProps> = ({
  config,
  muted,
  gamepadSnapshot,
  onChangeConfig,
  onToggleMute,
  onOpenControllerSettings,
  onStartMatch,
}) => {
  const setMode = (mode: GameMode) => onChangeConfig({ ...config, mode });
  const setDifficulty = (difficulty: AIDifficulty) =>
    onChangeConfig({ ...config, difficulty });
  const setRounds = (roundsToWin: number) =>
    onChangeConfig({ ...config, roundsToWin });

  const { connected, resolved, settings } = gamepadSnapshot;
  const p1Pad = connected.find((c) => c.index === resolved.p1GamepadIndex);
  const p2Pad = connected.find((c) => c.index === resolved.p2GamepadIndex);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[#070a11]/75">
      <div className="w-full max-w-4xl bg-[#0e131d]/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-5 border-b border-slate-800/90">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              CHAIN TRACE
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Combat 3D tactique à arme à chaînes · L’arme trace la voie, le combattant suit
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenControllerSettings}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-100 bg-slate-900 border border-slate-700/90 rounded-lg hover:bg-slate-800 hover:border-cyan-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4 text-cyan-400" />
              <span>
                Manettes ({connected.length})
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Activer le son' : 'Couper le son'}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700/80 rounded-lg hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{muted ? 'Son coupé' : 'Audio actif'}</span>
            </button>
          </div>
        </div>

        {/* Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-7">
          {/* Left Column: Mode & Match Setup */}
          <div className="lg:col-span-7 space-y-5">
            {/* Game Mode */}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2.5">
                Mode de jeu
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('ai')}
                  className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                    config.mode === 'ai'
                      ? 'bg-cyan-950/50 border-cyan-500 text-white'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Cpu
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      config.mode === 'ai' ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-sm">1 Joueur vs IA</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Affrontez l’intelligence artificielle en arène
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('local2p')}
                  className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                    config.mode === 'local2p'
                      ? 'bg-orange-950/45 border-orange-500 text-white'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Users
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      config.mode === 'local2p' ? 'text-orange-400' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-sm">2 Joueurs Local</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Duel à 2 manettes ou clavier + manette
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* AI Difficulty (shown when AI mode selected) */}
            {config.mode === 'ai' && (
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2.5">
                  Difficulté de l’IA
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {DIFFICULTY_OPTIONS.map((opt) => {
                    const active = config.difficulty === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDifficulty(opt.value)}
                        className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-800 border-cyan-500 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rounds */}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2.5">
                Format des manches
              </div>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRounds(2)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.roundsToWin === 2
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  2 manches gagnantes (BO3)
                </button>
                <button
                  type="button"
                  onClick={() => setRounds(3)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.roundsToWin === 3
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  3 manches gagnantes (BO5)
                </button>
              </div>
            </div>

            {/* Automatic / Manual Controller Status Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#090d16] border border-slate-800/90 rounded-lg px-4 py-3 text-xs">
              <div className="space-y-0.5 min-w-0">
                <div className="text-slate-300 font-medium">
                  Attribution ({settings.assignmentMode === 'auto' ? 'Automatique' : 'Manuelle'})
                </div>
                <div className="text-slate-400 truncate">
                  <span className="text-cyan-400 font-semibold">J1 :</span>{' '}
                  {p1Pad ? p1Pad.shortName : 'Souris + Clavier'}
                  {config.mode === 'local2p' && (
                    <>
                      {' · '}
                      <span className="text-orange-400 font-semibold">J2 :</span>{' '}
                      {p2Pad ? p2Pad.shortName : 'Clavier J2'}
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenControllerSettings}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Configurer manuellement
              </button>
            </div>
          </div>

          {/* Right Column: Core Rule & Controls */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#0a0e16] border border-slate-800/80 rounded-lg p-5 space-y-5">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-cyan-400 mb-1.5">
                  Règle fondamentale : Arme puis Combattant
                </div>
                <ol className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <li>1. Maintenez pour tracer librement courbes, virages ou boucles en 3D.</li>
                  <li>2. Relâchez : l’arme parcourt chaque point pendant que votre combattant reste immobile.</li>
                  <li>3. Une fois l’arme arrivée, votre combattant fonce le long de la trajectoire.</li>
                </ol>
              </div>

              <div className="border-t border-slate-800/90 pt-3.5 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-cyan-400">
                    Contrôles Joueur 1 ({p1Pad ? 'Manette Xbox / Compatible' : 'Souris + Clavier'})
                  </div>
                  {p1Pad ? (
                    <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                      <div>
                        {settings.p1Bindings.stick === 'left' ? 'Stick Gauche' : 'Stick Droit'} : Viseur 3D
                      </div>
                      <div>
                        Maintenir {formatGamepadButton(settings.p1Bindings.draw)}
                        {settings.p1Bindings.drawAlt >= 0 ? ` / ${formatGamepadButton(settings.p1Bindings.drawAlt)}` : ''} : Tracer &amp; lancer
                      </div>
                      <div>
                        {formatGamepadButton(settings.p1Bindings.guard)}
                        {settings.p1Bindings.guardAlt >= 0 ? ` / ${formatGamepadButton(settings.p1Bindings.guardAlt)}` : ''} : Garde · {formatGamepadButton(settings.p1Bindings.dodge)}
                        {settings.p1Bindings.dodgeAlt >= 0 ? ` / ${formatGamepadButton(settings.p1Bindings.dodgeAlt)}` : ''} : Esquive
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                      <div>Clic gauche glissé : Tracer &amp; lancer la trajectoire</div>
                      <div>Espace / Maj G : Garde (parade au démarrage)</div>
                      <div>E ou Q (+ ZQSD) : Esquive latérale</div>
                    </div>
                  )}
                </div>

                {config.mode === 'local2p' && (
                  <div className="border-t border-slate-800/70 pt-2.5">
                    <div className="text-xs font-semibold text-orange-400">
                      Contrôles Joueur 2 ({p2Pad ? 'Manette Xbox / Compatible' : 'Clavier J2'})
                    </div>
                    {p2Pad ? (
                      <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                        <div>
                          {settings.p2Bindings.stick === 'left' ? 'Stick Gauche' : 'Stick Droit'} : Viseur 3D
                        </div>
                        <div>
                          Maintenir {formatGamepadButton(settings.p2Bindings.draw)}
                          {settings.p2Bindings.drawAlt >= 0 ? ` / ${formatGamepadButton(settings.p2Bindings.drawAlt)}` : ''} : Tracer &amp; lancer
                        </div>
                        <div>
                          {formatGamepadButton(settings.p2Bindings.guard)}
                          {settings.p2Bindings.guardAlt >= 0 ? ` / ${formatGamepadButton(settings.p2Bindings.guardAlt)}` : ''} : Garde · {formatGamepadButton(settings.p2Bindings.dodge)}
                          {settings.p2Bindings.dodgeAlt >= 0 ? ` / ${formatGamepadButton(settings.p2Bindings.dodgeAlt)}` : ''} : Esquive
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                        <div>Flèches ou IJKL : Déplacer le viseur 3D</div>
                        <div>Maintenir Entrée / M / Pavé 0 : Tracer &amp; lancer</div>
                        <div>Maj D ou / : Garde · Point (.) ou O : Esquive</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onStartMatch}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>Lancer le combat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
