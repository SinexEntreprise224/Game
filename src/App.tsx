import { useEffect, useRef, useState } from 'react';
import { CombatHUD } from './components/CombatHUD';
import { ControllerSettingsModal } from './components/ControllerSettingsModal';
import { MainMenu } from './components/MainMenu';
import { soundEngine } from './game/audio';
import { CombatEngine } from './game/combatEngine';
import { GamepadManager } from './game/gamepad';
import { GameConfig, GamepadSnapshot, MatchHUDState } from './game/types';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CombatEngine | null>(null);
  const gamepadManagerRef = useRef<GamepadManager | null>(null);

  const [config, setConfig] = useState<GameConfig>({
    mode: 'ai',
    difficulty: 'normal',
    roundsToWin: 2,
  });
  const [hud, setHud] = useState<MatchHUDState | null>(null);
  const [gamepadSnapshot, setGamepadSnapshot] = useState<GamepadSnapshot | null>(null);
  const [controllerModalOpen, setControllerModalOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const gamepadManager = new GamepadManager();
    gamepadManagerRef.current = gamepadManager;
    const unsubscribe = gamepadManager.subscribe((snap) => setGamepadSnapshot(snap));

    const engine = new CombatEngine(
      mountEl,
      gamepadManager,
      (nextHud) => setHud(nextHud),
      () => setContextLost(true)
    );
    engineRef.current = engine;

    return () => {
      unsubscribe();
      engine.dispose();
      gamepadManager.dispose();
      engineRef.current = null;
      gamepadManagerRef.current = null;
    };
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const handleStartMatch = () => {
    engineRef.current?.startMatch(config);
  };

  const handleTogglePause = () => {
    engineRef.current?.togglePause();
  };

  const handleRestart = () => {
    engineRef.current?.restartMatch();
  };

  const handleReturnMenu = () => {
    engineRef.current?.returnToMenu();
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080a0f]">
      {/* Isolated WebGL canvas container — React HUD updates never tear down the 3D scene */}
      <div ref={canvasMountRef} className="w-full h-full cursor-crosshair" />

      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#080a0f]/95 p-6">
          <div className="max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 text-center space-y-3">
            <h2 className="font-display text-xl font-bold text-white">
              Contexte WebGL interrompu
            </h2>
            <p className="text-sm text-slate-300">
              Le rendu 3D a été suspendu par le navigateur.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg cursor-pointer"
            >
              Recharger l’arène
            </button>
          </div>
        </div>
      )}

      {hud && hud.screen === 'menu' && gamepadSnapshot && (
        <MainMenu
          config={config}
          muted={muted}
          gamepadSnapshot={gamepadSnapshot}
          onChangeConfig={setConfig}
          onToggleMute={handleToggleMute}
          onOpenControllerSettings={() => setControllerModalOpen(true)}
          onStartMatch={handleStartMatch}
        />
      )}

      {hud && hud.screen !== 'menu' && gamepadSnapshot && (
        <CombatHUD
          hud={hud}
          muted={muted}
          gamepadSnapshot={gamepadSnapshot}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onOpenControllerSettings={() => setControllerModalOpen(true)}
          onRestart={handleRestart}
          onReturnMenu={handleReturnMenu}
        />
      )}

      {controllerModalOpen && gamepadManagerRef.current && gamepadSnapshot && (
        <ControllerSettingsModal
          gamepadManager={gamepadManagerRef.current}
          snapshot={gamepadSnapshot}
          onClose={() => setControllerModalOpen(false)}
        />
      )}
    </main>
  );
}
