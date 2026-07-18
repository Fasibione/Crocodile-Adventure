// =============================================================================
// EnemySpawnManager — decide COSA e SE far comparire in un bioma, senza mai
// creare direttamente delle Entity di gioco: restituisce solo una
// BiomeEnemyDefinition (o null). Chi lo integra (in un passaggio futuro)
// user tali definizioni per istanziare i nemici nel proprio Engine, che
// questo modulo non conosce e non modifica.
//
// Regole implementate (una per parametro di BiomeSpawnConfig, mai
// hardcoded qui): numero massimo di nemici, probabilita' di spawn, tempo
// di respawn, distanza minima dal giocatore, distanza minima tra nemici.
// Gli Elite emergono con probabilita' molto bassa (eliteChance). I Boss
// non vengono MAI generati da questo percorso: un solo Boss vivo per
// bioma, tramite trySpawnBoss dedicato.
import { getBiomeDefinition } from "./biomeData";
import { getEnemyDefinition } from "./enemyDefinitions";
import { pickSpawnCandidate } from "./spawnTable";
import type { BiomeEnemyDefinition, BiomeId, Vec2 } from "./types";

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export class EnemySpawnManager {
  // Tempo trascorso dall'ultimo tentativo di spawn, per bioma.
  private timers: Partial<Record<BiomeId, number>> = {};
  // Un solo Boss vivo per bioma alla volta.
  private bossAlive: Partial<Record<BiomeId, boolean>> = {};

  /** Avanza il timer di respawn di un bioma. Da chiamare una volta per frame per bioma attivo. */
  tick(biome: BiomeId, dt: number) {
    this.timers[biome] = (this.timers[biome] ?? 0) + dt;
  }

  /**
   * Valuta se in questo istante puo' comparire un nuovo nemico "naturale"
   * (Comune o, raramente, Elite) in `biome`, nella posizione candidata
   * `candidatePos`. Restituisce null se una qualunque regola blocca lo
   * spawn (troppi nemici gia' presenti, tempo di respawn non trascorso,
   * troppo vicino al giocatore o ad un altro nemico, oppure il tiro di
   * probabilita' fallisce).
   */
  attemptSpawn(
    biome: BiomeId,
    candidatePos: Vec2,
    playerPos: Vec2 | null,
    enemyPositions: Vec2[],
  ): BiomeEnemyDefinition | null {
    const def = getBiomeDefinition(biome);
    const elapsed = this.timers[biome] ?? 0;
    if (elapsed < def.spawn.respawnTimeSec) return null;
    if (enemyPositions.length >= def.spawn.maxEnemies) return null;
    if (playerPos && dist(playerPos, candidatePos) < def.spawn.minDistanceFromPlayer) return null;
    if (enemyPositions.some((p) => dist(p, candidatePos) < def.spawn.minDistanceBetweenEnemies)) {
      return null;
    }
    // Il tempo di respawn si consuma ad ogni tentativo valido, indipendentemente
    // dall'esito del tiro di probabilita' successivo.
    this.timers[biome] = 0;
    if (Math.random() > def.spawn.spawnChancePerTick) return null;
    return pickSpawnCandidate(biome);
  }

  /**
   * Genera il Boss di un bioma SOLO se non ce n'e' gia' uno vivo. I Boss
   * non vengono mai generati casualmente: questo e' l'unico modo per
   * ottenerne uno.
   */
  trySpawnBoss(biome: BiomeId): BiomeEnemyDefinition | null {
    if (this.bossAlive[biome]) return null;
    const bossId = getBiomeDefinition(biome).bossEnemyId;
    const boss = getEnemyDefinition(bossId);
    if (!boss) return null;
    this.bossAlive[biome] = true;
    return boss;
  }

  notifyBossDefeated(biome: BiomeId) {
    this.bossAlive[biome] = false;
  }

  isBossAlive(biome: BiomeId): boolean {
    return !!this.bossAlive[biome];
  }

  /** Reimposta lo stato di spawn di un bioma (utile per i test/il reset partita). */
  reset(biome?: BiomeId) {
    if (biome) {
      delete this.timers[biome];
      delete this.bossAlive[biome];
    } else {
      this.timers = {};
      this.bossAlive = {};
    }
  }
}
