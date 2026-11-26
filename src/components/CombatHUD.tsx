import React from 'react';
import { Pause, Play, RotateCcw, Home, Volume2, VolumeX } from 'lucide-react';
import { FighterHUDState, MatchHUDState } from '../game/types';

interface CombatHUDProps {
  hud: MatchHUDState;
  muted: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onReturnMenu: () => void;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  normal: 'Normal',
  hard: 'Difficile',
};

const FighterStatusPanel: React.FC<{
  fighter: FighterHUDState;
  roundsToWin: number;
  align: 'left' | 'right';
}> = ({ fighter, roundsToWin, align }) => {
  const isLeft = align === 'left';
  const hpPercent = Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100));
  const stamPercent = Math.max(0, Math.min(100, (fighter.stamina / fighter.maxStamina) * 100));
  const accentBar = isLeft ? 'bg-cyan-400' : 'bg-orange-500';
  const accentText = isLeft ? 'text-cyan-400' : 'text-orange-400';

  return (
    <div className={`flex-1 max-w-md ${isLeft ? 'text-left' : 'text-right'}`}>
      {/* Name & Rounds Won */}
      <div
        className={`flex items-center justify-between gap-3 mb-1.5 ${
          isLeft ? 'flex-row' : 'flex-row-reverse'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`font-display text-sm sm:text-base font-bold truncate ${accentText}`}>
            {fighter.name}
          </span>
          <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
            {fighter.hp}/{fighter.maxHp} PV
          </span>
        </div>

        {/* Round pips */}
        <div className="flex items-center gap-1.5 shrink-0" aria-label={`Manches gagnées: ${fighter.roundsWon}`}>
          {Array.from({ length: roundsToWin }).map((_, idx) => (
            <span
              key={idx}
              className={`w-3 h-2 rounded-xs border ${
                idx < fighter.roundsWon
                  ? isLeft
                    ? 'bg-cyan-400 border-cyan-300'
                    : 'bg-orange-400 border-orange-300'
                  : 'bg-slate-900 border-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Health Bar */}
      <div className="w-full h-3.5 bg-slate-950/90 border border-slate-700/80 rounded-sm overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${accentBar} ${
            isLeft ? 'mr-auto' : 'ml-auto'
          }`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>

      {/* Stamina Bar + Weapon / Trajectory State */}
      <div
        className={`flex items-center justify-between gap-3 mt-1.5 ${
          isLeft ? 'flex-row' : 'flex-row-reverse'
        }`}
      >
        <div className="w-28 h-1.5 bg-slate-900 border border-slate-800 rounded-xs overflow-hidden shrink-0">
          <div
            className={`h-full bg-amber-400 ${isLeft ? 'mr-auto' : 'ml-auto'}`}
            style={{ width: `${stamPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300 truncate">
          <span className={fighter.phase === 'WEAPON_TRAVEL' ? 'text-amber-300 font-semibold' : ''}>
            {fighter.phaseLabel}
          </span>
          {fighter.waypointCount > 1 && (
            <span className="text-slate-400 tabular-nums">
              · Pts {Math.min(fighter.visitedWaypoints + 1, fighter.waypointCount)}/{fighter.waypointCount}
            </span>
          )}
          {fighter.chainTension > 0.25 && (
            <span className="text-slate-400 tabular-nums">
              · Tension {Math.round(fighter.chainTension * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const CombatHUD: React.FC<CombatHUDProps> = ({
  hud,
  muted,
  onTogglePause,
  onToggleMute,
  onRestart,
  onReturnMenu,
}) => {
  const modeSummary =
    hud.mode === 'ai'
      ? `Solo · IA ${DIFFICULTY_LABELS[hud.difficulty]}`
      : '2 Joueurs Local';

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-5">
      {/* Top Combat Bar */}
      <div className="flex items-start justify-between gap-4 sm:gap-6 bg-[#0b0f18]/90 border border-slate-800/90 rounded-xl px-4 py-3 shadow-lg">
        <FighterStatusPanel fighter={hud.p1} roundsToWin={hud.roundsToWin} align="left" />

        {/* Center Timer & Match Info */}
        <div className="flex flex-col items-center justify-center px-3 shrink-0">
          <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
            Manche {hud.currentRound} · {modeSummary}
          </div>
          <div
            className={`font-display text-2xl sm:text-3xl font-bold tabular-nums leading-tight mt-0.5 ${
              hud.roundTimeRemaining <= 15 ? 'text-rose-400' : 'text-white'
            }`}
          >
            {String(hud.roundTimeRemaining).padStart(2, '0')}
          </div>
        </div>

        <FighterStatusPanel fighter={hud.p2} roundsToWin={hud.roundsToWin} align="right" />
      </div>

      {/* Projected 3D Combat Callouts (Damage / Hit Zone / Parry / Dodge) */}
      <div className="relative flex-1 overflow-hidden">
        {hud.callouts.map((c) => (
          <div
            key={c.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
            style={{
              left: `${Math.max(10, Math.min(90, c.screenX))}%`,
              top: `${Math.max(12, Math.min(84, c.screenY))}%`,
            }}
          >
            <div
              className="font-display text-lg sm:text-xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tabular-nums"
              style={{ color: c.color }}
            >
              {c.text}
            </div>
            {c.subtext && (
              <div className="text-[11px] font-semibold text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap">
                {c.subtext}
              </div>
            )}
          </div>
        ))}

        {/* Round / KO Banner */}
        {hud.bannerText && hud.screen !== 'match_end' && hud.screen !== 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#090d16]/92 border border-slate-700/80 rounded-xl px-8 py-4 text-center shadow-2xl">
              <div className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight">
                {hud.bannerText}
              </div>
              {hud.bannerSubtext && (
                <div className="text-xs sm:text-sm text-cyan-300 mt-1">
                  {hud.bannerSubtext}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Compact Controls Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="bg-[#0b0f18]/88 border border-slate-800/80 rounded-lg px-3.5 py-2 text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <strong className="text-cyan-400">J1 :</strong> Glisser clic gauche (tracer) · Espace (garde) · E (esquive)
          </span>
          {hud.mode === 'local2p' && (
            <span>
              <strong className="text-orange-400">J2 :</strong> Flèches/IJKL (viseur) · Entrée/M (tracer) · Maj D (garde) · . (esquive)
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            className="p-2.5 bg-[#0b0f18]/92 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={hud.screen === 'paused' ? 'Reprendre' : 'Pause'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0b0f18]/92 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hud.screen === 'paused' ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Reprendre</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pause Overlay */}
      {hud.screen === 'paused' && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#060910]/80 p-6">
          <div className="w-full max-w-sm bg-[#0e131d] border border-slate-800 rounded-xl p-6 text-center space-y-5 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Combat en pause</h2>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Reprendre</span>
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recommencer</span>
              </button>
              <button
                type="button"
                onClick={onReturnMenu}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Menu principal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Defeat Match End Screen */}
      {hud.screen === 'match_end' && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#060910]/82 p-6">
          <div className="w-full max-w-lg bg-[#0e131d] border border-slate-700/80 rounded-xl p-7 shadow-2xl space-y-6">
            <div className="text-center">
              <div className="text-xs font-semibold text-slate-400">
                {hud.mode === 'ai'
                  ? hud.winnerId === 1
                    ? 'Victoire'
                    : 'Défaite'
                  : 'Fin du duel'}
              </div>
              <h2
                className={`font-display text-3xl font-bold mt-1 ${
                  hud.winnerId === 1 ? 'text-cyan-400' : 'text-orange-400'
                }`}
              >
                {hud.winnerId === 1 ? `${hud.p1.name} gagne !` : `${hud.p2.name} gagne !`}
              </h2>
              <div className="text-sm text-slate-300 mt-1 tabular-nums">
                Score final : {hud.p1.roundsWon} — {hud.p2.roundsWon}
              </div>
            </div>

            {/* Combat Stats Comparison */}
            <div className="grid grid-cols-2 gap-3 bg-[#090d16] border border-slate-800 rounded-lg p-4 text-xs">
              <div>
                <div className="font-semibold text-cyan-400 mb-2">{hud.p1.name}</div>
                <div className="space-y-1 text-slate-300 tabular-nums">
                  <div className="flex justify-between">
                    <span>Dégâts infligés</span>
                    <span className="font-semibold text-white">{hud.p1.stats.damageDealt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coups à la tête</span>
                    <span className="font-semibold text-white">{hud.p1.stats.headHits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parades</span>
                    <span className="font-semibold text-white">{hud.p1.stats.parries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Esquives</span>
                    <span className="font-semibold text-white">{hud.p1.stats.dodges}</span>
                  </div>
                </div>
              </div>

              <div className="border-l border-slate-800 pl-3">
                <div className="font-semibold text-orange-400 mb-2">{hud.p2.name}</div>
                <div className="space-y-1 text-slate-300 tabular-nums">
                  <div className="flex justify-between">
                    <span>Dégâts infligés</span>
                    <span className="font-semibold text-white">{hud.p2.stats.damageDealt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coups à la tête</span>
                    <span className="font-semibold text-white">{hud.p2.stats.headHits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parades</span>
                    <span className="font-semibold text-white">{hud.p2.stats.parries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Esquives</span>
                    <span className="font-semibold text-white">{hud.p2.stats.dodges}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onRestart}
                className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recommencer</span>
              </button>
              <button
                type="button"
                onClick={onReturnMenu}
                className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Menu principal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
