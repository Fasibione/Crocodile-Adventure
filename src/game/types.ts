// Shared game types. Component-based: entities are bags of optional components.
//
// VERTICAL SLICE SCOPE (see Game Design Document):
// - Una sola specie giocabile: Coccodrillo.
// - Un solo bioma attivo: Prateria (altri 6 biomi presenti ma vuoti).
// - Un solo Boss.
// - Edifici: Municipio, Ospedale, Fabbro, Magazzino, Deposito Equipaggiamenti.
// - Sistema di equipaggiamento completo (8 slot, ruoli, rarita'), senza
//   ancora crafting/potenziamento/vendita.
// Questi tipi restano volutamente estendibili (union types) cosi' in futuro si
// potranno aggiungere nuove specie / mostri / edifici / oggetti senza
// riscrivere nulla.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Stats {
  hp: number; // used as max-hp template
  attack: number;
  defense: number;
  speed: number; // tiles per second
}

// Mostri della Prateria (vertical slice) + Boss.
export type EnemyKind = "slime" | "scarab" | "rabbit" | "boss_prateria";
// Materiali/oggetti gia' esistenti (loot di esplorazione, NON modificato) +
// nuove risorse per il Crafting (Armaiolo/Orafo/Alchimista) e i loro
// prodotti (pozioni). Estensione puramente additiva: i 5 kind originali
// restano identici, tutto cio' che li usa continua a funzionare invariato.
export type ItemKind =
  | "gold"
  | "gelatin"
  | "chitin"
  | "pelt"
  | "rareCrystal"
  // --- Materiali da Crafting (acquistabili dal Mercante) ---
  | "wood" // Legno (Armaiolo)
  | "iron" // Ferro (Armaiolo)
  | "steel" // Acciaio (Armaiolo)
  | "gem" // Gemme (Orafo)
  | "herb" // Erbe (Alchimista)
  | "mushroom" // Funghi (Alchimista)
  // --- Prodotti dell'Alchimista (consumabili, non equipaggiamento) ---
  | "potionHp"
  | "potionBuff"
  | "potionDefense"
  | "potionSpeed";
export type EntityKind = "player" | EnemyKind | "item";
export type Faction = "player" | "enemy" | "none";

// Solo il Coccodrillo e' giocabile per ora. Union type per restare estendibile.
export type Species = "croc";

// Slot equipaggiamento (GDD cap. 27): 8 slot per creatura, 6 visibili
// (modificano lo sprite tramite layer indipendenti) + 2 non visibili
// (modificano solo le statistiche).
export type EquipmentSlot =
  | "weaponRight" // Arma Mano Destra (visibile)
  | "weaponLeft" // Arma Mano Sinistra / Scudo (visibile)
  | "helmet" // Elmo (visibile)
  | "armor" // Armatura (visibile)
  | "gloves" // Guanti (visibile)
  | "boots" // Stivali (visibile)
  | "ring" // Anello (non visibile)
  | "belt"; // Cintura (non visibile)

// Ruolo di combattimento di una creatura: determina quali tipi di
// equipaggiamento puo' indossare (GDD cap. 27 "Compatibilita'").
export type Role = "tank" | "physical" | "special" | "agile" | "balanced";

// Rarita' di un oggetto (GDD cap. 27).
export type Rarity = "comune" | "nonComune" | "raro" | "epico" | "leggendario" | "mitico";

// Tipo specifico di un oggetto: determina sia lo slot occupato sia i ruoli
// compatibili (vedi config.ts: EQUIPMENT_TYPE_SLOT / EQUIPMENT_TYPE_ROLES).
// Aggiungere un nuovo tipo di arma/oggetto in futuro richiede solo una nuova
// voce qui + le due mappe in config.ts.
export type EquipmentType =
  | "sword" // Spada
  | "axe" // Ascia
  | "spear" // Lancia
  | "mace" // Mazza
  | "hammer" // Martello
  | "shield" // Scudo
  | "bow" // Arco (Armaiolo)
  | "staff" // Bastone
  | "wand" // Bacchetta
  | "spellbook" // Libro Magico
  | "dualBlades" // Doppie Lame
  | "daggers" // Pugnali
  | "lightSpear" // Lancia Leggera
  | "helmet"
  | "armor"
  | "gloves"
  | "boots"
  | "ring" // Anello (Orafo)
  | "necklace" // Collana (Orafo) - occupa lo slot "ring" insieme agli anelli
  | "amulet" // Amuleto (Orafo) - occupa lo slot "ring" insieme agli anelli
  | "belt";

