import {
  BIOMES,
  BIOME_ORDER,
  BOSS_AREA,
  BOSS_RESPAWN_TIME,
  BUILDINGS,
  DEPOSIT_BUILDING,
  ENEMIES,
  ENEMY_KINDS,
  ENEMY_SPAWN_INTERVAL,
  EQUIPMENT_CATALOG,
  EQUIPMENT_SLOT_LABEL,
  EXPLORE_DETECT_RANGE,
  FULL_HEAL_RATIO,
  INVENTORY_CAP,
  ITEMS,
  ITEM_CATEGORY,
  LEASH_HEAL_PER_SECOND,
  LEVEL_UP_GAINS,
  MAX_ENEMIES,
  PLAYER,
  RETREAT_HP_RATIO,
  ROLE_LABEL,
  SPAWN_AREAS,
  STARTER_EQUIPMENT_IDS,
  VILLAGE,
  VILLAGE_GATE_HALF,
  VILLAGE_SPAWN,
  WANDER,
  WORLD,
  biomeAt,
  xpForLevel,
} from "./config";
import { createEnemy, createItem, createPlayer, resetIds } from "./entities";
import { AcademyManager } from "./academyManager";
import { BuildingManager } from "./buildingManager";
import { CraftingManager } from "./craftingManager";
import { MerchantManager } from "./merchantManager";
import type {
  AiMode,
  BiomeId,
  BuildingKind,
  Entity,
  EnemyKind,
  EquipmentSlot,
  ItemCategory,
  ItemKind,
  Role,
  Stats,
  Vec2,
} from "./types";

// Solo il Coccodrillo e' giocabile in questa vertical slice.
export { SPECIES_LABEL, SPECIES_EMOJI } from "./config";

export interface GameStats {
  kills: number;
  bank: Record<ItemKind, number>; // materiali/oro depositati in villaggio
  carried: Record<ItemKind, number>; // materiali/oro portati durante l'esplorazione
  trips: number;
  // Magazzino Equipaggiamenti del villaggio: quante copie di ciascun
  // EquipmentDef (per id del catalogo) sono possedute e NON indossate da
  // nessuna creatura. E' la fonte da cui si programma un nuovo equip.
  equipmentStorage: Record<string, number>;
}

export interface LogEntry {
  id: number;
  text: string;
}

export interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  ttl: number;
}

const emptyBag = (): Record<ItemKind, number> => ({
  gold: 0,
  gelatin: 0,
  chitin: 0,
  pelt: 0,
  rareCrystal: 0,
  wood: 0,
  iron: 0,
  steel: 0,
  gem: 0,
  herb: 0,
  mushroom: 0,
  potionHp: 0,
  potionBuff: 0,
  potionDefense: 0,
  potionSpeed: 0,
});

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
// Square village zone (interior including walls).
const inVillage = (p: Vec2) =>
  Math.abs(p.x - VILLAGE.x) <= VILLAGE.radius &&
  Math.abs(p.y - VILLAGE.y) <= VILLAGE.radius;
// Physical wall collider: a solid band around the square village perimeter
// with a gate opening cut through the middle of each of the 4 sides.
const isWallTile = (p: Vec2) => {
  const dx = Math.round(p.x - VILLAGE.x);
  const dy = Math.round(p.y - VILLAGE.y);
  const cheb = Math.max(Math.abs(dx), Math.abs(dy));
  if (cheb < VILLAGE.radius - 1 || cheb > VILLAGE.radius + 1) return false;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const gate = vertical
    ? Math.abs(dx) <= VILLAGE_GATE_HALF
    : Math.abs(dy) <= VILLAGE_GATE_HALF;
  return !gate;
};
const clampWorld = (v: number) => Math.max(WORLD.min, Math.min(WORLD.max, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Modifica 8 (pathfinding): se la linea diretta verso il bersaglio passa
// troppo vicino a un edificio, calcola un punto "tangente" attorno a
// quell'edificio. Restituisce null se il percorso diretto e' libero.
function resolveNavTarget(pos: Vec2, target: Vec2): Vec2 | null {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-3) return null;
  const dirX = dx / L;
  const dirY = dy / L;
  const perpX = -dirY;
  const perpY = dirX;
  let blocking: { pos: Vec2; radius: number; forward: number; lateral: number } | null = null;
  for (const b of Object.values(BUILDINGS)) {
    if (Math.hypot(b.pos.x - target.x, b.pos.y - target.y) < 0.3) continue; // e' la destinazione stessa
    const toBx = b.pos.x - pos.x;
    const toBy = b.pos.y - pos.y;
    const forward = toBx * dirX + toBy * dirY; // proiezione lungo la rotta diretta
    if (forward <= 0.1 || forward > L) continue; // edificio dietro, o oltre il bersaglio
    const lateral = toBx * perpX + toBy * perpY; // distanza perpendicolare (con segno)
    // Distanza di sicurezza dall'edificio: leggermente maggiorata rispetto
    // a prima, cosi' il waypoint calcolato non rientra subito nella zona
    // che farebbe scattare di nuovo l'aggiramento.
    const avoidRadius = b.collisionRadius + 1.3;
    if (Math.abs(lateral) < avoidRadius) {
      if (!blocking || forward < blocking.forward) {
        blocking = { pos: b.pos, radius: avoidRadius, forward, lateral };
      }
    }
  }
  if (!blocking) return null;
  // Il lato (destra/sinistra) viene deciso qui, UNA sola volta per ogni
  // nuovo aggiramento: chi chiama questa funzione lo mette in cache finche'
  // il waypoint non viene raggiunto, cosi' non puo' piu' alternare lato ad
  // ogni frame.
  const side = blocking.lateral >= 0 ? -1 : 1;
  return {
    x: blocking.pos.x + perpX * side * blocking.radius,
    y: blocking.pos.y + perpY * side * blocking.radius,
  };
}

// Distanza entro la quale un waypoint di aggiramento si considera "raggiunto".
const NAV_WAYPOINT_REACHED = 0.4;
// Oltre questa distanza dal target originale, un waypoint gia' in cache viene
// considerato non piu' valido (la destinazione e' cambiata troppo) e va
// ricalcolato da zero.
const NAV_WAYPOINT_STALE_DIST = 0.5;

// Restituisce il punto verso cui muoversi davvero, gestendo la cache del
// waypoint di aggiramento sull'entita' stessa (e.navWaypoint):
// - se c'e' gia' un waypoint attivo e non ancora raggiunto, resta quello
//   (stesso lato, nessun ricalcolo ad ogni frame);
// - una volta raggiunto, viene liberato e si riprende la destinazione
//   originale;
// - se il percorso diretto verso una NUOVA destinazione risulta bloccato,
//   ne viene calcolato uno nuovo (una sola volta).
function getNavTarget(e: Entity, target: Vec2): Vec2 {
  if (e.navWaypoint) {
    const stale =
      !e.navWaypointTarget || dist(e.navWaypointTarget, target) > NAV_WAYPOINT_STALE_DIST;
    if (stale) {
      e.navWaypoint = null;
      e.navWaypointTarget = null;
    } else if (dist(e.transform.pos, e.navWaypoint) > NAV_WAYPOINT_REACHED) {
      return e.navWaypoint; // ancora in manovra: resta fisso sullo stesso punto/lato
    } else {
      // Waypoint raggiunto: lo liberiamo e riprendiamo la destinazione originale.
      e.navWaypoint = null;
      e.navWaypointTarget = null;
    }
  }
  const resolved = resolveNavTarget(e.transform.pos, target);
  if (resolved) {
    e.navWaypoint = resolved;
    e.navWaypointTarget = { ...target };
    return resolved;
  }
  return target;
}

// Distanza di ogni micro-incremento usata per controllare le collisioni:
// muoversi a passi piccoli invece che in un solo balzo evita di "saltare"
// oltre un muro sottile, anche a velocita' di gioco elevate (x2/x10).
const COLLISION_SUBSTEP = 0.12;

function moveToward(e: Entity, target: Vec2, dt: number, blockVillage = false) {
  if (!e.movement) return;
  const navTarget = blockVillage ? getNavTarget(e, target) : target;
  const dx = navTarget.x - e.transform.pos.x;
  const dy = navTarget.y - e.transform.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-3) return;
  const totalStep = Math.min(d, e.movement.speed * dt);
  const dirX = dx / d;
  const dirY = dy / d;

  const steps = Math.max(1, Math.ceil(totalStep / COLLISION_SUBSTEP));
  const inc = totalStep / steps;
  let x = e.transform.pos.x;
  let y = e.transform.pos.y;
  let moved = false;
  for (let i = 0; i < steps; i++) {
    let nx = clampWorld(x + dirX * inc);
    let ny = clampWorld(y + dirY * inc);
    if (blockVillage) {
      // Rete di sicurezza: se nonostante l'aggiramento la posizione finisse
      // comunque dentro un edificio (es. spawn esattamente li'), la spinge fuori.
      for (const b of Object.values(BUILDINGS)) {
        const bx = nx - b.pos.x;
        const by = ny - b.pos.y;
        const bd = Math.hypot(bx, by);
        if (bd < b.collisionRadius && bd > 1e-4) {
          const push = b.collisionRadius - bd;
          nx += (bx / bd) * push;
          ny += (by / bd) * push;
        }
      }
      if (isWallTile({ x: nx, y: ny })) {
        // Bloccati dal muro: prova a scivolare lungo un solo asse invece di
        // fermarsi di colpo. Questo permette anche di raggiungere in
        // diagonale il varco di un cancello, "scivolando" naturalmente
        // lungo il muro finche' non lo trova, invece di muoversi solo in
        // orizzontale/verticale.
        const slideX = { x: nx, y };
        const slideY = { x, y: ny };
        if (!isWallTile(slideX)) {
          nx = slideX.x;
          ny = slideX.y;
        } else if (!isWallTile(slideY)) {
          nx = slideY.x;
          ny = slideY.y;
        } else {
          break; // completamente bloccato (es. angolo), si ferma qui
        }
      }
    }
    x = nx;
    y = ny;
    moved = true;
  }
  e.transform.pos.x = x;
  e.transform.pos.y = y;
  if (Math.abs(dx) > 0.01) e.transform.facing = dx > 0 ? 1 : -1;
  if (moved) e.moving = true;
}

