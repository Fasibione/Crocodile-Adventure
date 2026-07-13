// =============================================================================
// EnemyDefinition — catalogo di tutti i nemici (Comuni/Elite/Boss) dei 7
// biomi. Le statistiche non sono scritte a mano per ognuno dei ~58 nemici:
// vengono derivate da una formula in base al tier e al livello, cosi'
// aggiungere un nuovo nemico e' una sola riga (nessun valore hardcoded da
// bilanciare a mano). Modulo indipendente: non importa nulla da
// Engine/Combattimento/IA.
import type { BiomeEnemyDefinition, BiomeId, EnemyTier, Stats } from "./types";

// "Gli Elite devono essere piu' grandi, possedere statistiche superiori,
// droppare piu' materiali, avere probabilita' di spawn molto bassa" — questi
// moltiplicatori per tier codificano esattamente quella regola in un unico
// posto, cosi' resta valida per qualunque nemico futuro.
const TIER_STAT_MULT: Record<EnemyTier, number> = { common: 1, elite: 2.4, boss: 9 };
const TIER_SIZE_MULT: Record<EnemyTier, number> = { common: 1, elite: 1.35, boss: 1.9 };
const TIER_LOOT_MULT: Record<EnemyTier, number> = { common: 1, elite: 2.5, boss: 6 };

interface DefineEnemyOptions {
  hpMul?: number;
  atkMul?: number;
  defMul?: number;
  speed?: number;
  color?: string;
}

function statsFor(level: number, tier: EnemyTier, opts: DefineEnemyOptions): Stats {
  const m = TIER_STAT_MULT[tier];
  return {
    hp: Math.round((16 + level * 7) * m * (opts.hpMul ?? 1)),
    attack: Math.round((3 + level * 1.3) * m * (opts.atkMul ?? 1)),
    defense: Math.round((1 + level * 0.6) * m * (opts.defMul ?? 1)),
    speed: Math.round(((opts.speed ?? 1.3) + (tier === "common" ? 0 : 0.3)) * 100) / 100,
  };
}

function defineEnemy(
  id: string,
  name: string,
  biome: BiomeId,
  tier: EnemyTier,
  level: number,
  spawnWeight: number,
  opts: DefineEnemyOptions = {},
): BiomeEnemyDefinition {
  return {
    id,
    name,
    biome,
    tier,
    level,
    stats: statsFor(level, tier, opts),
    xp: Math.round(8 * TIER_STAT_MULT[tier] * (1 + level * 0.35)),
    // I Boss non spawnano mai casualmente: peso sempre 0 indipendentemente
    // da cosa viene passato.
    spawnWeight: tier === "boss" ? 0 : spawnWeight,
    sizeMultiplier: TIER_SIZE_MULT[tier],
    color: opts.color ?? "#8a8a8a",
    lootMultiplier: TIER_LOOT_MULT[tier],
  };
}

