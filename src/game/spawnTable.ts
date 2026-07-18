// =============================================================================
// SpawnTable — selezione casuale pesata tra i nemici Comuni/Elite di un
// bioma. "Utilizzare una selezione casuale pesata": ogni nemico Comune ha
// uno spawnWeight (vedi EnemyDefinition); i Boss hanno sempre peso 0 e non
// vengono mai restituiti da qui (hanno un percorso dedicato, vedi
// EnemySpawnManager.trySpawnBoss).
import { getBiomeDefinition } from "./biomeData";
import { getEnemiesForBiome } from "./enemyDefinitions";
import type { BiomeEnemyDefinition, BiomeId } from "./types";

function weightedPick(pool: BiomeEnemyDefinition[]): BiomeEnemyDefinition | null {
  const total = pool.reduce((sum, e) => sum + e.spawnWeight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const e of pool) {
    roll -= e.spawnWeight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}

/** Sceglie un nemico Comune del bioma con selezione pesata (mai un Elite/Boss). */
export function pickCommonEnemy(biome: BiomeId): BiomeEnemyDefinition | null {
  const pool = getEnemiesForBiome(biome).filter((e) => e.tier === "common");
  return weightedPick(pool);
}

/** Sceglie un Elite del bioma (equiprobabile tra i due): la rarita' e' gia' garantita a monte da BiomeSpawnConfig.eliteChance. */
export function pickEliteEnemy(biome: BiomeId): BiomeEnemyDefinition | null {
  const pool = getEnemiesForBiome(biome).filter((e) => e.tier === "elite");
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Sceglie il prossimo candidato di spawn "naturale" (Comune o, raramente,
 * Elite) per un bioma, rispettando la probabilita' di Elite configurata.
 * Non restituisce MAI un Boss.
 */
export function pickSpawnCandidate(biome: BiomeId): BiomeEnemyDefinition | null {
  const def = getBiomeDefinition(biome);
  if (Math.random() < def.spawn.eliteChance) {
    const elite = pickEliteEnemy(biome);
    if (elite) return elite;
  }
  return pickCommonEnemy(biome);
}
