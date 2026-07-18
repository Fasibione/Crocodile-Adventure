// =============================================================================
// LootTable — tabella drop di un nemico, derivata dalle risorse del proprio
// bioma (BiomeData) e dal moltiplicatore di tier (Comune/Elite/Boss). Non
// tocca in alcun modo il Loot/Inventario di gioco gia' esistente: produce
// solo dati (LootTableEntry / risultati di un tiro), pronti per essere
// collegati in futuro al Magazzino senza cambiare questo modulo.
import { getBiomeDefinition } from "./biomeData";
import type { BiomeEnemyDefinition, LootTableEntry } from "./types";

const BASE_DROP_CHANCE = 0.35;

/** Costruisce la tabella drop di un nemico dalle risorse del suo bioma. */
export function getLootTable(enemy: BiomeEnemyDefinition): LootTableEntry[] {
  const biome = getBiomeDefinition(enemy.biome);
  return biome.resources.map((r) => ({
    resourceId: r.id,
    chance: Math.min(1, BASE_DROP_CHANCE * enemy.lootMultiplier),
    amountMin: 1,
    amountMax: Math.max(1, Math.round(enemy.lootMultiplier)),
  }));
}

export interface LootRoll {
  resourceId: string;
  amount: number;
}

/** Effettua un tiro sulla tabella drop di un nemico. */
export function rollLoot(enemy: BiomeEnemyDefinition): LootRoll[] {
  const table = getLootTable(enemy);
  const drops: LootRoll[] = [];
  for (const entry of table) {
    if (Math.random() <= entry.chance) {
      const span = entry.amountMax - entry.amountMin + 1;
      const amount = entry.amountMin + Math.floor(Math.random() * span);
      drops.push({ resourceId: entry.resourceId, amount });
    }
  }
  return drops;
}
