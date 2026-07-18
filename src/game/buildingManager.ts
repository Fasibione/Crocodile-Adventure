// =============================================================================
// BuildingManager — registro dei 6 edifici degli Artigiani: espone metadati
// (nome, icona, NPC, posizione) letti da config.ts senza duplicarli, piu'
// funzioni di comodo per la UI. Indipendente dagli altri manager: non
// possiede stato di gioco (materiali, code, ricerche), solo anagrafica.
import { BUILDINGS, BUILDING_NPC } from "./config";
import type { BuildingKind, CraftingBuilding, Vec2 } from "./types";

export const CRAFTING_BUILDINGS: CraftingBuilding[] = ["armorer", "goldsmith", "alchemist"];

// I 6 nuovi edifici funzionanti di questa iterazione (esclude i 5 gia'
// esistenti: Municipio/Ospedale/Fabbro/Magazzino/Deposito Equipaggiamenti,
// che restano gestiti dai loro sistemi originali, non modificati).
export const ARTISAN_BUILDINGS: BuildingKind[] = [
  "armorer",
  "goldsmith",
  "alchemist",
  "academy",
  "barracks",
  "merchant",
];

export interface BuildingInfo {
  kind: BuildingKind;
  name: string;
  icon: string;
  npc: string | null;
  pos: Vec2;
}

export class BuildingManager {
  getInfo(kind: BuildingKind): BuildingInfo {
    const def = BUILDINGS[kind];
    return {
      kind,
      name: def.name,
      icon: def.icon,
      npc: BUILDING_NPC[kind] ?? null,
      pos: def.pos,
    };
  }

  getArtisanBuildings(): BuildingInfo[] {
    return ARTISAN_BUILDINGS.map((k) => this.getInfo(k));
  }

  isCraftingBuilding(kind: BuildingKind): kind is CraftingBuilding {
    return (CRAFTING_BUILDINGS as BuildingKind[]).includes(kind);
  }
}
