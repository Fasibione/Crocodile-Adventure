import { BUILDINGS, CROC_BASE, PLAYER, SPECIES_ROLE, VILLAGE_SPAWN, xpForLevel } from "./config";
import { getEnemyDefinition } from "./enemyDefinitions";
import type { Entity, EnemyKind, ItemKind, Species, Vec2 } from "./types";

let nextId = 1;
export const resetIds = () => {
  nextId = 1;
};

/**
 * Crea la creatura giocabile. Per ora l'unica creatura disponibile e' il
 * Coccodrillo (unica creatura di questa vertical slice), ma la firma resta
 * parametrica per poter aggiungere altre specie in futuro senza toccare
 * l'engine.
 *
 * Nessun equipaggiamento iniziale: le statistiche finali partono uguali a
 * quelle base (`baseStats`) finche' il giocatore non assegna e applica un
 * equip al Deposito Equipaggiamenti (vedi engine.ts: recalcStats).
 */
export function createPlayer(species: Species = "croc"): Entity {
  const s = CROC_BASE;
  return {
    id: nextId++,
    kind: "player",
    faction: "player",
    alive: true,
    transform: { pos: { ...VILLAGE_SPAWN }, facing: 1 },
    health: { hp: s.hp, maxHp: s.hp },
    combat: {
      attack: s.attack,
      defense: s.defense,
      range: PLAYER.attackRange,
      cooldown: PLAYER.attackCooldown,
      cdLeft: 0,
    },
    movement: { speed: s.speed },
    level: { level: 1, xp: 0, xpToNext: xpForLevel(1) },
    ai: { state: "idle", targetId: null, wanderTarget: null, wanderTimer: 0 },
    hitFlash: 0,
    attackAnim: 0,
    species,
    role: SPECIES_ROLE[species],
    baseStats: { ...s },
    aiMode: "rest",
    equipment: {}, // nessun equipaggiamento iniziale (8 slot, tutti vuoti)
    scheduledEquipment: {},
  };
}

/**
 * Crea un mostro appartenente a una Spawn Area (Modifica 3): riceve sempre
 * la propria Spawn Position e il proprio Spawn Radius, oltre ad Aggro Range
 * e Leash Distance definiti per la sua specie in config.ts (Modifiche 4-5).
 */
export function createEnemy(
  kind: EnemyKind,
  pos: Vec2,
  spawnPos: Vec2,
  spawnRadius: number,
  difficulty = 1,
): Entity {
  const def = getEnemyDefinition(kind);

if (!def) {
  throw new Error(`Enemy "${kind}" non trovato.`);
}
  const s = def.stats;
  const m = difficulty;
  return {
    id: nextId++,
    kind,
    faction: "enemy",
    alive: true,
    transform: { pos: { ...pos }, facing: 1 },
    health: { hp: s.hp * m, maxHp: s.hp * m },
    combat: {
      attack: Math.round(s.attack * m),
      defense: Math.round(s.defense * m),
      range: def.attackRange,
      cooldown: def.attackCooldown,
      cdLeft: 0,
    },
    movement: { speed: s.speed },
    ai: { state: "idle", targetId: null, wanderTarget: null, wanderTimer: 0 },
    hitFlash: 0,
    attackAnim: 0,
    xpReward: Math.round(def.xp * m),
    isBoss: kind === "boss_prateria",
    spawnPos: { ...spawnPos },
    spawnRadius,
    aggroRange: def.aggroRange,
    leashDistance: def.leashDistance,
  };
}

export function createItem(kind: ItemKind, pos: Vec2): Entity {
  return {
    id: nextId++,
    kind: "item",
    faction: "none",
    alive: true,
    transform: { pos: { ...pos }, facing: 1 },
    item: { kind, ttl: 20 },
    hitFlash: 0,
    attackAnim: 0,
  };
}

// Riferimento comodo agli edifici, usato dall'engine per calcolare distanze.
export const HOSPITAL_POS = BUILDINGS.hospital.pos;
export const TOWNHALL_POS = BUILDINGS.townhall.pos;
export const SMITHY_POS = BUILDINGS.smithy.pos;