export class GameEngine {
  entities: Entity[] = [];
  // Un solo Coccodrillo in questa vertical slice. Tenuto come array per
  // restare facilmente estendibile a piu' creature in futuro.
  creatures: Entity[] = [];
  player: Entity; // riferimento comodo alla (unica) creatura
  stats: GameStats = {
    kills: 0,
    bank: emptyBag(),
    carried: emptyBag(),
    trips: 0,
    equipmentStorage: {},
  };
  log: LogEntry[] = [];
  floaters: Floater[] = [];
  private floaterId = 1;
  private logId = 1;
  private spawnTimer = ENEMY_SPAWN_INTERVAL;
  // Stato del Boss della Prateria: vivo o in attesa di respawn.
  private bossAlive = true;
  private bossRespawnTimer = 0;
  private noSave = false;

  // --- Artigiani / Crafting (nuova iterazione): 4 sistemi indipendenti,
  // ognuno nel proprio modulo. GameEngine si limita a farli avanzare nel
  // tempo (tick) e a passare loro il Magazzino/Magazzino Equipaggiamenti
  // quando il giocatore compie un'azione: non ne possiede la logica interna.
  crafting = new CraftingManager();
  academy = new AcademyManager();
  merchant = new MerchantManager();
  buildings = new BuildingManager();

  constructor() {
    resetIds();
    this.player = createPlayer("croc");
    this.creatures.push(this.player);
    this.entities.push(this.player);
    // Semina qualche mostro nella Prateria all'avvio.
    for (let i = 0; i < 3; i++) this.spawnEnemy();
    this.spawnBoss();
    // Scorta di partenza nel Magazzino Equipaggiamenti: solo gli oggetti
    // "base" (non quelli craftabili, che si ottengono solo tramite Crafting).
    for (const id of STARTER_EQUIPMENT_IDS) {
      this.stats.equipmentStorage[id] = 1;
    }
    // Scorta di partenza di materiali grezzi (per poter craftare da subito
    // senza dover prima comprare tutto dal Mercante).
    this.stats.bank.wood = 6;
    this.stats.bank.iron = 6;
    this.stats.bank.herb = 6;
    this.stats.bank.mushroom = 6;
  }

  // ---- Local save / load ----
  static SAVE_KEY = "creature-tycoon-save-vertical-slice";

  serialize(): string {
    const p = this.player;
    return JSON.stringify({
      v: 1,
      stats: this.stats,
      log: this.log,
      logId: this.logId,
      bossAlive: this.bossAlive,
      bossRespawnTimer: this.bossRespawnTimer,
      creature: {
        pos: p.transform.pos,
        facing: p.transform.facing,
        health: p.health,
        combat: p.combat,
        movement: p.movement,
        level: p.level,
        aiMode: p.aiMode ?? "rest",
        zoneBiome: p.zoneBiome ?? "prateria",
        aiState: p.ai?.state ?? "idle",
        returnStops: p.returnStops ?? [],
        equipment: p.equipment ?? {},
        scheduledEquipment: p.scheduledEquipment ?? {},
        baseStats: p.baseStats ?? null,
      },
    });
  }

  save() {
    if (this.noSave) return;
    try {
      localStorage.setItem(GameEngine.SAVE_KEY, this.serialize());
    } catch {
      /* storage unavailable */
    }
  }

