// =============================================================================
// MerchantManager — acquisto/vendita di materiali e vendita di
// equipaggiamenti inutilizzati (dal Magazzino Equipaggiamenti), con prezzi
// dinamici semplici. Modulo indipendente: riceve bank/equipmentStorage come
// parametri, mantiene solo i propri contatori di compravendita.
import { EQUIPMENT_CATALOG, ITEMS, RARITY_ORDER } from "./config";
import type { ItemKind, MerchantListing } from "./types";

// Materiali acquistabili/vendibili dal Mercante, con il loro prezzo base di
// riferimento. Espandibile aggiungendo voci qui.
export const MERCHANT_LISTINGS: MerchantListing[] = [
  { item: "wood", basePrice: 3 },
  { item: "iron", basePrice: 5 },
  { item: "steel", basePrice: 9 },
  { item: "gem", basePrice: 12 },
  { item: "herb", basePrice: 2 },
  { item: "mushroom", basePrice: 2 },
  { item: "pelt", basePrice: 4 },
  { item: "gelatin", basePrice: 3 },
  { item: "rareCrystal", basePrice: 15 },
];

const BUY_PRICE_STEP = 0.02; // +2% ad ogni acquisto (scarsita' crescente)
const SELL_PRICE_STEP = 0.01; // -1% ad ogni vendita (mercato che si satura)
const SELL_RATIO = 0.5; // vendere rende meta' del prezzo base di acquisto

export class MerchantManager {
  // Quante unita' sono state comprate/vendute finora per ciascun materiale:
  // determina la leggera oscillazione del prezzo (semplice, deterministica).
  private bought: Partial<Record<ItemKind, number>> = {};
  private sold: Partial<Record<ItemKind, number>> = {};

  getBuyPrice(item: ItemKind): number {
    const listing = MERCHANT_LISTINGS.find((l) => l.item === item);
    if (!listing) return 0;
    const n = this.bought[item] ?? 0;
    return Math.round(listing.basePrice * (1 + n * BUY_PRICE_STEP) * 100) / 100;
  }

  getSellPrice(item: ItemKind): number {
    const listing = MERCHANT_LISTINGS.find((l) => l.item === item);
    if (!listing) return 0;
    const n = this.sold[item] ?? 0;
    const price = listing.basePrice * SELL_RATIO * Math.max(0.4, 1 - n * SELL_PRICE_STEP);
    return Math.round(price * 100) / 100;
  }

  /** Vero se questo materiale e' negoziabile dal Mercante. */
  isListed(item: ItemKind): boolean {
    return MERCHANT_LISTINGS.some((l) => l.item === item);
  }

  buyMaterial(
    item: ItemKind,
    qty: number,
    bank: Record<ItemKind, number>,
  ): { success: boolean; cost?: number; reason?: string } {
    if (!this.isListed(item) || qty <= 0) return { success: false, reason: "Materiale non in vendita" };
    const price = this.getBuyPrice(item);
    const cost = Math.round(price * qty * 100) / 100;
    if ((bank.gold ?? 0) < cost) return { success: false, reason: "Oro insufficiente" };
    bank.gold -= cost;
    bank[item] = (bank[item] ?? 0) + qty;
    this.bought[item] = (this.bought[item] ?? 0) + qty;
    return { success: true, cost };
  }

  sellMaterial(
    item: ItemKind,
    qty: number,
    bank: Record<ItemKind, number>,
  ): { success: boolean; gained?: number; reason?: string } {
    if (!this.isListed(item) || qty <= 0) return { success: false, reason: "Materiale non vendibile qui" };
    if ((bank[item] ?? 0) < qty) return { success: false, reason: "Materiale insufficiente" };
    const price = this.getSellPrice(item);
    const gained = Math.round(price * qty * 100) / 100;
    bank[item] -= qty;
    bank.gold = (bank.gold ?? 0) + gained;
    this.sold[item] = (this.sold[item] ?? 0) + qty;
    return { success: true, gained };
  }

  /** Prezzo di vendita di un equipaggiamento inutilizzato, in base a rarita'/livello. */
  getEquipmentSellPrice(equipmentId: string): number {
    const def = EQUIPMENT_CATALOG[equipmentId];
    if (!def) return 0;
    const rarityIndex = RARITY_ORDER.indexOf(def.rarity);
    return Math.round((10 + rarityIndex * 15 + def.level * 4) * 100) / 100;
  }

  /** Vende un equipaggiamento inutilizzato dal Magazzino Equipaggiamenti (mai un oggetto indossato). */
  sellEquipment(
    equipmentId: string,
    equipmentStorage: Record<string, number>,
    bank: Record<ItemKind, number>,
  ): { success: boolean; gained?: number; reason?: string } {
    if ((equipmentStorage[equipmentId] ?? 0) <= 0) {
      return { success: false, reason: "Oggetto non disponibile nel Magazzino Equipaggiamenti" };
    }
    const gained = this.getEquipmentSellPrice(equipmentId);
    equipmentStorage[equipmentId] -= 1;
    bank.gold = (bank.gold ?? 0) + gained;
    return { success: true, gained };
  }
}

export function itemDisplayName(item: ItemKind): string {
  return ITEMS[item]?.name ?? item;
}