// Definizione di un oggetto equipaggiabile. Il catalogo (config.ts) e' un
// placeholder pronto ad essere sostituito/esteso dal futuro sistema di
// Crafting: la struttura dati non cambia, cambia solo la fonte degli oggetti.
export interface EquipmentDef {
  id: string;
  name: string;
  type: EquipmentType;
  slot: EquipmentSlot;
  rarity: Rarity;
  level: number;
  // Statistiche bonus sommate a quelle base della creatura quando indossato.
  statBonus: Partial<Stats>;
  // Ruoli che possono equipaggiare questo oggetto.
  compatibleRoles: Role[];
  // true per i 6 slot visibili (modificano lo sprite), false per i 2 non
  // visibili (Anello, Cintura).
  visible: boolean;
  // Placeholder per il layer grafico indipendente che il futuro sistema di
  // sprite-layering disegnera' sopra il corpo della creatura.
  layer: EquipmentSlot | null;
}

// Edifici del villaggio. I primi 5 (gia' funzionanti, NON modificati) +
// i 6 nuovi edifici degli Artigiani/Crafting di questa iterazione.
export type BuildingKind =
  | "townhall"
  | "hospital"
  | "smithy"
  | "warehouse"
  | "equipmentDepot"
  | "armorer" // Armaiolo
  | "goldsmith" // Orafo
  | "alchemist" // Alchimista
  | "academy" // Accademia
  | "barracks" // Caserma
  | "merchant"; // Mercante

// Categoria di un oggetto ai fini del deposito: determina in quale edificio
// va depositato (Municipio = oro, Magazzino = materiali/consumabili,
// Deposito Equipaggiamenti = equipaggiamenti). Aggiungere nuovi ItemKind in
// futuro richiede solo di mapparli a una di queste categorie in config.ts.
export type ItemCategory = "gold" | "material" | "equipment" | "consumable";

// I 7 biomi della mappa (GDD cap. 9/Zona Specifica). Solo la Prateria e'
// attiva in questa vertical slice: gli altri esistono come aree vuote.
export type BiomeId =
  | "prateria"
  | "foresta"
  | "deserto"
  | "palude"
  | "montagne"
  | "ghiacciaio"
  | "vulcano";

// Modalita' IA assegnabile dal giocatore (GDD cap. 9):
// Riposo, Esplorazione Libera, Zona Specifica, Difesa del Villaggio.
export type AiMode = "rest" | "explore" | "zone" | "defend";

// --- Components ---
export interface Transform {
  pos: Vec2;
  facing: number; // -1 left, 1 right
}

export interface Health {
  hp: number;
  maxHp: number;
}

export interface Combat {
  attack: number;
  defense: number;
  range: number;
  cooldown: number;
  cdLeft: number;
}

export interface Movement {
  speed: number;
}

export interface LevelComp {
  level: number;
  xp: number;
  xpToNext: number;
}

export interface ItemComp {
  kind: ItemKind;
  ttl: number;
}

// Stati interni della macchina a stati IA (non confondere con AiMode, che e'
// la modalita' scelta dal giocatore: rest/explore/zone/defend).
export type AiState =
  | "idle" // in villaggio, nessun ordine specifico
  | "toHospital" // legacy: non piu' generato, mantenuto per compatibilita' salvataggi
  | "healing" // fermo in un edificio del percorso di rientro, si sta curando
  | "leaving" // sta uscendo dal villaggio verso la Prateria
  | "seek" // esplorazione: cerca/insegue un nemico
  | "attack" // in combattimento
  | "returning" // HP basso, inventario pieno o Riposo: sta visitando in
  // sequenza gli edifici del villaggio (returnStops) per depositare le
  // risorse trasportate e curarsi se necessario
  | "patrol"; // Difesa Villaggio: pattuglia il villaggio

