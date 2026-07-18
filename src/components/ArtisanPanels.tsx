import type { GameEngine } from "@/game/engine";
import type { HudState } from "./GameView";
import type { BuildingKind, CraftingBuilding, ItemKind, Role } from "@/game/types";
import { BUILDINGS, BUILDING_NPC, EQUIPMENT_CATALOG, ITEMS, RARITY_COLOR, RARITY_LABEL, ROLE_LABEL, ROLE_ORDER } from "@/game/config";
import { getRecipesForBuilding, canAfford, getMissingMaterials } from "@/game/recipeManager";
import { MERCHANT_LISTINGS } from "@/game/merchantManager";
import { CRAFTING_BUILDINGS } from "@/game/buildingManager";

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ArtisanModal({
  building,
  engine,
  hud,
  onClose,
}: {
  building: BuildingKind;
  engine: GameEngine | null;
  hud: HudState | null;
  onClose: () => void;
}) {
  if (!engine || !hud) return null;
  const info = BUILDINGS[building];
  const npc = BUILDING_NPC[building];
  const isCrafting = (CRAFTING_BUILDINGS as BuildingKind[]).includes(building);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-card p-4 text-card-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              {info.icon} {info.name}
            </h2>
            {npc && <p className="text-xs text-muted-foreground">{npc}</p>}
          </div>
          <button onClick={onClose} className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium">
            ✕
          </button>
        </div>

        {isCrafting && (
          <CraftingPanel building={building as CraftingBuilding} engine={engine} hud={hud} />
        )}
        {building === "academy" && <AcademyPanel engine={engine} hud={hud} />}
        {building === "barracks" && <BarracksPanel engine={engine} hud={hud} />}
        {building === "merchant" && <MerchantPanel engine={engine} hud={hud} />}
      </div>
    </div>
  );
}

