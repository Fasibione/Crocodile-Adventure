// Central tuning config. New creatures/enemies/buildings get added here.
//
// VERTICAL SLICE: solo Coccodrillo, solo bioma Prateria attivo, un solo Boss,
// solo 3 edifici (Municipio, Ospedale, Fabbro). Nessuna economia/crafting/
// reclutamento/assedi in questa fase: vedi Game Design Document + richiesta.
import type {
  BiomeId,
  BuildingKind,
  EnemyKind,
  EquipmentDef,
  EquipmentSlot,
  EquipmentType,
  ItemCategory,
  ItemKind,
  Rarity,
  Role,
  Species,
  Stats,
  Vec2,
} from "./types";

export const TILE = { w: 64, h: 32 };

// Village is a SQUARE safe/heal zone centered here (world tile coords).
// `radius` is the half-size of the square. Walls surround it with a gate
// (opening) in the middle of each of the 4 sides.
export const VILLAGE = { x: 0, y: 0, radius: 12 };
// Half-width of each gate opening (in tiles) on every wall side.
export const VILLAGE_GATE_HALF = 2;

// Punto in cui la creatura compare/rinasce nel villaggio: leggermente
// spostato dal centro esatto, per non nascere dentro il Municipio (che si
// trova proprio a VILLAGE.x/VILLAGE.y).
export const VILLAGE_SPAWN: Vec2 = { x: VILLAGE.x, y: VILLAGE.y + 3.5 };

// World bounds (tile coords).
export const WORLD = { min: -30, max: 30 };

// Tinta del terreno della Prateria (fuori dal villaggio).
export const PRATERIA_GROUND = "#4f7a3a";