export interface Entity {
  id: number;
  kind: EntityKind;
  faction: Faction;
  alive: boolean;
  transform: Transform;
  health?: Health;
  combat?: Combat;
  movement?: Movement;
  level?: LevelComp;
  item?: ItemComp;
  ai?: {
    state: AiState;
    targetId: number | null;
    wanderTarget?: Vec2 | null;
    wanderTimer?: number;
  };
  // transient visual flags
  hitFlash: number;
  attackAnim: number;
  moving?: boolean;
  // which playable species this entity is
  species?: Species;
  // ruolo di combattimento (determina la compatibilita' dell'equipaggiamento)
  role?: Role;
  // Statistiche base (specie + bonus livello), SENZA equipaggiamento. Le
  // statistiche finali (health.maxHp, combat.attack/defense, movement.speed)
  // sono sempre ricalcolate come baseStats + bonus dell'equipaggiamento
  // indossato (vedi engine.ts: recalcStats). Non vanno mai mutate
  // direttamente: si aggiornano baseStats (es. al level up) e si richiama
  // recalcStats.
  baseStats?: Stats;
  // modalita' IA assegnata dal giocatore (solo entita' giocabili)
  aiMode?: AiMode;
  // bioma scelto quando aiMode === "zone" (Zona Specifica)
  zoneBiome?: BiomeId;
  // equipped gear per slot (maps slot -> equipment id)
  equipment?: Partial<Record<EquipmentSlot, string>>;
  // "Equipaggiamento Programmato" (GDD cap. 27/Villaggio): assegnazioni in
  // attesa, non ancora indossate. Il valore e' l'id del nuovo oggetto, oppure
  // null per programmare la rimozione dello slot. Diventa effettivo solo
  // quando la creatura raggiunge fisicamente il Deposito Equipaggiamenti.
  scheduledEquipment?: Partial<Record<EquipmentSlot, string | null>>;
  // xp granted when this entity (an enemy) is defeated
  xpReward?: number;
  // true se questo nemico e' il Boss della Prateria
  isBoss?: boolean;
  // --- Spawn Point / Aggro / Leash (solo mostri) ---
  // Punto e raggio dell'area di spawn a cui il mostro appartiene: quando deve
  // rientrare (aggro perso o leash superato) torna sempre qui.
  spawnPos?: Vec2;
  spawnRadius?: number;
  // Raggio entro cui il mostro individua e insegue un bersaglio.
  aggroRange?: number;
  // Distanza massima dal proprio Spawn Point durante l'inseguimento: oltre
  // questa soglia il mostro abbandona il combattimento e rientra curandosi.
  leashDistance?: number;
  // --- Aggiramento edifici (vedi engine.ts: resolveNavTarget) ---
  // Punto di aggiramento calcolato UNA sola volta quando il percorso diretto
  // risulta bloccato da un edificio: resta fisso (stesso lato) finche' non
  // viene raggiunto, invece di essere ricalcolato ad ogni frame.
  navWaypoint?: Vec2 | null;
  // Destinazione originale per cui e' stato calcolato navWaypoint: se la
  // destinazione cambia in modo significativo, il waypoint va ricalcolato.
  navWaypointTarget?: Vec2 | null;
  // --- Percorso di rientro nel Villaggio (vedi engine.ts: buildReturnStops) ---
  // Coda ordinata degli edifici ancora da raggiungere fisicamente durante il
  // rientro (Municipio -> Magazzino -> Deposito Equipaggiamenti -> Ospedale),
  // filtrata su cio' che la creatura trasporta davvero. Una volta svuotata,
  // la creatura riprende automaticamente l'attivita' precedente.
  returnStops?: BuildingKind[];
}

// =============================================================================
// ARTIGIANI & CRAFTING (nuova iterazione) — tipi condivisi dai manager
// indipendenti (RecipeManager, CraftingManager, AcademyManager,
// MerchantManager). Nessuno di questi tipi altera i tipi esistenti sopra.
// =============================================================================

// I 3 edifici che producono oggetti tramite ricette.
export type CraftingBuilding = "armorer" | "goldsmith" | "alchemist";

export interface RecipeCost {
  item: ItemKind;
  amount: number;
}

// Cosa produce una ricetta: un oggetto equipaggiabile (riferimento al
// catalogo EQUIPMENT_CATALOG) oppure un consumabile (pozione).
export interface RecipeResult {
  kind: "equipment" | "consumable";
  equipmentId?: string; // se kind === "equipment"
  item?: ItemKind; // se kind === "consumable"
  amount?: number; // quantita' prodotta (default 1)
}

// Una ricetta di Crafting (RecipeManager). Facilmente espandibile: basta
// aggiungere una nuova voce al catalogo, nessuna modifica al motore.
export interface Recipe {
  id: string;
  building: CraftingBuilding;
  name: string;
  materials: RecipeCost[];
  goldCost: number;
  productionTimeSec: number;
  result: RecipeResult;
}

