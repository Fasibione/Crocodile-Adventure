// =============================================================================
// BiomeManager — interfaccia di sola lettura su BiomeData: funzioni di
// comodo per consultare un bioma (livelli consigliati, colore minimappa,
// risorse, elenco nemici) senza che chi lo usa debba conoscere la forma
// interna dei dati. Modulo indipendente e stateless.
import { BIOME_DEFINITIONS, getBiomeDefinition } from "./biomeData";
import { getEnemiesForBiome, getEnemyDefinition } from "./enemyDefinitions";
import type { BiomeDefinition, BiomeEnemyDefinition, BiomeId, ResourceDefinition } from "./types";

export class BiomeManager {
  getAllBiomes(): BiomeDefinition[] {
    return Object.values(BIOME_DEFINITIONS);
  }

  getBiome(id: BiomeId): BiomeDefinition {
    return getBiomeDefinition(id);
  }

  getLevelRange(id: BiomeId): { min: number; max: number } {
    const b = getBiomeDefinition(id);
    return { min: b.minLevel, max: b.maxLevel };
  }

  getMinimapColor(id: BiomeId): string {
    return getBiomeDefinition(id).minimapColor;
  }

  getMusic(id: BiomeId): string {
    return getBiomeDefinition(id).music;
  }

  getResources(id: BiomeId): ResourceDefinition[] {
    return getBiomeDefinition(id).resources;
  }

  /** Nemici Comuni + Elite (mai il Boss) del bioma. */
  getEnemies(id: BiomeId): BiomeEnemyDefinition[] {
    return getEnemiesForBiome(id);
  }

  getCommonEnemies(id: BiomeId): BiomeEnemyDefinition[] {
    return this.getEnemies(id).filter((e) => e.tier === "common");
  }

  getEliteEnemies(id: BiomeId): BiomeEnemyDefinition[] {
    return this.getEnemies(id).filter((e) => e.tier === "elite");
  }

  getBoss(id: BiomeId): BiomeEnemyDefinition | null {
    const bossId = getBiomeDefinition(id).bossEnemyId;
    return getEnemyDefinition(bossId);
  }

  /** Vero se il nemico indicato appartiene davvero a quel bioma (per i test/verifiche). */
  belongsToBiome(enemyId: string, biome: BiomeId): boolean {
    const def = getEnemyDefinition(enemyId);
    return !!def && def.biome === biome;
  }
}
