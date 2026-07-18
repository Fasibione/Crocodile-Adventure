// =============================================================================
// RecipeManager — catalogo delle ricette di Crafting e funzioni di sola
// lettura per consultarlo. Modulo indipendente e stateless: non possiede
// alcuno stato mutabile, non tocca il Magazzino ne' l'Equipaggiamento
// direttamente (se ne occupa CraftingManager). Facilmente espandibile:
// aggiungere una ricetta significa aggiungere una voce a RECIPES, nessuna
// modifica al motore o agli altri manager.
import type { CraftingBuilding, ItemKind, Recipe } from "./types";

// Catalogo ricette. In futuro puo' essere sostituito/esteso caricando dati
// da JSON/config esterna senza cambiare la forma di questo modulo: basta
// che produca oggetti con la stessa interfaccia Recipe.
export const RECIPES: Record<string, Recipe> = {
  // --- Armaiolo: Spade, Lance, Asce, Archi, Scudi -----------------------
  recipe_sword_steel: {
    id: "recipe_sword_steel",
    building: "armorer",
    name: "Spada d'Acciaio",
    materials: [
      { item: "iron", amount: 3 },
      { item: "wood", amount: 1 },
    ],
    goldCost: 20,
    productionTimeSec: 30,
    result: { kind: "equipment", equipmentId: "sword_steel" },
  },
  recipe_axe_reinforced: {
    id: "recipe_axe_reinforced",
    building: "armorer",
    name: "Ascia Rinforzata",
    materials: [
      { item: "iron", amount: 2 },
      { item: "wood", amount: 2 },
    ],
    goldCost: 25,
    productionTimeSec: 28,
    result: { kind: "equipment", equipmentId: "axe_reinforced" },
  },
  recipe_spear_sturdy: {
    id: "recipe_spear_sturdy",
    building: "armorer",
    name: "Lancia Robusta",
    materials: [
      { item: "wood", amount: 3 },
      { item: "iron", amount: 1 },
    ],
    goldCost: 15,
    productionTimeSec: 20,
    result: { kind: "equipment", equipmentId: "spear_sturdy" },
  },
  recipe_bow_short: {
    id: "recipe_bow_short",
    building: "armorer",
    name: "Arco Corto",
    materials: [
      { item: "wood", amount: 4 },
      { item: "pelt", amount: 1 },
    ],
    goldCost: 18,
    productionTimeSec: 22,
    result: { kind: "equipment", equipmentId: "bow_short" },
  },
  recipe_shield_iron: {
    id: "recipe_shield_iron",
    building: "armorer",
    name: "Scudo di Ferro",
    materials: [
      { item: "iron", amount: 3 },
      { item: "pelt", amount: 1 },
    ],
    goldCost: 22,
    productionTimeSec: 26,
    result: { kind: "equipment", equipmentId: "shield_iron" },
  },

  // --- Orafo: Anelli, Collane, Amuleti ----------------------------------
  recipe_ring_gold: {
    id: "recipe_ring_gold",
    building: "goldsmith",
    name: "Anello d'Oro",
    materials: [
      { item: "gold", amount: 15 },
      { item: "gem", amount: 1 },
    ],
    goldCost: 0,
    productionTimeSec: 15,
    result: { kind: "equipment", equipmentId: "ring_gold" },
  },
  recipe_necklace_gems: {
    id: "recipe_necklace_gems",
    building: "goldsmith",
    name: "Collana di Gemme",
    materials: [
      { item: "gold", amount: 10 },
      { item: "gem", amount: 2 },
    ],
    goldCost: 0,
    productionTimeSec: 20,
    result: { kind: "equipment", equipmentId: "necklace_gems" },
  },
  recipe_amulet_runic: {
    id: "recipe_amulet_runic",
    building: "goldsmith",
    name: "Amuleto Runico",
    materials: [
      { item: "gold", amount: 10 },
      { item: "rareCrystal", amount: 1 },
    ],
    goldCost: 0,
    productionTimeSec: 25,
    result: { kind: "equipment", equipmentId: "amulet_runic" },
  },

  // --- Alchimista: Pozioni HP/Buff/Difesa/Velocita' ----------------------
  recipe_potion_hp: {
    id: "recipe_potion_hp",
    building: "alchemist",
    name: "Pozione HP",
    materials: [
      { item: "herb", amount: 2 },
      { item: "mushroom", amount: 1 },
    ],
    goldCost: 5,
    productionTimeSec: 10,
    result: { kind: "consumable", item: "potionHp", amount: 1 },
  },
  recipe_potion_buff: {
    id: "recipe_potion_buff",
    building: "alchemist",
    name: "Pozione Buff",
    materials: [
      { item: "herb", amount: 1 },
      { item: "rareCrystal", amount: 1 },
    ],
    goldCost: 12,
    productionTimeSec: 18,
    result: { kind: "consumable", item: "potionBuff", amount: 1 },
  },
  recipe_potion_defense: {
    id: "recipe_potion_defense",
    building: "alchemist",
    name: "Pozione Difesa",
    materials: [
      { item: "mushroom", amount: 2 },
      { item: "gelatin", amount: 1 },
    ],
    goldCost: 8,
    productionTimeSec: 15,
    result: { kind: "consumable", item: "potionDefense", amount: 1 },
  },
  recipe_potion_speed: {
    id: "recipe_potion_speed",
    building: "alchemist",
    name: "Pozione Velocità",
    materials: [
      { item: "herb", amount: 1 },
      { item: "mushroom", amount: 1 },
      { item: "gelatin", amount: 1 },
    ],
    goldCost: 10,
    productionTimeSec: 15,
    result: { kind: "consumable", item: "potionSpeed", amount: 1 },
  },
};

export function getRecipe(id: string): Recipe | null {
  return RECIPES[id] ?? null;
}

/** Tutte le ricette disponibili per un dato edificio artigiano. */
export function getRecipesForBuilding(building: CraftingBuilding): Recipe[] {
  return Object.values(RECIPES).filter((r) => r.building === building);
}

/** Vero se il magazzino (bank) contiene abbastanza materiali per la ricetta. */
export function hasEnoughMaterials(recipe: Recipe, bank: Record<ItemKind, number>): boolean {
  return recipe.materials.every((cost) => (bank[cost.item] ?? 0) >= cost.amount);
}

/** Vero se oro + materiali sono entrambi sufficienti per avviare la ricetta. */
export function canAfford(recipe: Recipe, bank: Record<ItemKind, number>, gold: number): boolean {
  return gold >= recipe.goldCost && hasEnoughMaterials(recipe, bank);
}

/** Elenco dei materiali mancanti (utile per la UI: cosa serve ancora). */
export function getMissingMaterials(
  recipe: Recipe,
  bank: Record<ItemKind, number>,
): { item: ItemKind; have: number; need: number }[] {
  return recipe.materials
    .map((cost) => ({ item: cost.item, have: bank[cost.item] ?? 0, need: cost.amount }))
    .filter((m) => m.have < m.need);
}
