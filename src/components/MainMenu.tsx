import React from 'react';
import { Swords, Users, Cpu, Volume2, VolumeX } from 'lucide-react';
import { AIDifficulty, GameConfig, GameMode } from '../game/types';

interface MainMenuProps {
  config: GameConfig;
  muted: boolean;
  onChangeConfig: (next: GameConfig) => void;
  onToggleMute: () => void;
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
  onChangeConfig,
  onToggleMute,
  onStartMatch,
}) => {
  const setMode = (mode: GameMode) => onChangeConfig({ ...config, mode });
  const setDifficulty = (difficulty: AIDifficulty) =>
    onChangeConfig({ ...config, difficulty });
  const setRounds = (roundsToWin: number) =>
    onChangeConfig({ ...config, roundsToWin });

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[#070a11]/75">
      <div className="w-full max-w-4xl bg-[#0e131d]/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800/90">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              CHAIN TRACE
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Combat 3D tactique à arme à chaînes · L’arme trace la voie, le combattant suit
            </p>
          </div>
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

        {/* Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-7">
          {/* Left Column: Mode & Match Setup */}
          <div className="lg:col-span-7 space-y-6">
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
                      Duel simultané sur le même ordinateur
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
                    Contrôles Joueur 1 (Cyan)
                  </div>
                  <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                    <div>Clic gauche glissé : Tracer &amp; lancer la trajectoire</div>
                    <div>Espace / Maj G : Garde (parade au démarrage)</div>
                    <div>E ou Q (+ ZQSD) : Esquive latérale</div>
                  </div>
                </div>

                {config.mode === 'local2p' && (
                  <div className="border-t border-slate-800/70 pt-2.5">
                    <div className="text-xs font-semibold text-orange-400">
                      Contrôles Joueur 2 (Orange)
                    </div>
                    <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                      <div>Flèches ou IJKL : Déplacer le viseur 3D</div>
                      <div>Maintenir Entrée / M / Pavé 0 : Tracer &amp; relâcher pour lancer</div>
                      <div>Maj D ou / : Garde · Point (.) ou O : Esquive</div>
                    </div>
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