// Un ordine di produzione in coda presso un edificio artigiano
// (CraftingManager). I materiali/oro vengono scalati subito alla messa in
// coda (evita di spendere due volte le stesse risorse su piu' ordini).
export interface ProductionOrder {
  id: string;
  recipeId: string;
  building: CraftingBuilding;
  totalTime: number;
  remaining: number;
  ready: boolean; // true quando remaining <= 0: in attesa di ritiro
}

// --- Accademia (AcademyManager) --------------------------------------------
// Solo la struttura di base per questa iterazione (elenco, blocco/sblocco,
// timer): l'applicazione reale dei bonus e' rimandata a una fase successiva.
export type ResearchStatus = "locked" | "available" | "researching" | "completed";

export interface ResearchDef {
  id: string;
  name: string;
  description: string;
  timeSec: number;
  goldCost: number;
  materials: RecipeCost[];
  // Ricerche che devono essere completate prima che questa diventi disponibile.
  requires?: string[];
}

export interface ResearchState {
  status: ResearchStatus;
  remaining: number; // secondi rimanenti se status === "researching"
}

// --- Mercante (MerchantManager) ---------------------------------------------
export interface MerchantListing {
  item: ItemKind;
  basePrice: number;
}

// =============================================================================
// BIOMI & SPAWN NEMICI (nuova iterazione) — tipi condivisi dai moduli
// indipendenti (BiomeData, BiomeManager, EnemyDefinition, SpawnTable,
// LootTable, EnemySpawnManager). Sistema completamente nuovo e autonomo:
// NON tocca ne' dipende da Engine/Combattimento/IA/Pathfinding/Inventario,
// che restano quelli gia' funzionanti e non modificati.
// =============================================================================

// Tier di un nemico: i Comuni spawnano a peso, gli Elite sono rari e piu'
// forti, i Boss non spawnano mai casualmente (sistema dedicato).
export type EnemyTier = "common" | "elite" | "boss";

// Una risorsa raccoglibile propria di un bioma. Per questa iterazione e'
// puro dato descrittivo (pronta per un futuro sistema di raccolta): non
// introduce nuovi ItemKind ne' tocca Inventario/Magazzino.
export interface ResourceDefinition {
  id: string;
  name: string;
}

// Definizione di un nemico (comune, elite o boss). Le statistiche sono
// derivate da una formula in base al tier e al livello (vedi
// enemyDefinitions.ts): aggiungere un nemico richiede solo una riga.
export interface BiomeEnemyDefinition {
  id: string;
  name: string;
  biome: BiomeId;
  tier: EnemyTier;
  level: number;
  stats: Stats;
  xp: number;
  // Peso per la selezione casuale pesata tra i Comuni. 0 per gli Elite di
  // base (sovrascritto da una probabilita' dedicata molto bassa) e sempre
  // 0 per i Boss (mai selezionati a caso).
  spawnWeight: number;
  // "Gli Elite devono essere piu' grandi": moltiplicatore di scala per il
  // rendering (placeholder, nessuno sprite reale ancora).
  sizeMultiplier: number;
  // Colore placeholder in attesa di uno sprite dedicato.
  color: string;
  // Gli Elite/Boss droppano piu' materiali: moltiplicatore sulla LootTable.
  lootMultiplier: number;
}

export interface LootTableEntry {
  resourceId: string;
  chance: number; // 0..1
  amountMin: number;
  amountMax: number;
}

// Parametri di spawn di un bioma (Modifica "SPAWN" della richiesta): ogni
// bioma li controlla autonomamente, nessun valore condiviso/hardcoded nel
// manager.
export interface BiomeSpawnConfig {
  maxEnemies: number;
  spawnChancePerTick: number; // probabilita' (0..1) di un tentativo di spawn quando c'e' spazio
  respawnTimeSec: number; // tempo minimo tra un tentativo di spawn e il successivo
  minDistanceFromPlayer: number;
  minDistanceBetweenEnemies: number;
  eliteChance: number; // probabilita' (0..1) che uno spawn "comune" sia in realta' un Elite
}

// Definizione completa di un bioma (BiomeData). BiomeId e' quello gia'
// esistente e condiviso col resto del progetto (Zona Specifica, mappa):
// non viene ridefinito, solo riutilizzato.
export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  minLevel: number;
  maxLevel: number;
  minimapColor: string;
  music: string; // placeholder: nome del brano, nessun audio reale ancora
  environment: string;
  commonEnemyIds: string[];
  eliteEnemyIds: string[];
  bossEnemyId: string;
  resources: ResourceDefinition[];
  spawn: BiomeSpawnConfig;
}

