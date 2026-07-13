// =============================================================================
// AcademyManager — per questa iterazione implementa SOLO: elenco ricerche,
// stato bloccato/sbloccato/in corso/completata, timer di ricerca. Non
// applica ancora alcun bonus reale al gameplay (rimandato a una fase
// successiva, come richiesto). Modulo indipendente: riceve bank come
// parametro esplicito, non legge stato globale.
import type { ItemKind, RecipeCost, ResearchDef, ResearchState } from "./types";

// Catalogo ricerche (placeholder di alcuni esempi del GDD: Esperienza,
// Velocita', Oro, Raccolta). Espandibile aggiungendo voci qui, con
// `requires` per creare un albero di sblocco.
export const RESEARCHES: ResearchDef[] = [
  {
    id: "exp_boost_1",
    name: "Metodi di Addestramento",
    description: "Le fondamenta per una futura maggiore esperienza guadagnata in combattimento.",
    timeSec: 60,
    goldCost: 50,
    materials: [{ item: "herb", amount: 5 }],
  },
  {
    id: "loot_boost_1",
    name: "Tecniche di Raccolta",
    description: "Studia metodi per raccogliere il bottino piu' efficacemente.",
    timeSec: 90,
    goldCost: 80,
    materials: [
      { item: "wood", amount: 5 },
      { item: "iron", amount: 3 },
    ],
  },
  {
    id: "speed_boost_1",
    name: "Passo Leggero",
    description: "Ricerca preliminare su tecniche di movimento piu' rapide.",
    timeSec: 75,
    goldCost: 60,
    materials: [
      { item: "herb", amount: 3 },
      { item: "mushroom", amount: 3 },
    ],
  },
  {
    id: "gold_boost_1",
    name: "Economia di Villaggio",
    description: "Studi avanzati per ottenere piu' Oro dalle spedizioni. Richiede prima i Metodi di Addestramento.",
    timeSec: 120,
    goldCost: 100,
    materials: [{ item: "gem", amount: 2 }],
    requires: ["exp_boost_1"],
  },
];

function affordResearch(def: ResearchDef, bank: Record<ItemKind, number>, gold: number): boolean {
  if (gold < def.goldCost) return false;
  return def.materials.every((c: RecipeCost) => (bank[c.item] ?? 0) >= c.amount);
}

export class AcademyManager {
  private state: Record<string, ResearchState> = {};

  constructor() {
    for (const def of RESEARCHES) {
      this.state[def.id] = {
        status: def.requires && def.requires.length > 0 ? "locked" : "available",
        remaining: 0,
      };
    }
  }

  getState(id: string): ResearchState | null {
    return this.state[id] ?? null;
  }

  getAll(): { def: ResearchDef; state: ResearchState }[] {
    return RESEARCHES.map((def) => ({ def, state: this.state[def.id] }));
  }

  /** Avvia una ricerca disponibile, scalando subito oro e materiali. */
  startResearch(id: string, bank: Record<ItemKind, number>): { success: boolean; reason?: string } {
    const def = RESEARCHES.find((r) => r.id === id);
    const st = this.state[id];
    if (!def || !st) return { success: false, reason: "Ricerca sconosciuta" };
    if (st.status !== "available") return { success: false, reason: "Ricerca non disponibile" };
    if (!affordResearch(def, bank, bank.gold ?? 0)) {
      return { success: false, reason: "Oro o materiali insufficienti" };
    }
    bank.gold -= def.goldCost;
    for (const c of def.materials) bank[c.item] -= c.amount;
    this.state[id] = { status: "researching", remaining: def.timeSec };
    return { success: true };
  }

  /** Annulla una ricerca in corso, restituendo oro e materiali. */
  cancelResearch(id: string, bank: Record<ItemKind, number>): boolean {
    const def = RESEARCHES.find((r) => r.id === id);
    const st = this.state[id];
    if (!def || !st || st.status !== "researching") return false;
    bank.gold = (bank.gold ?? 0) + def.goldCost;
    for (const c of def.materials) bank[c.item] = (bank[c.item] ?? 0) + c.amount;
    this.state[id] = { status: "available", remaining: 0 };
    return true;
  }

  /** Avanza i timer di ricerca e sblocca automaticamente le ricerche i cui prerequisiti sono completi. */
  tick(dt: number) {
    for (const def of RESEARCHES) {
      const st = this.state[def.id];
      if (st.status !== "researching") continue;
      st.remaining = Math.max(0, st.remaining - dt);
      if (st.remaining <= 0) st.status = "completed";
    }
    // Ricalcola locked -> available quando tutti i prerequisiti sono completi.
    for (const def of RESEARCHES) {
      const st = this.state[def.id];
      if (st.status !== "locked") continue;
      const prereqsDone = (def.requires ?? []).every((r) => this.state[r]?.status === "completed");
      if (prereqsDone) st.status = "available";
    }
  }
}