// ---- Armaiolo / Orafo / Alchimista ------------------------------------------
function CraftingPanel({
  building,
  engine,
  hud,
}: {
  building: CraftingBuilding;
  engine: GameEngine;
  hud: HudState;
}) {
  const recipes = getRecipesForBuilding(building);
  const bank = hud.stats.bank;
  const queue = engine.crafting.getQueue(building);

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Ricette disponibili</h3>
      <div className="space-y-2">
        {recipes.map((r) => {
          const ok = canAfford(r, bank, bank.gold);
          const missing = getMissingMaterials(r, bank);
          return (
            <div key={r.id} className="rounded-md bg-muted px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between">
                <b>{r.name}</b>
                <span className="text-muted-foreground">⏱ {fmtTime(r.productionTimeSec)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {r.materials.map((m) => {
                  const have = bank[m.item] ?? 0;
                  const short = have < m.amount;
                  return (
                    <span key={m.item} className={short ? "text-destructive" : "text-muted-foreground"}>
                      {ITEMS[m.item].name}: {have}/{m.amount}
                    </span>
                  );
                })}
                {r.goldCost > 0 && (
                  <span className={bank.gold < r.goldCost ? "text-destructive" : "text-muted-foreground"}>
                    Oro: {bank.gold}/{r.goldCost}
                  </span>
                )}
              </div>
              <button
                onClick={() => engine.queueProduction(r.id)}
                disabled={!ok}
                className={`mt-1.5 w-full rounded-md px-2 py-1 text-xs font-semibold ${
                  ok ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-background text-muted-foreground"
                }`}
              >
                Produci
              </button>
              {!ok && missing.length > 0 && (
                <div className="mt-0.5 text-[10px] text-destructive">Materiali insufficienti</div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">
        Coda di produzione ({queue.length})
      </h3>
      {queue.length === 0 && <p className="text-xs text-muted-foreground">Nessuna produzione in corso.</p>}
      <div className="space-y-1.5">
        {queue.map((o) => {
          const recipeName = getRecipesForBuilding(building).find((r) => r.id === o.recipeId)?.name ?? o.recipeId;
          const progress = 1 - o.remaining / o.totalTime;
          return (
            <div key={o.id} className="rounded-md bg-muted px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between">
                <b>{recipeName}</b>
                <span className="text-muted-foreground">{o.ready ? "Pronto!" : fmtTime(o.remaining)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {o.ready ? (
                  <button
                    onClick={() => engine.collectProduction(o.id)}
                    className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                  >
                    Ritira
                  </button>
                ) : (
                  <button
                    onClick={() => engine.cancelProduction(o.id)}
                    className="flex-1 rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground"
                  >
                    Annulla
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Accademia ---------------------------------------------------------------
function AcademyPanel({ engine, hud }: { engine: GameEngine; hud: HudState }) {
  const bank = hud.stats.bank;
  const all = engine.academy.getAll();
  const STATUS_LABEL: Record<string, string> = {
    locked: "Bloccata",
    available: "Disponibile",
    researching: "In corso",
    completed: "Completata",
  };
  return (
    <div className="space-y-2">
      {all.map(({ def, state }) => (
        <div key={def.id} className="rounded-md bg-muted px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between">
            <b>{def.name}</b>
            <span
              className={
                state.status === "completed"
                  ? "text-primary"
                  : state.status === "locked"
                    ? "text-muted-foreground"
                    : "text-foreground"
              }
            >
              {STATUS_LABEL[state.status]}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{def.description}</p>
          {state.status === "locked" && def.requires && (
            <p className="mt-0.5 text-[10px] text-destructive">
              Richiede: {def.requires.map((r) => all.find((x) => x.def.id === r)?.def.name ?? r).join(", ")}
            </p>
          )}
          {state.status === "researching" && (
            <div className="mt-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (1 - state.remaining / def.timeSec) * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{fmtTime(state.remaining)} rimanenti</span>
                <button
                  onClick={() => engine.cancelResearch(def.id)}
                  className="rounded-md bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
          {state.status === "available" && (
            <>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {def.materials.map((m) => (
                  <span key={m.item} className={(bank[m.item] ?? 0) < m.amount ? "text-destructive" : "text-muted-foreground"}>
                    {ITEMS[m.item].name}: {bank[m.item] ?? 0}/{m.amount}
                  </span>
                ))}
                <span className={bank.gold < def.goldCost ? "text-destructive" : "text-muted-foreground"}>
                  Oro: {bank.gold}/{def.goldCost}
                </span>
              </div>
              <button
                onClick={() => engine.startResearch(def.id)}
                className="mt-1.5 w-full rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
              >
                Avvia Ricerca ({fmtTime(def.timeSec)})
              </button>
            </>
          )}
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">
        Gli effetti delle ricerche completate verranno applicati in una fase successiva.
      </p>
    </div>
  );
}

// ---- Caserma -------------------------------------------------------------------
function BarracksPanel({ engine, hud }: { engine: GameEngine; hud: HudState }) {
  const role = hud.creature.role;
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Ruolo attuale: <b className="text-foreground">{role ? ROLE_LABEL[role] : "—"}</b>
      </p>
      <div className="space-y-1.5">
        {ROLE_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => engine.reassignRole(r)}
            className={`w-full rounded-md px-2.5 py-2 text-left text-sm font-medium ${
              role === r ? "bg-primary text-primary-foreground" : "bg-muted text-card-foreground"
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Le statistiche vengono ricalcolate automaticamente. Gli oggetti indossati o programmati non
        compatibili con il nuovo ruolo tornano nel Magazzino Equipaggiamenti.
      </p>
    </div>
  );
}

// ---- Mercante ------------------------------------------------------------------
function MerchantPanel({ engine, hud }: { engine: GameEngine; hud: HudState }) {
  const bank = hud.stats.bank;
  const equipmentStorage = hud.stats.equipmentStorage;
  const ownedEquipment = Object.entries(equipmentStorage).filter(([, qty]) => (qty ?? 0) > 0);

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Materiali</h3>
      <div className="space-y-1.5">
        {MERCHANT_LISTINGS.map((l) => {
          const buyPrice = engine.merchant.getBuyPrice(l.item);
          const sellPrice = engine.merchant.getSellPrice(l.item);
          const owned = bank[l.item as ItemKind] ?? 0;
          return (
            <div key={l.item} className="rounded-md bg-muted px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between">
                <b>{ITEMS[l.item as ItemKind].name}</b>
                <span className="text-muted-foreground">Possiedi: {owned}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  onClick={() => engine.buyMaterial(l.item, 1)}
                  disabled={bank.gold < buyPrice}
                  className="flex-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Compra 1 ({buyPrice} Oro)
                </button>
                <button
                  onClick={() => engine.sellMaterial(l.item, 1)}
                  disabled={owned < 1}
                  className="flex-1 rounded-md bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Vendi 1 ({sellPrice} Oro)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">
        Equipaggiamenti inutilizzati
      </h3>
      {ownedEquipment.length === 0 && (
        <p className="text-xs text-muted-foreground">Nessun equipaggiamento da vendere nel Magazzino.</p>
      )}
      <div className="space-y-1.5">
        {ownedEquipment.map(([id, qty]) => {
          const def = EQUIPMENT_CATALOG[id];
          if (!def) return null;
          const price = engine.merchant.getEquipmentSellPrice(id);
          return (
            <div key={id} className="flex items-center justify-between rounded-md bg-muted px-2.5 py-2 text-xs">
              <div>
                <b style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</b>
                <div className="text-[10px] text-muted-foreground">
                  {RARITY_LABEL[def.rarity]} · x{qty}
                </div>
              </div>
              <button
                onClick={() => engine.sellEquipment(id)}
                className="rounded-md bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                Vendi ({price} Oro)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