// --- Edifici del villaggio -------------------------------------------------
// Municipio riceve l'Oro, Ospedale cura, Magazzino riceve i Materiali,
// Deposito Equipaggiamenti ricevera' gli equipaggiamenti (non ancora
// implementati: per ora questo edificio esiste ma non riceve mai nulla).
// Fabbro resta presente ma senza crafting/upgrade (fasi future).
export interface BuildingDef {
  id: BuildingKind;
  name: string;
  icon: string;
  pos: Vec2;
  // raggio entro cui la creatura e' "arrivata" all'edificio (interazione)
  radius: number;
  // raggio fisico dell'edificio: le creature lo aggirano invece di
  // attraversarlo (Modifica 8 - pathfinding).
  collisionRadius: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  townhall: {
    id: "townhall",
    name: "Municipio",
    icon: "🏛️",
    pos: { x: VILLAGE.x, y: VILLAGE.y },
    radius: 2,
    collisionRadius: 1.1,
  },
  hospital: {
    id: "hospital",
    name: "Ospedale",
    icon: "🏥",
    pos: { x: VILLAGE.x - 6, y: VILLAGE.y - 3 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  smithy: {
    id: "smithy",
    name: "Fabbro",
    icon: "⚒️",
    pos: { x: VILLAGE.x + 6, y: VILLAGE.y - 3 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  warehouse: {
    id: "warehouse",
    name: "Magazzino",
    icon: "📦",
    pos: { x: VILLAGE.x - 6, y: VILLAGE.y + 3 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  equipmentDepot: {
    id: "equipmentDepot",
    name: "Deposito Equipaggiamenti",
    icon: "🛡️",
    pos: { x: VILLAGE.x + 6, y: VILLAGE.y + 3 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  // --- Artigiani / Crafting (nuova iterazione) -----------------------------
  // Riusano la stessa BuildingDef generica: nessuna modifica a rendering o
  // pathfinding, che gia' iterano genericamente su tutti gli edifici qui
  // presenti.
  armorer: {
    id: "armorer",
    name: "Armaiolo",
    icon: "🗡️",
    pos: { x: VILLAGE.x - 8, y: VILLAGE.y - 7 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  goldsmith: {
    id: "goldsmith",
    name: "Orafo",
    icon: "💍",
    pos: { x: VILLAGE.x + 8, y: VILLAGE.y - 7 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  alchemist: {
    id: "alchemist",
    name: "Alchimista",
    icon: "🧪",
    pos: { x: VILLAGE.x - 8, y: VILLAGE.y + 7 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  merchant: {
    id: "merchant",
    name: "Mercante",
    icon: "🛒",
    pos: { x: VILLAGE.x + 8, y: VILLAGE.y + 7 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  academy: {
    id: "academy",
    name: "Accademia",
    icon: "📚",
    pos: { x: VILLAGE.x, y: VILLAGE.y - 10 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
  barracks: {
    id: "barracks",
    name: "Caserma",
    icon: "🎖️",
    pos: { x: VILLAGE.x, y: VILLAGE.y + 10 },
    radius: 1.5,
    collisionRadius: 0.8,
  },
};

// NPC residente e breve descrizione per ogni edificio artigiano (metadato
// leggero per la UI; la logica di ciascun edificio vive nel proprio
// manager indipendente: RecipeManager/CraftingManager/AcademyManager/
// MerchantManager, vedi rispettivi file).
export const BUILDING_NPC: Partial<Record<BuildingKind, string>> = {
  armorer: "Grum il Fabbro d'Armi",
  goldsmith: "Sarabi l'Orafa",
  alchemist: "Fennic l'Alchimista",
  merchant: "Dorna la Mercante",
  academy: "Maestro Yol",
  barracks: "Capitano Vex",
};

// A quale edificio va portata ciascuna categoria di oggetto (Regola
// Fondamentale del GDD: "Il Municipio riceve esclusivamente l'Oro. Il
// Magazzino riceve esclusivamente i Materiali. Il Deposito Equipaggiamenti
// riceve esclusivamente gli Equipaggiamenti."). Aggiungere un nuovo
// ItemKind in futuro richiede solo una riga qui.
export const ITEM_CATEGORY: Record<ItemKind, ItemCategory> = {
  gold: "gold",
  gelatin: "material",
  chitin: "material",
  pelt: "material",
  rareCrystal: "material",
  wood: "material",
  iron: "material",
  steel: "material",
  gem: "material",
  herb: "material",
  mushroom: "material",
  potionHp: "consumable",
  potionBuff: "consumable",
  potionDefense: "consumable",
  potionSpeed: "consumable",
};

export const DEPOSIT_BUILDING: Record<ItemCategory, BuildingKind> = {
  gold: "townhall",
  material: "warehouse",
  equipment: "equipmentDepot",
  // I consumabili (pozioni) condividono il Magazzino con i materiali: non
  // vengono mai depositati dal loop di esplorazione (nessun mostro le
  // droppa), solo dal Crafting (CraftingManager), ma la Regola Fondamentale
  // "un edificio per categoria" resta coerente.
  consumable: "warehouse",
};

// --- Coccodrillo (unica creatura di questa vertical slice) ----------------
export const CROC_BASE: Stats = {
  hp: 120,
  attack: 16,
  defense: 9,
  speed: 2.2,
};

export const SPECIES_BASE: Record<Species, Stats> = {
  croc: CROC_BASE,
};

export const SPECIES_LABEL: Record<Species, string> = {
  croc: "Coccodrillo",
};
export const SPECIES_EMOJI: Record<Species, string> = {
  croc: "🐊",
};
// Ruolo di combattimento di ogni specie (GDD: scheda del Coccodrillo =
// "Attaccante Fisico"). Determina quali oggetti puo' equipaggiare.
export const SPECIES_ROLE: Record<Species, Role> = {
  croc: "physical",
};

// --- Equipaggiamento (GDD cap. 27) ------------------------------------------
// 8 slot per creatura (6 visibili + 2 non visibili). Ogni oggetto ha un
// `type` che determina automaticamente lo slot occupato e i ruoli
// compatibili: aggiungere un nuovo tipo di arma richiede solo una riga in
// EQUIPMENT_TYPE_SLOT + EQUIPMENT_TYPE_ROLES, nessuna modifica altrove.

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "weaponRight",
  "weaponLeft",
  "helmet",
  "armor",
  "gloves",
  "boots",
  "ring",
  "belt",
];

export const EQUIPMENT_SLOT_LABEL: Record<EquipmentSlot, string> = {
  weaponRight: "Arma Mano Destra",
  weaponLeft: "Arma Mano Sinistra / Scudo",
  helmet: "Elmo",
  armor: "Armatura",
  gloves: "Guanti",
  boots: "Stivali",
  ring: "Anello",
  belt: "Cintura",
};

// true per i 6 slot visibili (modificano lo sprite tramite layer), false per
// i 2 non visibili (Anello, Cintura: solo statistiche).
export const EQUIPMENT_SLOT_VISIBLE: Record<EquipmentSlot, boolean> = {
  weaponRight: true,
  weaponLeft: true,
  helmet: true,
  armor: true,
  gloves: true,
  boots: true,
  ring: false,
  belt: false,
};

export const ROLE_LABEL: Record<Role, string> = {
  tank: "Tank",
  physical: "Attaccante Fisico",
  special: "Attaccante Speciale",
  agile: "Agile",
  balanced: "Bilanciato",
};
export const ROLE_ORDER: Role[] = ["tank", "physical", "special", "agile", "balanced"];

const ALL_ROLES: Role[] = ["tank", "physical", "special", "agile", "balanced"];

// Slot occupato da ciascun tipo di oggetto.
export const EQUIPMENT_TYPE_SLOT: Record<EquipmentType, EquipmentSlot> = {
  sword: "weaponRight",
  axe: "weaponRight",
  spear: "weaponRight",
  mace: "weaponRight",
  hammer: "weaponRight",
  shield: "weaponLeft",
  staff: "weaponRight",
  wand: "weaponRight",
  spellbook: "weaponRight",
  dualBlades: "weaponRight",
  daggers: "weaponRight",
  lightSpear: "weaponRight",
  bow: "weaponRight",
  helmet: "helmet",
  armor: "armor",
  gloves: "gloves",
  boots: "boots",
  ring: "ring",
  // Collana e Amuleto (Orafo) sono accessori "da gioiello" come l'Anello:
  // condividono lo stesso slot (nessuna modifica allo slot esistente, solo
  // nuovi tipi che vi si affacciano).
  necklace: "ring",
  amulet: "ring",
  belt: "belt",
};

// Ruoli compatibili con ciascun tipo di oggetto (GDD "Compatibilita'"): le
// armi sono specifiche per ruolo, gli slot non-arma sono universali.
export const EQUIPMENT_TYPE_ROLES: Record<EquipmentType, Role[]> = {
  sword: ["tank", "physical", "balanced"],
  axe: ["physical", "balanced"],
  spear: ["physical", "balanced"],
  mace: ["tank"],
  hammer: ["tank"],
  shield: ["tank"],
  staff: ["special"],
  wand: ["special"],
  spellbook: ["special"],
  dualBlades: ["agile"],
  daggers: ["agile"],
  lightSpear: ["agile"],
  bow: ["agile", "physical"],
  helmet: ALL_ROLES,
  armor: ALL_ROLES,
  gloves: ALL_ROLES,
  boots: ALL_ROLES,
  ring: ALL_ROLES,
  necklace: ALL_ROLES,
  amulet: ALL_ROLES,
  belt: ALL_ROLES,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  comune: "Comune",
  nonComune: "Non Comune",
  raro: "Raro",
  epico: "Epico",
  leggendario: "Leggendario",
  mitico: "Mitico",
};
export const RARITY_ORDER: Rarity[] = ["comune", "nonComune", "raro", "epico", "leggendario", "mitico"];
export const RARITY_COLOR: Record<Rarity, string> = {
  comune: "#b9c2bb",
  nonComune: "#5fd17a",
  raro: "#5c8ba8",
  epico: "#a56bff",
  leggendario: "#f5a742",
  mitico: "#ff5a7a",
};

/** Costruisce una definizione equip compilando automaticamente slot e ruoli dal `type`. */
function defineEquipment(
  id: string,
  name: string,
  type: EquipmentType,
  rarity: Rarity,
  level: number,
  statBonus: Partial<Stats>,
): EquipmentDef {
  const slot = EQUIPMENT_TYPE_SLOT[type];
  return {
    id,
    name,
    type,
    slot,
    rarity,
    level,
    statBonus,
    compatibleRoles: EQUIPMENT_TYPE_ROLES[type],
    visible: EQUIPMENT_SLOT_VISIBLE[slot],
    layer: EQUIPMENT_SLOT_VISIBLE[slot] ? slot : null,
  };
}

// Catalogo di partenza: rappresenta un piccolo lotto di equipaggiamenti gia'
// posseduti dal Villaggio (in attesa del futuro sistema di Crafting, che
// sostituira'/estendera' questa fonte senza cambiare la struttura dati).
// Copre piu' ruoli, rarita' e slot visibili/non visibili per poter testare
// da subito compatibilita' e calcolo statistiche.
export const EQUIPMENT_CATALOG: Record<string, EquipmentDef> = {
  sword_iron: defineEquipment("sword_iron", "Spada di Ferro", "sword", "comune", 1, { attack: 6 }),
  sword_flame: defineEquipment("sword_flame", "Spada Fiammeggiante", "sword", "epico", 5, {
    attack: 14,
    defense: 2,
  }),
  axe_bronze: defineEquipment("axe_bronze", "Ascia di Bronzo", "axe", "comune", 1, {
    attack: 8,
    speed: -0.1,
  }),
  spear_hunter: defineEquipment("spear_hunter", "Lancia del Cacciatore", "spear", "nonComune", 2, {
    attack: 9,
  }),
  shield_wood: defineEquipment("shield_wood", "Scudo di Legno", "shield", "comune", 1, {
    defense: 5,
    hp: 10,
  }),
  mace_stone: defineEquipment("mace_stone", "Mazza di Pietra", "mace", "comune", 1, { attack: 5, defense: 2 }),
  staff_apprentice: defineEquipment("staff_apprentice", "Bastone dell'Apprendista", "staff", "comune", 1, {
    attack: 4,
  }),
  daggers_swift: defineEquipment("daggers_swift", "Pugnali Rapidi", "daggers", "nonComune", 2, {
    attack: 5,
    speed: 0.3,
  }),
  helmet_leather: defineEquipment("helmet_leather", "Elmo di Cuoio", "helmet", "comune", 1, { defense: 2 }),
  armor_leather: defineEquipment("armor_leather", "Corazza di Cuoio", "armor", "comune", 1, {
    defense: 3,
    hp: 15,
  }),
  gloves_leather: defineEquipment("gloves_leather", "Guanti di Cuoio", "gloves", "comune", 1, { attack: 2 }),
  boots_leather: defineEquipment("boots_leather", "Stivali di Cuoio", "boots", "comune", 1, { speed: 0.2 }),
  ring_vigor: defineEquipment("ring_vigor", "Anello del Vigore", "ring", "nonComune", 2, { hp: 20 }),
  belt_strength: defineEquipment("belt_strength", "Cintura della Forza", "belt", "nonComune", 2, {
    attack: 3,
  }),
  // --- Craftabili dall'Armaiolo (vedi recipeManager.ts) ---
  sword_steel: defineEquipment("sword_steel", "Spada d'Acciaio", "sword", "nonComune", 3, {
    attack: 11,
    defense: 1,
  }),
  axe_reinforced: defineEquipment("axe_reinforced", "Ascia Rinforzata", "axe", "nonComune", 3, {
    attack: 13,
    speed: -0.1,
  }),
  spear_sturdy: defineEquipment("spear_sturdy", "Lancia Robusta", "spear", "comune", 2, { attack: 10 }),
  bow_short: defineEquipment("bow_short", "Arco Corto", "bow", "comune", 2, { attack: 9, speed: 0.15 }),
  shield_iron: defineEquipment("shield_iron", "Scudo di Ferro", "shield", "nonComune", 3, {
    defense: 8,
    hp: 15,
  }),
  // --- Craftabili dall'Orafo (vedi recipeManager.ts) ---
  ring_gold: defineEquipment("ring_gold", "Anello d'Oro", "ring", "comune", 2, { hp: 12 }),
  necklace_gems: defineEquipment("necklace_gems", "Collana di Gemme", "necklace", "nonComune", 3, {
    attack: 4,
    defense: 2,
  }),
  amulet_runic: defineEquipment("amulet_runic", "Amuleto Runico", "amulet", "raro", 4, {
    hp: 25,
    attack: 3,
  }),
};

// Oggetti gia' disponibili nel Magazzino Equipaggiamenti all'avvio (scorta
// di partenza, vedi engine.ts). Gli oggetti craftabili (sword_steel,
// axe_reinforced, ecc.) NON sono qui: si ottengono solo tramite Crafting,
// altrimenti "produrli" non avrebbe senso se gia' posseduti gratis.
export const STARTER_EQUIPMENT_IDS: string[] = [
  "sword_iron",
  "sword_flame",
  "axe_bronze",
  "spear_hunter",
  "shield_wood",
  "mace_stone",
  "staff_apprentice",
  "daggers_swift",
  "helmet_leather",
  "armor_leather",
  "gloves_leather",
  "boots_leather",
  "ring_vigor",
  "belt_strength",
];

// % di HP massimi sotto la quale la creatura rientra al villaggio.
export const RETREAT_HP_RATIO = 0.3;
// % di HP massimi necessaria per essere considerata "completamente curata"
// e ripartire automaticamente dall'Ospedale.
export const FULL_HEAL_RATIO = 1.0;

// --- Inventario -------------------------------------------------------------
// Numero massimo di oggetti che la creatura puo' portare in esplorazione.
// Al raggiungimento rientra al villaggio.
export const INVENTORY_CAP = 10;

// --- Mostri della Prateria + Boss ------------------------------------------
export interface EnemyDef {
  name: string;
  color: string;
  stats: Stats;
  xp: number;
  attackRange: number;
  attackCooldown: number;
  // Modifica 4: raggio entro cui il mostro individua un bersaglio e lo insegue.
  aggroRange: number;
  // Modifica 5: distanza massima dal proprio Spawn Point durante l'inseguimento.
  // Oltre questa soglia il mostro abbandona il combattimento e rientra.
  leashDistance: number;
  drops: { kind: ItemKind; chance: number; amount?: number }[];
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slime: {
    name: "Slime",
    color: "#5fd17a",
    stats: { hp: 24, attack: 5, defense: 1, speed: 1.1 },
    xp: 12,
    attackRange: 0.9,
    attackCooldown: 1.1,
    aggroRange: 5,
    leashDistance: 9,
    drops: [
      { kind: "gold", chance: 0.7 },
      { kind: "gelatin", chance: 0.6 },
    ],
  },
  scarab: {
    name: "Scarabeo",
    color: "#3a6b8a",
    stats: { hp: 34, attack: 8, defense: 3, speed: 1.7 },
    xp: 18,
    attackRange: 1.0,
    attackCooldown: 1.0,
    aggroRange: 6,
    leashDistance: 10,
    drops: [
      { kind: "gold", chance: 0.8 },
      { kind: "chitin", chance: 0.5 },
    ],
  },
  rabbit: {
    name: "Coniglio Selvatico",
    color: "#c9c1a8",
    stats: { hp: 20, attack: 6, defense: 1, speed: 3.0 },
    xp: 10,
    attackRange: 0.9,
    attackCooldown: 0.9,
    aggroRange: 7,
    leashDistance: 11,
    drops: [
      { kind: "gold", chance: 0.6 },
      { kind: "pelt", chance: 0.5 },
    ],
  },
  boss_prateria: {
    name: "Boss della Prateria",
    color: "#a0392b",
    stats: { hp: 400, attack: 22, defense: 10, speed: 1.4 },
    xp: 150,
    attackRange: 1.3,
    attackCooldown: 1.3,
    aggroRange: 10,
    leashDistance: 14,
    drops: [
      { kind: "gold", chance: 1, amount: 10 },
      { kind: "rareCrystal", chance: 1 },
    ],
  },
};

export const ITEMS: Record<ItemKind, { name: string; color: string }> = {
  gold: { name: "Oro", color: "#f5c542" },
  gelatin: { name: "Gelatina", color: "#7fe6a1" },
  chitin: { name: "Guscio di Chitina", color: "#5c8ba8" },
  pelt: { name: "Pelliccia", color: "#e0d6bd" },
  rareCrystal: { name: "Cristallo Raro", color: "#c86bff" },
  // Materiali da Crafting (acquistabili dal Mercante).
  wood: { name: "Legno", color: "#8a6a3a" },
  iron: { name: "Ferro", color: "#9aa0a6" },
  steel: { name: "Acciaio", color: "#c7ccd1" },
  gem: { name: "Gemme", color: "#ff6ba8" },
  herb: { name: "Erbe", color: "#6fae5a" },
  mushroom: { name: "Funghi", color: "#c98a4b" },
  // Pozioni (prodotte dall'Alchimista).
  potionHp: { name: "Pozione HP", color: "#e05a4d" },
  potionBuff: { name: "Pozione Buff", color: "#f5a742" },
  potionDefense: { name: "Pozione Difesa", color: "#5c8ba8" },
  potionSpeed: { name: "Pozione Velocità", color: "#7fe6ff" },
};

export const PLAYER = {
  attackRange: 1.2,
  attackCooldown: 0.8,
  itemPickupRadius: 0.8,
  healPerSecond: 18, // solo in Ospedale
};

// XP needed to reach next level scales with current level.
export const xpForLevel = (level: number) => 30 + (level - 1) * 25;

// Stat gains per level up.
export const LEVEL_UP_GAINS: Stats = {
  hp: 14,
  attack: 3,
  defense: 1,
  speed: 0.05,
};

// --- Spawn Point / Spawn Area (Modifica 3 + 6) ------------------------------
// Ogni mostro (Boss incluso) appartiene a un'unica Area di Spawn dedicata:
// una Spawn Position + uno Spawn Radius. I mostri compaiono solo dentro la
// propria area e, quando devono rientrare, tornano sempre li'. Il Boss ha la
// propria Area riservata (Boss Area) e non compare mai casualmente altrove:
// e' semplicemente l'area di spawn dedicata alla entry "boss_prateria".
export interface SpawnArea {
  kind: EnemyKind;
  pos: Vec2;
  radius: number;
}

export const SPAWN_AREAS: SpawnArea[] = [
  { kind: "slime", pos: { x: 20, y: 16 }, radius: 6 },
  { kind: "scarab", pos: { x: 24, y: -4 }, radius: 6 },
  { kind: "rabbit", pos: { x: 16, y: -22 }, radius: 6 },
  { kind: "boss_prateria", pos: { x: 24, y: 6 }, radius: 5 },
];

export const BOSS_AREA = SPAWN_AREAS.find((a) => a.kind === "boss_prateria")!;

// Quanta vita al secondo recupera un mostro mentre rientra al proprio
// Spawn Point dopo aver perso l'aggro o superato il Leash Distance.
export const LEASH_HEAL_PER_SECOND = 8;

// --- Spawn periodico nella Prateria ------------------------------------------
export const MAX_ENEMIES = 6;
export const ENEMY_SPAWN_INTERVAL = 4.5;
export const ENEMY_KINDS: EnemyKind[] = ["slime", "scarab", "rabbit"];

// Il Boss respawna automaticamente dopo un certo tempo (Regola Fondamentale
// del GDD, cap. 12/22), sempre nella propria Boss Area.
export const BOSS_RESPAWN_TIME = 90; // secondi

// Quanto lontano il Coccodrillo, mentre esplora, nota spontaneamente un
// nemico o un oggetto (percezione della creatura, non l'aggro del mostro).
export const EXPLORE_DETECT_RANGE = 8;

// Random-wander tuning.
export const WANDER = { minWait: 0.6, maxWait: 2.2, radius: 4 };

// --- Biomi (Modifica 7 + Zona Specifica) -------------------------------------
// Il mondo e' diviso in settori angolari attorno al Villaggio. Solo la
// Prateria e' attiva in questa vertical slice: gli altri 6 biomi esistono
// gia' come aree della mappa (terreno proprio) ma restano completamente
// vuoti, senza mostri ne' oggetti, pronti per essere sviluppati in futuro.
// Il tipo BiomeId e' condiviso da types.ts (usato anche da AiMode "zone").
export interface BiomeDef {
  id: BiomeId;
  name: string;
  active: boolean;
  groundColor: string;
}

// Prateria occupa meta' mondo (180°, angolo -90..90 rispetto al villaggio);
// i restanti 180° sono divisi in 6 settori uguali (30° l'uno) per i biomi
// futuri, nell'ordine indicato dal Game Design Document.
export const BIOME_ORDER: BiomeId[] = [
  "prateria",
  "foresta",
  "deserto",
  "palude",
  "montagne",
  "ghiacciaio",
  "vulcano",
];

export const BIOMES: Record<BiomeId, BiomeDef> = {
  prateria: { id: "prateria", name: "Prateria", active: true, groundColor: PRATERIA_GROUND },
  foresta: { id: "foresta", name: "Foresta", active: false, groundColor: "#2f4a33" },
  deserto: { id: "deserto", name: "Deserto", active: false, groundColor: "#8a7a4f" },
  palude: { id: "palude", name: "Palude", active: false, groundColor: "#3c4a3a" },
  montagne: { id: "montagne", name: "Montagne", active: false, groundColor: "#5a5a5f" },
  ghiacciaio: { id: "ghiacciaio", name: "Ghiacciaio", active: false, groundColor: "#8fa8b0" },
  vulcano: { id: "vulcano", name: "Vulcano", active: false, groundColor: "#5a3230" },
};

/** Determina a quale bioma appartiene un punto del mondo (fuori dal villaggio). */
export function biomeAt(pos: Vec2): BiomeId {
  const dx = pos.x - VILLAGE.x;
  const dy = pos.y - VILLAGE.y;
  let ang = Math.atan2(dy, dx) * (180 / Math.PI); // (-180, 180]
  if (ang < 0) ang += 360; // [0, 360)
  const shifted = (ang + 90) % 360; // Prateria centrata sull'angolo 0 -> [0,180)
  if (shifted < 180) return "prateria";
  const idx = Math.min(5, Math.floor((shifted - 180) / 30)); // 0..5
  return BIOME_ORDER[1 + idx];
}
