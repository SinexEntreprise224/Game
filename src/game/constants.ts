export const ARENA_RADIUS = 11.5;
export const FIGHTER_RADIUS = 0.6;
export const WEAPON_COMBAT_HEIGHT = 1.15;

// Chain & Trajectory limits
export const MAX_CHAIN_REACH = 9.5; // Maximum radial reach from fighter anchor
export const MAX_TRAJECTORY_LENGTH = 22.0; // Maximum cumulative path length for loops/curves
export const MIN_TRAJECTORY_LENGTH = 0.9; // Minimum drag distance to validate an attack/move
export const SAMPLE_POINT_STEP = 0.42; // Distance between sampled trajectory points
export const TURN_ANGLE_THRESHOLD_RAD = 0.36; // ~20 deg marks an explicit turning waypoint
export const CHAIN_LINK_COUNT = 18;

// Weapon & Fighter speeds (weapon speed controlled by combat engine, independent of trajectory length)
export const BASE_WEAPON_SPEED = 21.0; // m/s
export const MIN_WEAPON_SPEED = 17.0;
export const MAX_WEAPON_SPEED = 26.0;
export const FIGHTER_FOLLOW_SPEED = 11.5; // m/s when surging after weapon
export const WEAPON_ARRIVED_PAUSE = 0.11; // Crisp beat confirming weapon arrived before fighter moves
export const BASE_RECOVER_DURATION = 0.36; // Recovery after fighter finishes follow

// Combat & Health
export const MAX_HP = 100;
export const MAX_STAMINA = 100;
export const STAMINA_REGEN_PER_SEC = 24;
export const GUARD_STAMINA_DRAIN_PER_SEC = 18;
export const DODGE_STAMINA_COST = 28;
export const DODGE_DURATION = 0.28;
export const DODGE_DISTANCE = 3.2;
export const DODGE_COOLDOWN = 0.55;
export const PARRY_WINDOW_DURATION = 0.26;

export const BASE_WEAPON_DAMAGE = 14;
export const ZONE_DAMAGE_MULTIPLIER = {
  HEAD: 1.55,
  TORSO: 1.0,
  ARMS: 0.75,
  LEGS: 0.85,
} as const;

export const ROUND_DURATION_SECONDS = 90;

export const P1_COLOR_HEX = 0x06b6d4; // Electric Cyan
export const P1_ACCENT_HEX = 0x38bdf8;
export const P2_COLOR_HEX = 0xf97316; // Blaze Orange
export const P2_ACCENT_HEX = 0xef4444;

export const PHASE_LABELS_FR: Record<string, string> = {
  IDLE: 'Prêt — Tracer',
  DRAWING: 'Tracé en cours',
  WEAPON_TRAVEL: 'Arme en trajectoire',
  WEAPON_ARRIVED: 'Arme ancrée',
  FIGHTER_FOLLOW: 'Combattant suit l’arme',
  RECOVER: 'Récupération',
  GUARD: 'Garde active',
  DODGE: 'Esquive',
  HITSTUN: 'Ébranlé',
  KO: 'Hors combat',
  VICTORY: 'Victoire',
};