  load(): boolean {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(GameEngine.SAVE_KEY);
    } catch {
      return false;
    }
    if (!raw) return false;
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!data || !data.creature) return false;
    const p = this.player;
    const s = data.creature;
    p.transform.pos = { x: s.pos.x, y: s.pos.y };
    p.transform.facing = s.facing ?? 1;
    if (s.health) p.health = { ...s.health };
    if (s.combat) p.combat = { ...s.combat };
    if (s.movement) p.movement = { ...s.movement };
    if (s.level) p.level = { ...s.level };
    p.aiMode = s.aiMode ?? "rest";
    p.zoneBiome = s.zoneBiome ?? "prateria";
    p.equipment = s.equipment ?? {};
    p.scheduledEquipment = s.scheduledEquipment ?? {};
    p.baseStats = s.baseStats ?? p.baseStats;
    if (p.ai) {
      // I vecchi salvataggi potevano avere lo stato legacy "toHospital":
      // lo trattiamo come "returning" ricalcolando la coda da zero.
      const legacyState = s.aiState === "toHospital";
      p.ai.state = legacyState ? "returning" : (s.aiState ?? "idle");
      p.returnStops = legacyState
        ? this.buildReturnStops(p)
        : Array.isArray(s.returnStops)
          ? [...s.returnStops]
          : [];
    }
    if (data.stats) {
      this.stats = {
        kills: data.stats.kills ?? 0,
        bank: { ...emptyBag(), ...data.stats.bank },
        carried: { ...emptyBag(), ...data.stats.carried },
        trips: data.stats.trips ?? 0,
        equipmentStorage: { ...data.stats.equipmentStorage },
      };
    }
    if (Array.isArray(data.log)) this.log = data.log;
    if (typeof data.logId === "number") this.logId = data.logId;
    if (typeof data.bossAlive === "boolean") this.bossAlive = data.bossAlive;
    if (typeof data.bossRespawnTimer === "number")
      this.bossRespawnTimer = data.bossRespawnTimer;
    this.addLog("Partita ripresa");
    return true;
  }

  reset() {
    this.noSave = true;
    try {
      localStorage.removeItem(GameEngine.SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  // ---- Comandi giocatore ----------------------------------------------------
  /** Assegna la modalita' IA scelta dal giocatore (Riposo / Esplorazione Libera / Zona Specifica / Difesa del Villaggio). */
  setAiMode(mode: AiMode, zoneBiome?: BiomeId) {
    const p = this.player;
    if (!p.ai) return;
    p.aiMode = mode;
    if (mode === "zone") {
      // Esplora solo il bioma scelto (default: Prateria, l'unico attivo).
      p.zoneBiome = zoneBiome ?? p.zoneBiome ?? "prateria";
    }
    if (mode === "explore" || mode === "zone") {
      // Se sta gia' visitando gli edifici del villaggio o curandosi, lo
      // lascia finire prima di ripartire; altrimenti riparte subito.
      if (p.ai.state !== "returning" && p.ai.state !== "healing") {
        p.ai.state = "leaving";
        p.ai.wanderTarget = null;
      }
    } else if (mode === "defend") {
      if (p.ai.state !== "returning" && p.ai.state !== "healing") {
        p.ai.state = "patrol";
      }
    } else {
      if (p.ai.state !== "returning" && p.ai.state !== "healing") {
        p.ai.state = "idle";
      }
    }
    const modeLabel =
      mode === "rest"
        ? "Riposo"
        : mode === "explore"
          ? "Esplorazione Libera"
          : mode === "zone"
            ? `Zona Specifica (${BIOMES[p.zoneBiome ?? "prateria"].name})`
            : "Difesa del Villaggio";
    this.addLog(`Modalita' impostata: ${modeLabel}`);
  }

  /** Stato pubblico del Boss, utile per la HUD (vivo / tempo al respawn). */
  get bossStatus(): { alive: boolean; respawnIn: number } {
    return { alive: this.bossAlive, respawnIn: Math.max(0, this.bossRespawnTimer) };
  }

  private addFloater(at: Entity, text: string, color: string) {
    this.floaters.push({
      id: this.floaterId++,
      x: at.transform.pos.x,
      y: at.transform.pos.y,
      text,
      color,
      age: 0,
      ttl: 0.9,
    });
    if (this.floaters.length > 60) this.floaters.shift();
  }

  private addLog(text: string) {
    this.log.unshift({ id: this.logId++, text });
    if (this.log.length > 20) this.log.pop();
  }

  // ---- Spawn -----------------------------------------------------------------
  // Modifica 3: ogni mostro compare solo dentro la propria Spawn Area
  // (Spawn Position + Spawn Radius) e vi ritorna sempre quando deve rientrare.
  private randomPointInArea(pos: Vec2, radius: number): Vec2 {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * radius; // distribuzione uniforme nel cerchio
    return {
      x: clampWorld(pos.x + Math.cos(a) * r),
      y: clampWorld(pos.y + Math.sin(a) * r),
    };
  }

  spawnEnemy() {
    const kind = ENEMY_KINDS[Math.floor(Math.random() * ENEMY_KINDS.length)];
    const area = SPAWN_AREAS.find((a) => a.kind === kind);
    if (!area) return; // nessuna area definita per questa specie: non compare
    const pos = this.randomPointInArea(area.pos, area.radius);
    this.entities.push(createEnemy(kind, pos, area.pos, area.radius, 1));
  }

  private spawnBoss() {
    this.bossAlive = true;
    const pos = this.randomPointInArea(BOSS_AREA.pos, BOSS_AREA.radius * 0.4);
    this.entities.push(
      createEnemy("boss_prateria", pos, BOSS_AREA.pos, BOSS_AREA.radius, 1),
    );
    this.addLog("⚠️ Il Boss della Prateria e' apparso nella sua Boss Area!");
  }

  // ---- Ricerca bersagli -------------------------------------------------------
  // Se restrictBiome e' indicato (Zona Specifica), ignora completamente
  // nemici fuori da quella zona: altrimenti inseguirli trascinerebbe la
  // creatura oltre il confine assegnato.
  private nearestEnemy(from: Entity, restrictBiome: BiomeId | null = null): Entity | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of this.entities) {
      if (!e.alive || e.faction !== "enemy") continue;
      if (restrictBiome && !this.inZone(e.transform.pos, restrictBiome)) continue;
      const d = dist(from.transform.pos, e.transform.pos);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private nearestItem(from: Entity, restrictBiome: BiomeId | null = null): Entity | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of this.entities) {
      if (!e.alive || e.kind !== "item") continue;
      if (restrictBiome && !this.inZone(e.transform.pos, restrictBiome)) continue;
      const d = dist(from.transform.pos, e.transform.pos);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  // ---- Combattimento (automatico) --------------------------------------------
  private doAttack(attacker: Entity, target: Entity) {
    if (!attacker.combat || !target.health) return;
    if (attacker.combat.cdLeft > 0) return;
    attacker.combat.cdLeft = attacker.combat.cooldown;
    attacker.attackAnim = 0.25;
    const dmg = Math.max(1, attacker.combat.attack - target.combat!.defense);
    target.health.hp -= dmg;
    target.hitFlash = 0.2;
    this.addFloater(
      target,
      `${dmg}`,
      target.faction === "player" ? "#e05a4d" : "#ffe27a",
    );
    if (target.health.hp <= 0) this.kill(attacker, target);
  }

  private kill(killer: Entity, victim: Entity) {
    victim.alive = false;
    if (victim.faction === "enemy") {
      this.stats.kills++;
      const def = ENEMIES[victim.kind as EnemyKind];
      const xp = victim.xpReward ?? def.xp;
      for (const drop of def.drops) {
        if (Math.random() <= drop.chance) {
          const p = {
            x: victim.transform.pos.x + rand(-0.4, 0.4),
            y: victim.transform.pos.y + rand(-0.4, 0.4),
          };
          this.entities.push(createItem(drop.kind, p));
        }
      }
      if (killer.kind === "player" && killer.level) this.gainXp(killer, xp);
      this.addLog(`Sconfitto ${def.name} (+${xp} XP)`);
      if (victim.isBoss) {
        this.bossAlive = false;
        this.bossRespawnTimer = BOSS_RESPAWN_TIME;
        this.addLog("🏆 Boss della Prateria sconfitto!");
      }
    }
    if (victim.kind === "player") {
      // Rinasce nel villaggio mantenendo livello ed esperienza, e viene
      // mandata subito in cura all'Ospedale.
      victim.alive = true;
      victim.health!.hp = victim.health!.maxHp;
      victim.transform.pos = { ...VILLAGE_SPAWN };
      if (victim.ai) victim.ai.state = "idle";
      this.addLog("Il Coccodrillo e' caduto — rianimato nel villaggio");
    }
  }

  private gainXp(ally: Entity, amount: number) {
    const lv = ally.level!;
    lv.xp += amount;
    let leveled = false;
    while (lv.xp >= lv.xpToNext) {
      lv.xp -= lv.xpToNext;
      lv.level++;
      lv.xpToNext = xpForLevel(lv.level);
      if (ally.baseStats) {
        ally.baseStats.hp += LEVEL_UP_GAINS.hp;
        ally.baseStats.attack += LEVEL_UP_GAINS.attack;
        ally.baseStats.defense += LEVEL_UP_GAINS.defense;
        ally.baseStats.speed += LEVEL_UP_GAINS.speed;
      }
      leveled = true;
      this.addLog(`Livello superato! Ora livello ${lv.level}`);
    }
    // Le statistiche finali (base + equipaggiamento) vanno sempre ricalcolate
    // dopo un cambiamento delle statistiche base, non solo quando cambia
    // l'equip.
    if (leveled) this.recalcStats(ally);
  }

  /**
   * Ricalcola le statistiche finali di una creatura come somma delle sue
   * statistiche base (specie + livello) e dei bonus di TUTTI gli oggetti
   * attualmente indossati. Va richiamata ogni volta che l'equipaggiamento
   * cambia davvero (mai in automatico: solo dopo applyScheduledEquipment) o
   * che le statistiche base cambiano (level up). Non muta mai baseStats.
   */
  private recalcStats(p: Entity) {
    if (!p.baseStats || !p.health || !p.combat || !p.movement) return;
    const bonus: Stats = { hp: 0, attack: 0, defense: 0, speed: 0 };
    const eq = p.equipment ?? {};
    for (const slot of Object.keys(eq) as EquipmentSlot[]) {
      const id = eq[slot];
      if (!id) continue;
      const def = EQUIPMENT_CATALOG[id];
      if (!def) continue;
      bonus.hp += def.statBonus.hp ?? 0;
      bonus.attack += def.statBonus.attack ?? 0;
      bonus.defense += def.statBonus.defense ?? 0;
      bonus.speed += def.statBonus.speed ?? 0;
    }
    const newMaxHp = Math.max(1, p.baseStats.hp + bonus.hp);
    const ratio = p.health.maxHp > 0 ? p.health.hp / p.health.maxHp : 1;
    p.health.maxHp = newMaxHp;
    p.health.hp = Math.min(newMaxHp, Math.round(newMaxHp * ratio));
    p.combat.attack = p.baseStats.attack + bonus.attack;
    p.combat.defense = p.baseStats.defense + bonus.defense;
    p.movement.speed = Math.max(0.1, p.baseStats.speed + bonus.speed);
  }

  /** Vero se il ruolo della creatura puo' equipaggiare questo oggetto. */
  private isEquipmentCompatible(p: Entity, defId: string): boolean {
    const def = EQUIPMENT_CATALOG[defId];
    if (!def) return false;
    if (!p.role) return true; // nessun ruolo assegnato: nessuna restrizione
    return def.compatibleRoles.includes(p.role);
  }

  /**
   * Assegna un nuovo equipaggiamento a uno slot. NON viene indossato subito:
   * viene solo registrato come "Equipaggiamento Programmato" (GDD). La
   * creatura continua la propria attivita' normalmente; diventera' effettivo
   * solo quando raggiungera' fisicamente il Deposito Equipaggiamenti.
   * Passare `null` programma la rimozione dello slot.
   */
  scheduleEquipment(slot: EquipmentSlot, itemId: string | null): boolean {
    const p = this.player;
    if (itemId) {
      const def = EQUIPMENT_CATALOG[itemId];
      if (!def) {
        this.addLog("Oggetto non valido");
        return false;
      }
      if (def.slot !== slot) {
        this.addLog(`${def.name} non e' compatibile con lo slot ${EQUIPMENT_SLOT_LABEL[slot]}`);
        return false;
      }
      if (!this.isEquipmentCompatible(p, itemId)) {
        const roleName = p.role ? ROLE_LABEL[p.role] : "?";
        this.addLog(`${def.name} non e' compatibile con il ruolo ${roleName}`);
        return false;
      }
      if ((this.stats.equipmentStorage[itemId] ?? 0) <= 0) {
        this.addLog(`${def.name} non e' disponibile nel Magazzino Equipaggiamenti`);
        return false;
      }
    }
    p.scheduledEquipment = { ...(p.scheduledEquipment ?? {}), [slot]: itemId };
    const label = itemId
      ? `Programmato: ${EQUIPMENT_CATALOG[itemId].name} (${EQUIPMENT_SLOT_LABEL[slot]})`
      : `Programmata rimozione: ${EQUIPMENT_SLOT_LABEL[slot]}`;
    this.addLog(`${label} — verra' applicato al Deposito Equipaggiamenti`);
    return true;
  }

  /** Annulla un'assegnazione programmata non ancora applicata. */
  cancelScheduledEquipment(slot: EquipmentSlot) {
    const p = this.player;
    if (!p.scheduledEquipment) return;
    const next = { ...p.scheduledEquipment };
    delete next[slot];
    p.scheduledEquipment = next;
  }

  // ---- Crafting (Armaiolo / Orafo / Alchimista) -----------------------------
  // Il giocatore gestisce le code direttamente dalla UI dell'edificio: non
  // richiede che la creatura si sposti fisicamente li' ("Gli artigiani
  // lavorano automaticamente", il giocatore mette solo in coda gli ordini).
  queueProduction(recipeId: string) {
    const res = this.crafting.queueProduction(recipeId, this.stats.bank);
    if (res.success) this.addLog(`Produzione avviata: ${res.order?.recipeId}`);
    else this.addLog(`Impossibile avviare produzione: ${res.reason}`);
    return res;
  }

  cancelProduction(orderId: string) {
    const ok = this.crafting.cancelProduction(orderId, this.stats.bank);
    if (ok) this.addLog("Produzione annullata, risorse restituite");
    return ok;
  }

  collectProduction(orderId: string) {
    const res = this.crafting.collectProduction(orderId, this.stats.equipmentStorage, this.stats.bank);
    if (res.success) this.addLog(`Ritirato: ${res.label}`);
    return res;
  }

  // ---- Accademia --------------------------------------------------------------
  startResearch(id: string) {
    const res = this.academy.startResearch(id, this.stats.bank);
    if (res.success) this.addLog(`Ricerca avviata: ${id}`);
    else this.addLog(`Impossibile avviare la ricerca: ${res.reason}`);
    return res;
  }

  cancelResearch(id: string) {
    return this.academy.cancelResearch(id, this.stats.bank);
  }

  // ---- Mercante -----------------------------------------------------------
  buyMaterial(item: ItemKind, qty: number) {
    const res = this.merchant.buyMaterial(item, qty, this.stats.bank);
    if (res.success) this.addLog(`Acquistato ${qty}x ${ITEMS[item].name} per ${res.cost} Oro`);
    else this.addLog(`Acquisto fallito: ${res.reason}`);
    return res;
  }

  sellMaterial(item: ItemKind, qty: number) {
    const res = this.merchant.sellMaterial(item, qty, this.stats.bank);
    if (res.success) this.addLog(`Venduto ${qty}x ${ITEMS[item].name} per ${res.gained} Oro`);
    else this.addLog(`Vendita fallita: ${res.reason}`);
    return res;
  }

  sellEquipment(equipmentId: string) {
    const res = this.merchant.sellEquipment(equipmentId, this.stats.equipmentStorage, this.stats.bank);
    if (res.success) {
      this.addLog(`Venduto ${EQUIPMENT_CATALOG[equipmentId]?.name ?? equipmentId} per ${res.gained} Oro`);
    } else {
      this.addLog(`Vendita fallita: ${res.reason}`);
    }
    return res;
  }

  // ---- Caserma: assegnazione ruolo -------------------------------------------
  /**
   * Riassegna il ruolo della creatura. Gli oggetti attualmente
   * indossati/programmati non piu' compatibili con il nuovo ruolo vengono
   * automaticamente rimossi (tornano nel Magazzino Equipaggiamenti) e le
   * statistiche finali vengono ricalcolate.
   */
  reassignRole(role: Role) {
    const p = this.player;
    p.role = role;
    const equipment = { ...(p.equipment ?? {}) };
    let removed = 0;
    for (const slot of Object.keys(equipment) as EquipmentSlot[]) {
      const id = equipment[slot];
      if (!id) continue;
      const def = EQUIPMENT_CATALOG[id];
      if (def && !def.compatibleRoles.includes(role)) {
        this.stats.equipmentStorage[id] = (this.stats.equipmentStorage[id] ?? 0) + 1;
        delete equipment[slot];
        removed++;
      }
    }
    p.equipment = equipment;
    // Anche le assegnazioni programmate non compatibili vengono scartate.
    if (p.scheduledEquipment) {
      const scheduled = { ...p.scheduledEquipment };
      for (const slot of Object.keys(scheduled) as EquipmentSlot[]) {
        const id = scheduled[slot];
        if (!id) continue;
        const def = EQUIPMENT_CATALOG[id];
        if (def && !def.compatibleRoles.includes(role)) delete scheduled[slot];
      }
      p.scheduledEquipment = scheduled;
    }
    this.recalcStats(p);
    this.addLog(
      `Ruolo riassegnato: ${ROLE_LABEL[role]}` + (removed > 0 ? ` (${removed} oggetti non piu' compatibili rimossi)` : ""),
    );
  }

  /**
   * Applica TUTTI gli equipaggiamenti programmati: va chiamata solo quando
   * la creatura e' fisicamente arrivata al Deposito Equipaggiamenti. Il
   * vecchio oggetto di ogni slot modificato torna nel Magazzino Equipaggiamenti,
   * il nuovo viene prelevato da li'. Ricalcola le statistiche finali una
   * sola volta al termine.
   */
  private applyScheduledEquipment(p: Entity) {
    const scheduled = p.scheduledEquipment;
    if (!scheduled || Object.keys(scheduled).length === 0) return;
    let changed = 0;
    const equipment = { ...(p.equipment ?? {}) };
    for (const slot of Object.keys(scheduled) as EquipmentSlot[]) {
      const newId = scheduled[slot];
      const oldId = equipment[slot];
      if (newId === oldId) continue; // nessun cambiamento reale da applicare
      if (oldId) {
        this.stats.equipmentStorage[oldId] = (this.stats.equipmentStorage[oldId] ?? 0) + 1;
      }
      if (newId) {
        const have = this.stats.equipmentStorage[newId] ?? 0;
        if (have <= 0) {
          this.addLog(
            `${EQUIPMENT_CATALOG[newId]?.name ?? newId} non e' piu' disponibile: slot lasciato invariato`,
          );
          continue;
        }
        this.stats.equipmentStorage[newId] = have - 1;
        equipment[slot] = newId;
      } else {
        delete equipment[slot];
      }
      changed++;
    }
    p.equipment = equipment;
    p.scheduledEquipment = {};
    if (changed > 0) {
      this.recalcStats(p);
      this.addLog(`Equipaggiamento aggiornato al Deposito (${changed} slot modificati)`);
    }
  }

  /** Stato descrittivo della creatura per la UI del Deposito Equipaggiamenti. */
  get creatureStatusLabel(): string {
    const p = this.player;
    if (!inVillage(p.transform.pos)) {
      return p.ai?.state === "attack" ? "In Combattimento" : "In Esplorazione";
    }
    if (p.ai?.state === "healing") return "In Ospedale";
    if (p.ai?.state === "returning" && p.returnStops?.[0] === "equipmentDepot") {
      return "Diretta al Deposito Equipaggiamenti";
    }
    return "Nel Villaggio";
  }

  private carriedTotal(): number {
    const c = this.stats.carried;
    return c.gold + c.gelatin + c.chitin + c.pelt + c.rareCrystal;
  }

  private collect(item: Entity) {
    item.alive = false;
    const kind = item.item!.kind as ItemKind;
    this.stats.carried[kind]++;
    this.addFloater(item, "+1", "#f5c542");
  }

  /**
   * Calcola la sequenza di edifici da visitare fisicamente al rientro,
   * filtrata su cio' che la creatura trasporta davvero e sul suo bisogno di
   * cure (GDD: "Se una creatura non possiede una determinata categoria di
   * risorse, salta automaticamente l'edificio corrispondente"). L'ordine
   * (Municipio -> Magazzino -> Deposito Equipaggiamenti -> Ospedale) segue
   * l'esempio del Game Design Document.
   */
  private buildReturnStops(p: Entity): BuildingKind[] {
    const c = this.stats.carried;
    const hasCategory: Record<ItemCategory, boolean> = {
      gold: false,
      material: false,
      equipment: false,
      consumable: false,
    };
    for (const k of Object.keys(c) as ItemKind[]) {
      if (c[k] > 0) hasCategory[ITEM_CATEGORY[k]] = true;
    }
    // Un equipaggiamento programmato ma non ancora applicato deve portare la
    // creatura al Deposito anche se non trasporta alcun oggetto equipaggiamento.
    const hasPendingEquip = !!p.scheduledEquipment && Object.keys(p.scheduledEquipment).length > 0;
    const stops: BuildingKind[] = [];
    if (hasCategory.gold) stops.push(DEPOSIT_BUILDING.gold);
    if (hasCategory.material) stops.push(DEPOSIT_BUILDING.material);
    if (hasCategory.equipment || hasPendingEquip) stops.push(DEPOSIT_BUILDING.equipment);
    if (p.health && p.health.hp < p.health.maxHp) stops.push("hospital");
    return stops;
  }

  /**
   * Deposita fisicamente, in un edificio, tutti gli oggetti portati che
   * appartengono alla sua categoria (nessun deposito automatico all'ingresso
   * del villaggio: la creatura deve davvero raggiungere ogni edificio).
   */
  private depositAtBuilding(p: Entity, stop: BuildingKind) {
    const category = (Object.keys(DEPOSIT_BUILDING) as ItemCategory[]).find(
      (cat) => DEPOSIT_BUILDING[cat] === stop,
    );
    if (category) {
      const c = this.stats.carried;
      let total = 0;
      for (const k of Object.keys(c) as ItemKind[]) {
        if (ITEM_CATEGORY[k] !== category) continue;
        const amt = c[k];
        if (amt <= 0) continue;
        this.stats.bank[k] += amt;
        c[k] = 0;
        total += amt;
      }
      if (total > 0) {
        this.addLog(`Depositato a ${BUILDINGS[stop].name}: ${total} oggetti`);
      }
    }
    // Al Deposito Equipaggiamenti, oltre al deposito, si applica anche
    // l'Equipaggiamento Programmato (se presente) — GDD: "il cambio avviene
    // solo quando raggiunge fisicamente il Deposito Equipaggiamenti".
    if (stop === "equipmentDepot") {
      this.applyScheduledEquipment(p);
    }
  }

  // ---- Movimento di supporto -------------------------------------------------
  // Vero solo se il punto e' fuori dal villaggio E appartiene esattamente al
  // bioma indicato. E' il SINGOLO punto di verita' usato ovunque si debba
  // decidere se una posizione appartiene a una Zona Specifica: nessun altro
  // controllo di confine deve essere reinventato altrove.
  private inZone(pos: Vec2, biome: BiomeId): boolean {
    return !inVillage(pos) && biomeAt(pos) === biome;
  }

  // Angolo (radianti) scelto a caso ma GARANTITO all'interno del settore
  // angolare del bioma indicato, usando lo stesso schema di biomeAt (dominio
  // "shiftato": Prateria = [0,180), gli altri 6 biomi = fette da 30°
  // consecutive in [180,360)). Campionare direttamente dentro l'intervallo
  // corretto, invece di campionare a caso su tutto il cerchio e scartare i
  // punti sbagliati, garantisce per costruzione che il punto sia nel bioma
  // giusto: zero probabilita' di fallimento, non serve alcun ripiego.
  private randomAngleInBiome(biome: BiomeId): number {
    let shiftedStart: number;
    let shiftedSpan: number;
    if (biome === "prateria") {
      shiftedStart = 0;
      shiftedSpan = 180;
    } else {
      const idx = BIOME_ORDER.indexOf(biome); // 1..6
      shiftedStart = 180 + (idx - 1) * 30;
      shiftedSpan = 30;
    }
    const shifted = shiftedStart + Math.random() * shiftedSpan;
    const angDeg = shifted - 90;
    return (angDeg * Math.PI) / 180;
  }

  // Punto sicuro e deterministico all'interno del bioma indicato (sulla
  // bisettrice del suo settore angolare, a distanza di sicurezza dal
  // villaggio). Usato SOLO come ultimo ripiego se il campionamento casuale
  // locale non trova nulla entro i tentativi consentiti: e' comunque sempre
  // dentro zona, mai un teletrasporto fuori dai suoi confini.
  private safeZonePoint(biome: BiomeId, radius = VILLAGE.radius + 8): Vec2 {
    let shiftedStart: number;
    let shiftedSpan: number;
    if (biome === "prateria") {
      shiftedStart = 0;
      shiftedSpan = 180;
    } else {
      const idx = BIOME_ORDER.indexOf(biome);
      shiftedStart = 180 + (idx - 1) * 30;
      shiftedSpan = 30;
    }
    const angDeg = shiftedStart + shiftedSpan / 2 - 90;
    const ang = (angDeg * Math.PI) / 180;
    return { x: clampWorld(Math.cos(ang) * radius), y: clampWorld(Math.sin(ang) * radius) };
  }

  // Sceglie un punto casuale entro `radius` da `center` (o dalla posizione
  // attuale). Se `restrictBiome` e' indicato, il punto scelto appartiene
  // SEMPRE a quel bioma: i candidati fuori zona vengono scartati, e se dopo
  // 20 tentativi non se ne trova uno buono si ripiega su un punto sicuro
  // dentro la zona (mai fuori, mai l'ultimo candidato scartato).
  private pickWanderTarget(
    p: Entity,
    center?: Vec2,
    radius = WANDER.radius,
    restrictBiome: BiomeId | null = null,
  ) {
    const c = center ?? p.transform.pos;
    let candidate: Vec2 | null = null;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2;
      // Campionamento uniforme sull'area del cerchio (sqrt), non solo sull'angolo:
      // altrimenti i punti si addensano vicino al centro (dove c'e' il Municipio).
      const r = Math.sqrt(Math.random()) * radius;
      const cand: Vec2 = {
        x: clampWorld(c.x + Math.cos(a) * r),
        y: clampWorld(c.y + Math.sin(a) * r),
      };
      if (this.isInsideAnyBuilding(cand)) continue;
      if (restrictBiome && !this.inZone(cand, restrictBiome)) continue;
      candidate = cand;
      break;
    }
    if (!candidate) {
      // Nessun candidato valido trovato: ripiego deterministico, sempre
      // dentro alla zona assegnata (mai un punto fuori confine).
      candidate = restrictBiome ? this.safeZonePoint(restrictBiome) : { ...c };
    }
    p.ai!.wanderTarget = candidate;
    p.ai!.wanderTimer = rand(WANDER.minWait, WANDER.maxWait);
  }

  // Vero solo se il punto cade dentro l'ingombro fisico di un edificio: un
  // target li' dentro non sarebbe mai raggiungibile (la creatura verrebbe
  // sempre respinta prima di arrivarci) e la farebbe restare "impalata"
  // accanto all'edificio a tempo indeterminato.
  private isInsideAnyBuilding(pos: Vec2): boolean {
    for (const b of Object.values(BUILDINGS)) {
      if (dist(pos, b.pos) < b.collisionRadius + 0.5) return true;
    }
    return false;
  }

  // Trova il varco (gate) piu' vicino a un punto dato.
  private nearestGate(to: Vec2): Vec2 {
    const r = VILLAGE.radius;
    const gates: Vec2[] = [
      { x: VILLAGE.x, y: VILLAGE.y - r },
      { x: VILLAGE.x, y: VILLAGE.y + r },
      { x: VILLAGE.x + r, y: VILLAGE.y },
      { x: VILLAGE.x - r, y: VILLAGE.y },
    ];
    let best = gates[0];
    let bd = Infinity;
    for (const g of gates) {
      const d = dist(g, to);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return best;
  }

  // Muove la creatura verso un target, passando dal varco quando deve
  // attraversare il muro del villaggio (cosi' non resta mai bloccata).
  private moveTo(p: Entity, target: Vec2, dt: number) {
    const inV = inVillage(p.transform.pos);
    const targetInV = inVillage(target);
    if (inV === targetInV) {
      moveToward(p, target, dt, true);
      return;
    }
    // Punta sempre direttamente al varco (e un po' oltre), avvicinandosi in
    // diagonale: lo scivolamento lungo il muro in moveToward la fa "scorrere"
    // naturalmente fino a trovare l'apertura, senza bisogno di una fase
    // separata di allineamento orizzontale/verticale (che dava un movimento
    // innaturale, solo a 4 direzioni).
    const gate = this.nearestGate(inV ? target : p.transform.pos);
    const vertical = Math.abs(gate.y - VILLAGE.y) > Math.abs(gate.x - VILLAGE.x);
    const outSign = gate.y - VILLAGE.y >= 0 ? 1 : -1;
    const outSignX = gate.x - VILLAGE.x >= 0 ? 1 : -1;
    const dir = inV ? 1 : -1;
    const through = vertical
      ? { x: gate.x, y: gate.y + dir * outSign * 3 }
      : { x: gate.x + dir * outSignX * 3, y: gate.y };
    moveToward(p, through, dt, true);
  }

  // ---- FSM della creatura giocabile ------------------------------------------
  private updateCreature(dt: number) {
    const p = this.player;
    if (!p.alive || !p.health || !p.ai || !p.combat) return;
    const ratio = p.health.hp / p.health.maxHp;
    const mode: AiMode = p.aiMode ?? "rest";

    // --- Cura in corso (una delle tappe del rientro): priorita' assoluta
    // finche' non e' completa, poi si toglie l'Ospedale dalla coda e si
    // prosegue con le tappe restanti (o si riprende l'attivita' precedente
    // se la coda e' vuota). ---
    if (p.ai.state === "healing") {
      p.health.hp = Math.min(p.health.maxHp, p.health.hp + PLAYER.healPerSecond * dt);
      if (ratio >= FULL_HEAL_RATIO) {
        p.returnStops = (p.returnStops ?? []).filter((s) => s !== "hospital");
        p.ai.state = "returning";
      }
      return;
    }

    // --- Rientro forzato: HP bassi, inventario pieno (solo esplorando),
    // equipaggiamento programmato in attesa, oppure modalita' Riposo. Ha
    // sempre priorita'. Appena scatta, calcoliamo UNA VOLTA la sequenza di
    // edifici da visitare fisicamente (Municipio -> Magazzino -> Deposito
    // Equipaggiamenti -> Ospedale), saltando quelli non necessari. ---
    const mustReturnHp = ratio <= RETREAT_HP_RATIO && !inVillage(p.transform.pos);
    const mustReturnInv =
      (mode === "explore" || mode === "zone") && this.carriedTotal() >= INVENTORY_CAP;
    // GDD "Gestione Equipaggiamento Programmata": vale sempre, che la
    // creatura sia fuori, in villaggio, in ospedale o in attesa.
    const mustApplyEquip =
      !!p.scheduledEquipment && Object.keys(p.scheduledEquipment).length > 0;
    if (
      (mustReturnHp || mustReturnInv || mustApplyEquip || mode === "rest") &&
      p.ai.state !== "returning"
    ) {
      if (p.ai.state !== "idle" || mustReturnHp || mustReturnInv || mustApplyEquip) {
        if (mustReturnHp) this.addLog("HP basso — rientro al Villaggio");
        else if (mustReturnInv) this.addLog("Inventario pieno — rientro al Villaggio");
        else if (mustApplyEquip) this.addLog("Equipaggiamento programmato — diretto al Deposito");
        p.returnStops = this.buildReturnStops(p);
        p.ai.state = "returning";
      }
    }

    if (p.ai.state === "returning") {
      const stops = p.returnStops ?? [];
      if (stops.length === 0) {
        // Sequenza completata: riprende automaticamente l'attivita' precedente.
        if (mode === "explore" || mode === "zone") {
          p.ai.state = "leaving";
          this.stats.trips++;
          this.addLog("Rientro completato — riparte in esplorazione");
        } else if (mode === "defend") {
          p.ai.state = "patrol";
        } else {
          p.ai.state = "idle";
        }
        return;
      }
      const stop = stops[0];
      const building = BUILDINGS[stop];
      this.moveTo(p, building.pos, dt);
      if (dist(p.transform.pos, building.pos) <= building.radius) {
        if (stop === "hospital") {
          p.ai.state = "healing"; // richiede piu' frame: gestito sopra
        } else {
          this.depositAtBuilding(p, stop);
          stops.shift();
        }
      }
      return;
    }

    // --- Modalita' Riposo: resta in villaggio, vaga liberamente. ---
    if (mode === "rest") {
      p.ai.state = "idle";
      p.ai.wanderTimer = (p.ai.wanderTimer ?? 0) - dt;
      if (!p.ai.wanderTarget || p.ai.wanderTimer <= 0)
        this.pickWanderTarget(p, VILLAGE, VILLAGE.radius - 1.5);
      this.moveTo(p, p.ai.wanderTarget!, dt);
      if (dist(p.transform.pos, p.ai.wanderTarget!) < 0.4)
        this.pickWanderTarget(p, VILLAGE, VILLAGE.radius - 1.5);
      return;
    }

    // --- Modalita' Difesa Villaggio: pattuglia, combatte se un nemico si
    // avvicina troppo alle mura (pronta per un futuro sistema di invasioni). ---
    if (mode === "defend") {
      const threat = this.nearestEnemy(p);
      if (threat) {
        const d = dist(p.transform.pos, threat.transform.pos);
        if (d <= VILLAGE.radius + 3) {
          if (d <= p.combat.range) this.doAttack(p, threat);
          else moveToward(p, threat.transform.pos, dt, true);
          return;
        }
      }
      p.ai.state = "patrol";
      p.ai.wanderTimer = (p.ai.wanderTimer ?? 0) - dt;
      if (!p.ai.wanderTarget || p.ai.wanderTimer <= 0)
        this.pickWanderTarget(p, VILLAGE, VILLAGE.radius - 1.5);
      this.moveTo(p, p.ai.wanderTarget!, dt);
      if (dist(p.transform.pos, p.ai.wanderTarget!) < 0.4)
        this.pickWanderTarget(p, VILLAGE, VILLAGE.radius - 1.5);
      return;
    }

    // --- Esplorazione Libera o Zona Specifica: esce dal villaggio. In "zone"
    // il bersaglio deve appartenere al bioma scelto dal giocatore; in
    // "explore" nessun vincolo (esplora tutta la mappa, anche se solo la
    // Prateria contiene effettivamente qualcosa). ---
    const restrictBiome: BiomeId | null = mode === "zone" ? p.zoneBiome ?? "prateria" : null;
    if (p.ai.state === "leaving" || p.ai.state === "idle" || p.ai.state === "patrol") {
      p.ai.state = "leaving";
      if (!p.ai.wanderTarget || inVillage(p.ai.wanderTarget)) {
        // In Zona Specifica campioniamo l'angolo DIRETTAMENTE dentro il
        // settore del bioma scelto: il punto appartiene sempre a quella zona
        // per costruzione, non serve scartare/ritentare punti sbagliati.
        const ang = restrictBiome ? this.randomAngleInBiome(restrictBiome) : rand(0, Math.PI * 2);
        const r = VILLAGE.radius + rand(5, 14);
        p.ai.wanderTarget = {
          x: clampWorld(Math.cos(ang) * r),
          y: clampWorld(Math.sin(ang) * r),
        };
      }
      this.moveTo(p, p.ai.wanderTarget, dt);
      if (!inVillage(p.transform.pos)) {
        p.ai.state = "seek";
        p.ai.wanderTarget = null;
      }
      return;
    }

    if (p.ai.state === "seek" || p.ai.state === "attack") {
      // In Zona Specifica, nemici/oggetti fuori dal bioma assegnato vengono
      // ignorati: altrimenti inseguire un bersaglio appena oltre il confine
      // trascinerebbe la creatura fuori dalla propria area.
      const enemy = this.nearestEnemy(p, restrictBiome);
      if (enemy && dist(p.transform.pos, enemy.transform.pos) <= EXPLORE_DETECT_RANGE) {
        const d = dist(p.transform.pos, enemy.transform.pos);
        if (d <= p.combat.range) {
          p.ai.state = "attack";
          this.doAttack(p, enemy);
        } else {
          p.ai.state = "seek";
          moveToward(p, enemy.transform.pos, dt, true);
        }
        return;
      }
      const item = this.nearestItem(p, restrictBiome);
      if (item && dist(p.transform.pos, item.transform.pos) <= EXPLORE_DETECT_RANGE) {
        moveToward(p, item.transform.pos, dt, true);
        return;
      }
      // Nessun nemico/oggetto nei paraggi: continua a vagare (nel proprio
      // bioma se in Zona Specifica) in cerca del prossimo bersaglio. Sia la
      // prima scelta sia il re-pick al raggiungimento passano sempre dallo
      // stesso pickWanderTarget con lo stesso vincolo di zona.
      p.ai.wanderTimer = (p.ai.wanderTimer ?? 0) - dt;
      if (!p.ai.wanderTarget || p.ai.wanderTimer <= 0) {
        this.pickWanderTarget(p, p.transform.pos, 6, restrictBiome);
      }
      moveToward(p, p.ai.wanderTarget!, dt, true);
      if (dist(p.transform.pos, p.ai.wanderTarget!) < 0.3) {
        this.pickWanderTarget(p, p.transform.pos, 6, restrictBiome);
      }
      return;
    }
  }

  // Modifiche 4-5-6: ogni mostro (Boss incluso) individua/insegue/attacca un
  // bersaglio entro il proprio Aggro Range; se il bersaglio esce da tale
  // raggio, o se il mostro supera la propria Leash Distance dallo Spawn
  // Point, abbandona il combattimento e rientra recuperando lentamente vita.
  private updateEnemy(e: Entity, dt: number) {
    if (!e.alive || !e.ai || !e.spawnPos) return;
    const p = this.player;
    const spawnPos = e.spawnPos;
    const spawnRadius = e.spawnRadius ?? WANDER.radius;
    const aggroRange = e.aggroRange ?? 0;
    const leashDistance = e.leashDistance ?? spawnRadius;

    // --- Rientro alla Spawn Area (leash) -------------------------------------
    if (e.ai.state === "returning") {
      moveToward(e, spawnPos, dt, true);
      if (e.health) {
        e.health.hp = Math.min(e.health.maxHp, e.health.hp + LEASH_HEAL_PER_SECOND * dt);
      }
      if (dist(e.transform.pos, spawnPos) < 0.5) {
        e.ai.state = "idle";
        e.ai.targetId = null;
      }
      return;
    }

    const targetReachable = p.alive && !inVillage(p.transform.pos);
    const dToTarget = targetReachable ? dist(e.transform.pos, p.transform.pos) : Infinity;

    // --- Aggancia un bersaglio se entra nell'Aggro Range ---------------------
    if (!e.ai.targetId && targetReachable && dToTarget <= aggroRange) {
      e.ai.targetId = p.id;
      e.ai.state = "seek";
    }

    if (e.ai.targetId === p.id) {
      const distFromSpawn = dist(e.transform.pos, spawnPos);
      const lostTarget = !targetReachable || dToTarget > aggroRange;
      const overLeash = distFromSpawn > leashDistance;
      if (lostTarget || overLeash) {
        e.ai.targetId = null;
        e.ai.state = "returning";
        return;
      }
      if (dToTarget <= e.combat!.range) {
        e.ai.state = "attack";
        this.doAttack(e, p);
      } else {
        e.ai.state = "seek";
        moveToward(e, p.transform.pos, dt, true);
      }
      return;
    }

    // --- Nessun bersaglio: vaga entro il proprio Spawn Radius -----------------
    e.ai.state = "idle";
    e.ai.wanderTimer = (e.ai.wanderTimer ?? 0) - dt;
    if (!e.ai.wanderTarget || e.ai.wanderTimer <= 0)
      this.pickWanderTarget(e, spawnPos, spawnRadius);
    moveToward(e, e.ai.wanderTarget!, dt, true);
  }

  update(dt: number) {
    for (const e of this.entities) {
      e.moving = false;
      if (e.combat && e.combat.cdLeft > 0) e.combat.cdLeft -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackAnim > 0) e.attackAnim -= dt;
      if (e.item) {
        e.item.ttl -= dt;
        if (e.item.ttl <= 0) e.alive = false;
      }
    }

    for (const f of this.floaters) f.age += dt;
    this.floaters = this.floaters.filter((f) => f.age < f.ttl);

    this.updateCreature(dt);
    for (const e of this.entities) if (e.faction === "enemy") this.updateEnemy(e, dt);

    // raccolta oggetti
    for (const e of this.entities) {
      if (e.alive && e.kind === "item") {
        if (dist(e.transform.pos, this.player.transform.pos) <= PLAYER.itemPickupRadius) {
          this.collect(e);
        }
      }
    }

    this.entities = this.entities.filter((e) => e.alive);

    // spawn mostri della Prateria (fino al massimo consentito)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const count = this.entities.filter(
        (e) => e.faction === "enemy" && !e.isBoss,
      ).length;
      if (count < MAX_ENEMIES) this.spawnEnemy();
      this.spawnTimer = ENEMY_SPAWN_INTERVAL;
    }

    // respawn automatico del Boss
    if (!this.bossAlive) {
      this.bossRespawnTimer -= dt;
      if (this.bossRespawnTimer <= 0) this.spawnBoss();
    }

    // Artigiani/Crafting: avanzano sempre, indipendentemente da dove si
    // trova la creatura ("Gli artigiani lavorano automaticamente").
    this.crafting.tick(dt);
    this.academy.tick(dt);
  }
}

export { ITEMS };