export const ENEMY_DEFINITIONS: Record<string, BiomeEnemyDefinition> = {
  // ===================== PRATERIA (liv. 1-5) =====================
  slime_verde: defineEnemy("slime_verde", "Slime Verde", "prateria", "common", 1, 40, { color: "#5fd17a", hpMul: 0.8 }),
  lupo: defineEnemy("lupo", "Lupo", "prateria", "common", 2, 25, { color: "#9aa0a6", speed: 1.9 }),
  cinghiale: defineEnemy("cinghiale", "Cinghiale", "prateria", "common", 2, 15, { color: "#6b4a30", atkMul: 1.2 }),
  ape_gigante: defineEnemy("ape_gigante", "Ape Gigante", "prateria", "common", 3, 10, { color: "#f5c542", speed: 2.1 }),
  goblin_guerriero: defineEnemy("goblin_guerriero", "Goblin Guerriero", "prateria", "common", 3, 20, { color: "#5a8a4a" }),
  goblin_arciere: defineEnemy("goblin_arciere", "Goblin Arciere", "prateria", "common", 4, 8, { color: "#4a7a3a", atkMul: 1.3, defMul: 0.6 }),
  goblin_sciamano: defineEnemy("goblin_sciamano", "Goblin Sciamano", "prateria", "common", 5, 5, { color: "#7a5aa0", atkMul: 1.4 }),
  alpha_wolf: defineEnemy("alpha_wolf", "Alpha Wolf", "prateria", "elite", 5, 2, { color: "#6b7278", speed: 2.0 }),
  goblin_capitano: defineEnemy("goblin_capitano", "Goblin Capitano", "prateria", "elite", 5, 2, { color: "#3a6a2a" }),
  goblin_re: defineEnemy("goblin_re", "Goblin Re", "prateria", "boss", 7, 0, { color: "#8a2a2a" }),

  // ===================== FORESTA (liv. 4-9) =====================
  ragno_gigante: defineEnemy("ragno_gigante", "Ragno Gigante", "foresta", "common", 4, 35, { color: "#2a2a2a", speed: 1.8 }),
  ent_giovane: defineEnemy("ent_giovane", "Ent Giovane", "foresta", "common", 5, 22, { color: "#4a6a3a", defMul: 1.4, speed: 0.9 }),
  orso: defineEnemy("orso", "Orso", "foresta", "common", 6, 20, { color: "#5a4028", atkMul: 1.2 }),
  treant: defineEnemy("treant", "Treant", "foresta", "common", 7, 12, { color: "#3a5a2a", defMul: 1.6, speed: 0.8 }),
  fata_oscura: defineEnemy("fata_oscura", "Fata Oscura", "foresta", "common", 8, 8, { color: "#6a2a8a", speed: 2.2 }),
  dire_bear: defineEnemy("dire_bear", "Dire Bear", "foresta", "elite", 9, 2, { color: "#3a2a18", atkMul: 1.2 }),
  ancient_treant: defineEnemy("ancient_treant", "Ancient Treant", "foresta", "elite", 9, 2, { color: "#2a4a1a", defMul: 1.5, speed: 0.7 }),
  re_della_foresta: defineEnemy("re_della_foresta", "Re della Foresta", "foresta", "boss", 11, 0, { color: "#1a4a1a" }),

  // ===================== DESERTO (liv. 8-14) =====================
  scorpione: defineEnemy("scorpione", "Scorpione", "deserto", "common", 8, 35, { color: "#c9a04b" }),
  scarabeo_deserto: defineEnemy("scarabeo_deserto", "Scarabeo", "deserto", "common", 9, 25, { color: "#3a6b8a", defMul: 1.2 }),
  cobra: defineEnemy("cobra", "Cobra", "deserto", "common", 10, 18, { color: "#7a8a3a", speed: 2.0 }),
  bandito: defineEnemy("bandito", "Bandito", "deserto", "common", 11, 15, { color: "#8a6a3a", atkMul: 1.15 }),
  mummia: defineEnemy("mummia", "Mummia", "deserto", "common", 12, 8, { color: "#c9c1a8", speed: 0.8, defMul: 1.3 }),
  scorpione_reale: defineEnemy("scorpione_reale", "Scorpione Reale", "deserto", "elite", 14, 2, { color: "#b8862f" }),
  campione_bandito: defineEnemy("campione_bandito", "Campione Bandito", "deserto", "elite", 14, 2, { color: "#a8763a", atkMul: 1.2 }),
  re_scorpione: defineEnemy("re_scorpione", "Re Scorpione", "deserto", "boss", 16, 0, { color: "#8a5a1a" }),

  // ===================== PALUDE (liv. 12-18) =====================
  slime_tossico: defineEnemy("slime_tossico", "Slime Tossico", "palude", "common", 12, 35, { color: "#7fd17a" }),
  rana_gigante: defineEnemy("rana_gigante", "Rana Gigante", "palude", "common", 13, 22, { color: "#4a8a3a", speed: 1.9 }),
  coccodrillo_selvatico: defineEnemy("coccodrillo_selvatico", "Coccodrillo Selvatico", "palude", "common", 14, 18, { color: "#3a6a2a", atkMul: 1.2 }),
  zanzara_gigante: defineEnemy("zanzara_gigante", "Zanzara Gigante", "palude", "common", 14, 12, { color: "#5a2a5a", speed: 2.4, hpMul: 0.6 }),
  serpente_palude: defineEnemy("serpente_palude", "Serpente", "palude", "common", 15, 10, { color: "#6a8a2a", speed: 2.0 }),
  crocodile_alpha: defineEnemy("crocodile_alpha", "Crocodile Alpha", "palude", "elite", 18, 2, { color: "#2a5a1a", atkMul: 1.2 }),
  hydra_hatchling: defineEnemy("hydra_hatchling", "Hydra Hatchling", "palude", "elite", 18, 2, { color: "#4a2a6a" }),
  idra: defineEnemy("idra", "Idra", "palude", "boss", 20, 0, { color: "#3a1a5a" }),

  // ===================== MONTAGNA (liv. 16-23) =====================
  troll: defineEnemy("troll", "Troll", "montagne", "common", 16, 32, { color: "#6a7a5a", hpMul: 1.2 }),
  golem_montagna: defineEnemy("golem_montagna", "Golem", "montagne", "common", 17, 22, { color: "#7a7a7a", defMul: 1.5, speed: 0.8 }),
  arpia: defineEnemy("arpia", "Arpia", "montagne", "common", 18, 18, { color: "#8a6a4a", speed: 2.1 }),
  aquila_gigante: defineEnemy("aquila_gigante", "Aquila Gigante", "montagne", "common", 19, 14, { color: "#5a4a3a", speed: 2.3 }),
  lupo_delle_nevi: defineEnemy("lupo_delle_nevi", "Lupo delle Nevi", "montagne", "common", 20, 10, { color: "#c9d1d8", speed: 2.0 }),
  mountain_giant: defineEnemy("mountain_giant", "Mountain Giant", "montagne", "elite", 23, 2, { color: "#5a5a5a", hpMul: 1.3 }),
  elder_harpy: defineEnemy("elder_harpy", "Elder Harpy", "montagne", "elite", 23, 2, { color: "#7a5a3a", speed: 2.2 }),
  re_dei_troll: defineEnemy("re_dei_troll", "Re dei Troll", "montagne", "boss", 25, 0, { color: "#4a5a3a" }),

  // ===================== GHIACCIAIO (liv. 20-28) =====================
  golem_ghiaccio: defineEnemy("golem_ghiaccio", "Golem di Ghiaccio", "ghiacciaio", "common", 20, 32, { color: "#a8d8f0", defMul: 1.4, speed: 0.8 }),
  lupo_artico: defineEnemy("lupo_artico", "Lupo Artico", "ghiacciaio", "common", 21, 22, { color: "#e8f0f5", speed: 2.1 }),
  yeti: defineEnemy("yeti", "Yeti", "ghiacciaio", "common", 22, 18, { color: "#d8e8ec", atkMul: 1.2 }),
  spirito_del_gelo: defineEnemy("spirito_del_gelo", "Spirito del Gelo", "ghiacciaio", "common", 23, 12, { color: "#7fd6ff", speed: 1.9, hpMul: 0.7 }),
  pinguino_guerriero: defineEnemy("pinguino_guerriero", "Pinguino Guerriero", "ghiacciaio", "common", 24, 8, { color: "#2a3a4a" }),
  frost_yeti: defineEnemy("frost_yeti", "Frost Yeti", "ghiacciaio", "elite", 28, 2, { color: "#b8e0f0", atkMul: 1.2 }),
  ice_guardian: defineEnemy("ice_guardian", "Ice Guardian", "ghiacciaio", "elite", 28, 2, { color: "#8fc8e8", defMul: 1.3 }),
  re_del_gelo: defineEnemy("re_del_gelo", "Re del Gelo", "ghiacciaio", "boss", 30, 0, { color: "#5aa8d8" }),

  // ===================== VULCANO (liv. 25-35) =====================
  slime_lava: defineEnemy("slime_lava", "Slime di Lava", "vulcano", "common", 25, 32, { color: "#e05a3a" }),
  salamandra: defineEnemy("salamandra", "Salamandra", "vulcano", "common", 26, 22, { color: "#f5a742", speed: 2.0 }),
  elementale_fuoco: defineEnemy("elementale_fuoco", "Elementale del Fuoco", "vulcano", "common", 28, 18, { color: "#ff6a2a", atkMul: 1.25 }),
  demone_minore: defineEnemy("demone_minore", "Demone Minore", "vulcano", "common", 30, 12, { color: "#8a1a1a" }),
  drago_cucciolo: defineEnemy("drago_cucciolo", "Drago Cucciolo", "vulcano", "common", 32, 8, { color: "#c9302a", speed: 1.9, atkMul: 1.2 }),
  fire_giant: defineEnemy("fire_giant", "Fire Giant", "vulcano", "elite", 35, 2, { color: "#d84a1a", hpMul: 1.3 }),
  infernal_demon: defineEnemy("infernal_demon", "Infernal Demon", "vulcano", "elite", 35, 2, { color: "#6a0a0a", atkMul: 1.3 }),
  drago_antico: defineEnemy("drago_antico", "Drago Antico", "vulcano", "boss", 38, 0, { color: "#a01a1a" }),
};

export function getEnemyDefinition(id: string): BiomeEnemyDefinition | null {
  return ENEMY_DEFINITIONS[id] ?? null;
}

export function getEnemiesForBiome(biome: BiomeId): BiomeEnemyDefinition[] {
  return Object.values(ENEMY_DEFINITIONS).filter((e) => e.biome === biome);
}
