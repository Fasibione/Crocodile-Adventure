// =============================================================================
// CraftingManager — gestisce le code di produzione degli Artigiani
// (Armaiolo/Orafo/Alchimista). Modulo indipendente: riceve il Magazzino
// (bank) e il Magazzino Equipaggiamenti (equipmentStorage) come parametri
// espliciti invece di leggerli da uno stato globale condiviso, cosi'
// resta testabile e sostituibile da solo.
//
// Regola: i materiali e l'oro vengono scalati SUBITO alla messa in coda
// (queueProduction), non al ritiro. Questo e' cio' che verifica il test
// richiesto ("il crafting consumi realmente i materiali del Magazzino") ed
// evita che le stesse risorse vengano "prenotate" da piu' ordini in coda
// contemporaneamente.
import { getRecipe, canAfford } from "./recipeManager";
import { EQUIPMENT_CATALOG } from "./config";
import type { CraftingBuilding, ItemKind, ProductionOrder } from "./types";

let nextOrderId = 1;

export interface QueueResult {
  success: boolean;
  order?: ProductionOrder;
  reason?: string;
}

export interface CollectResult {
  success: boolean;
  label?: string;
  reason?: string;
}

export class CraftingManager {
  private orders: ProductionOrder[] = [];

  /** Tutti gli ordini (in produzione o pronti) di un edificio, o di tutti se omesso. */
  getQueue(building?: CraftingBuilding): ProductionOrder[] {
    return building ? this.orders.filter((o) => o.building === building) : [...this.orders];
  }

  /** Mette in coda una ricetta: scala subito materiali e oro dal Magazzino. */
  queueProduction(recipeId: string, bank: Record<ItemKind, number>): QueueResult {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { success: false, reason: "Ricetta sconosciuta" };
    if (!canAfford(recipe, bank, bank.gold ?? 0)) {
      return { success: false, reason: "Materiali o Oro insufficienti" };
    }
    // Scala subito le risorse: nessun deposito automatico ne' riserva
    // implicita, la spesa e' reale e immediata.
    bank.gold -= recipe.goldCost;
    for (const cost of recipe.materials) {
      bank[cost.item] -= cost.amount;
    }
    const order: ProductionOrder = {
      id: `order_${nextOrderId++}`,
      recipeId: recipe.id,
      building: recipe.building,
      totalTime: recipe.productionTimeSec,
      remaining: recipe.productionTimeSec,
      ready: false,
    };
    this.orders.push(order);
    return { success: true, order };
  }

  /** Annulla un ordine non ancora ritirato, restituendo materiali e oro. */
  cancelProduction(orderId: string, bank: Record<ItemKind, number>): boolean {
    const idx = this.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return false;
    const order = this.orders[idx];
    const recipe = getRecipe(order.recipeId);
    if (recipe) {
      bank.gold = (bank.gold ?? 0) + recipe.goldCost;
      for (const cost of recipe.materials) {
        bank[cost.item] = (bank[cost.item] ?? 0) + cost.amount;
      }
    }
    this.orders.splice(idx, 1);
    return true;
  }

  /** Avanza tutte le produzioni in corso (chiamato una volta per frame). */
  tick(dt: number) {
    for (const order of this.orders) {
      if (order.ready) continue;
      order.remaining = Math.max(0, order.remaining - dt);
      if (order.remaining <= 0) order.ready = true;
    }
  }

  /**
   * Ritira un ordine pronto: l'equipaggiamento finisce nel Magazzino
   * Equipaggiamenti, i consumabili nel Magazzino (bank). Solo da qui gli
   * oggetti prodotti entrano davvero in gioco.
   */
  collectProduction(
    orderId: string,
    equipmentStorage: Record<string, number>,
    bank: Record<ItemKind, number>,
  ): CollectResult {
    const idx = this.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return { success: false, reason: "Ordine non trovato" };
    const order = this.orders[idx];
    if (!order.ready) return { success: false, reason: "Produzione non ancora completata" };
    const recipe = getRecipe(order.recipeId);
    if (!recipe) return { success: false, reason: "Ricetta non piu' valida" };
    let label = recipe.name;
    if (recipe.result.kind === "equipment" && recipe.result.equipmentId) {
      const id = recipe.result.equipmentId;
      equipmentStorage[id] = (equipmentStorage[id] ?? 0) + 1;
      label = EQUIPMENT_CATALOG[id]?.name ?? id;
    } else if (recipe.result.kind === "consumable" && recipe.result.item) {
      const amt = recipe.result.amount ?? 1;
      bank[recipe.result.item] = (bank[recipe.result.item] ?? 0) + amt;
    }
    this.orders.splice(idx, 1);
    return { success: true, label };
  }
}
