import { useEffect, useRef, useState } from "react";
import crocIdleUrl from "@/assets/croc_idle.png";
import crocWalkUrl from "@/assets/croc_walk.png";
import crocAttackUrl from "@/assets/croc_attack.png";
import slimeIdleUrl from "@/assets/slime_idle.png";
import slimeWalkUrl from "@/assets/slime_walk.png";
import slimeAttackUrl from "@/assets/slime_attack.png";
import rabbitIdleUrl from "@/assets/rabbit_idle.png";
import rabbitWalkUrl from "@/assets/rabbit_walk.png";
import rabbitAttackUrl from "@/assets/rabbit_attack.png";
import wolfIdleUrl from "@/assets/wolf_idle.png";
import wolfWalkUrl from "@/assets/wolf_walk.png";
import wolfAttackUrl from "@/assets/wolf_attack.png";
import beeIdleUrl from "@/assets/bee_idle.png";
import beeWalkUrl from "@/assets/bee_walk.png";
import beeAttackUrl from "@/assets/bee_attack.png";
import boarIdleUrl from "@/assets/boar_idle.png";
import boarWalkUrl from "@/assets/boar_walk.png";
import boarAttackUrl from "@/assets/boar_attack.png";
import goblinIdleUrl from "@/assets/goblin_idle.png";
import goblinWalkUrl from "@/assets/goblin_walk.png";
import goblinAttackUrl from "@/assets/goblin_attack.png";
import treantIdleUrl from "@/assets/treant_idle.png";
import treantWalkUrl from "@/assets/treant_walk.png";
import treantAttackUrl from "@/assets/treant_attack.png";
import orsoIdleUrl from "@/assets/orso_idle.png";
import orsoWalkUrl from "@/assets/orso_walk.png";
import orsoAttackUrl from "@/assets/orso_attack.png";
import spiderIdleUrl from "@/assets/spider_idle.png";
import spiderWalkUrl from "@/assets/spider_walk.png";
import spiderAttackUrl from "@/assets/spider_attack.png";
import serpenteIdleUrl from "@/assets/serpente_idle.png";
import serpenteWalkUrl from "@/assets/serpente_walk.png";
import serpenteAttackUrl from "@/assets/serpente_attack.png";
import townhallUrl from "@/assets/Municipio.png";
import hospitalUrl from "@/assets/Ospedale.png";
import smithyUrl from "@/assets/Fabbro.png";
import warehouseUrl from "@/assets/Magazzino.png";
import equipmentDepotUrl from "@/assets/Deposito_Equipaggiamenti.png";
import armorerUrl from "@/assets/Armaiolo.png";
import goldsmithUrl from "@/assets/Orafo.png";
import alchemistUrl from "@/assets/Alchimista.png";
import merchantUrl from "@/assets/Mercante.png";
import academyUrl from "@/assets/Accademia.png";
import barracksUrl from "@/assets/Caserma.png";
import { GameEngine, SPECIES_EMOJI, SPECIES_LABEL, type GameStats, type LogEntry } from "@/game/engine";
import type { AiMode, BiomeId, BuildingKind, EquipmentSlot, ItemKind, Role, Stats } from "@/game/types";
import { render, screenToWorld, type BuildingSprites, type Camera, type EnemySprites, type SpeciesSprites } from "@/game/render";
import {
  BIOMES,
  BIOME_ORDER,
  BUILDINGS,
  BUILDING_DESCRIPTION,
  BUILDING_NPC,
  EQUIPMENT_CATALOG,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABEL,
  EQUIPMENT_SLOT_VISIBLE,
  INVENTORY_CAP,
  ITEMS,
  ITEM_CATEGORY,
  RARITY_COLOR,
  RARITY_LABEL,
  ROLE_LABEL,
  SPAWN_DENSITY_LABEL,
  type SpawnDensity,
} from "@/game/config";
import { ARTISAN_BUILDINGS } from "@/game/buildingManager";
import { ArtisanModal } from "./ArtisanPanels";

interface CreatureInfo {
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  state: string;
  aiMode: AiMode;
  zoneBiome: BiomeId;
  // Prossimo edificio da raggiungere durante il rientro (null se non sta rientrando).
  nextStop: BuildingKind | null;
  role: Role | undefined;
  baseStats: Stats | undefined;
  equipment: Partial<Record<EquipmentSlot, string>>;
  scheduledEquipment: Partial<Record<EquipmentSlot, string | null>>;
  statusLabel: string;
}

export interface HudState {
  creature: CreatureInfo;
  stats: GameStats;
  log: LogEntry[];
  boss: Record<BiomeId, { alive: boolean; respawnIn: number }>;
  biomeDensity: Record<BiomeId, SpawnDensity>;
  // Incrementato ad ogni aggiornamento periodico: i pannelli degli Artigiani
  // lo usano come trigger per rileggere lo stato "live" dei rispettivi
  // manager (code di produzione, ricerche, prezzi) senza doverlo duplicare
  // qui dentro.
  refreshTick: number;
}

const AI_MODES: { id: AiMode; label: string; icon: string }[] = [
  { id: "rest", label: "Riposo", icon: "😴" },
  { id: "explore", label: "Esplorazione Libera", icon: "🧭" },
  { id: "zone", label: "Zona Specifica", icon: "📍" },
  { id: "defend", label: "Difesa del Villaggio", icon: "🛡️" },
];

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const refreshTickRef = useRef(0);
  const [openBuilding, setOpenBuilding] = useState<BuildingKind | null>(null);
  const [tappedTarget, setTappedTarget] = useState<
    { kind: "building"; building: BuildingKind } | { kind: "player" } | null
  >(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const speedRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [debug, setDebug] = useState(false);
  const debugRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const engine = new GameEngine();
    engineRef.current = engine;
    engine.load();
    const saveTimer = window.setInterval(() => engine.save(), 5000);
    const onUnload = () => engine.save();
    window.addEventListener("beforeunload", onUnload);

    const loadImg = (src: string) => {
      const i = new Image();
      i.src = src;
      return i;
    };
    const sprites: SpeciesSprites = {
      croc: {
        idle: loadImg(crocIdleUrl),
        walk: loadImg(crocWalkUrl),
        attack: loadImg(crocAttackUrl),
      },
    };
    const buildingSprites: BuildingSprites = {
      townhall: loadImg(townhallUrl),
      hospital: loadImg(hospitalUrl),
      smithy: loadImg(smithyUrl),
      warehouse: loadImg(warehouseUrl),
      equipmentDepot: loadImg(equipmentDepotUrl),
      armorer: loadImg(armorerUrl),
      goldsmith: loadImg(goldsmithUrl),
      alchemist: loadImg(alchemistUrl),
      merchant: loadImg(merchantUrl),
      academy: loadImg(academyUrl),
      barracks: loadImg(barracksUrl),
    };
    // Solo alcune specie di mostri hanno sprite dedicati per ora; le altre
    // (senza entry qui) restano sul placeholder a cerchio in drawEnemy.
    const enemySprites: EnemySprites = {
      slime: {
        idle: loadImg(slimeIdleUrl),
        walk: loadImg(slimeWalkUrl),
        attack: loadImg(slimeAttackUrl),
      },
      rabbit: {
        idle: loadImg(rabbitIdleUrl),
        walk: loadImg(rabbitWalkUrl),
        attack: loadImg(rabbitAttackUrl),
      },
      wolf: {
        idle: loadImg(wolfIdleUrl),
        walk: loadImg(wolfWalkUrl),
        attack: loadImg(wolfAttackUrl),
      },
      ape_gigante: {
        idle: loadImg(beeIdleUrl),
        walk: loadImg(beeWalkUrl),
        attack: loadImg(beeAttackUrl),
      },
      cinghiale: {
        idle: loadImg(boarIdleUrl),
        walk: loadImg(boarWalkUrl),
        attack: loadImg(boarAttackUrl),
      },
      goblin: {
        idle: loadImg(goblinIdleUrl),
        walk: loadImg(goblinWalkUrl),
        attack: loadImg(goblinAttackUrl),
      },
      treant: {
        idle: loadImg(treantIdleUrl),
        walk: loadImg(treantWalkUrl),
        attack: loadImg(treantAttackUrl),
      },
      orso: {
        idle: loadImg(orsoIdleUrl),
        walk: loadImg(orsoWalkUrl),
        attack: loadImg(orsoAttackUrl),
      },
      spider: {
        idle: loadImg(spiderIdleUrl),
        walk: loadImg(spiderWalkUrl),
        attack: loadImg(spiderAttackUrl),
      },
      serpente: {
        idle: loadImg(serpenteIdleUrl),
        walk: loadImg(serpenteWalkUrl),
        attack: loadImg(serpenteAttackUrl),
      },
    };
    const startTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        const steps = speedRef.current;
        for (let i = 0; i < steps; i++) engine.update(dt);
      }

      const rect = canvas.getBoundingClientRect();
      const cam: Camera = {
        ox: rect.width / 2,
        oy: rect.height / 2 - 40,
        zoom: zoomRef.current,
      };
      cam.ox += panRef.current.x;
      cam.oy += panRef.current.y;
      const time = (now - startTime) / 1000;
      render(ctx, engine, cam, sprites, time, rect.width, rect.height, debugRef.current, buildingSprites, enemySprites);

      hudAcc += dt;
      if (hudAcc >= 0.15) {
        hudAcc = 0;
        refreshTickRef.current++;
        const p = engine.player;
        setHud({
          creature: {
            level: p.level!.level,
            xp: Math.floor(p.level!.xp),
            xpToNext: p.level!.xpToNext,
            hp: Math.ceil(p.health!.hp),
            maxHp: p.health!.maxHp,
            attack: p.combat!.attack,
            defense: p.combat!.defense,
            speed: Math.round(p.movement!.speed * 100) / 100,
            state: p.ai!.state,
            aiMode: p.aiMode ?? "rest",
            zoneBiome: p.zoneBiome ?? "prateria",
            nextStop: p.ai!.state === "returning" ? (p.returnStops?.[0] ?? null) : null,
            role: p.role,
            baseStats: p.baseStats ? { ...p.baseStats } : undefined,
            equipment: { ...(p.equipment ?? {}) },
            scheduledEquipment: { ...(p.scheduledEquipment ?? {}) },
            statusLabel: engine.creatureStatusLabel,
          },
          stats: { ...engine.stats },
          log: [...engine.log],
          boss: engine.bossStatus,
          biomeDensity: { ...engine.biomeDensity },
          refreshTick: refreshTickRef.current,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // --- touch / pointer: pan (drag), pinch-to-zoom, tap-to-inspect ---------
    // Pointer Events unificano mouse/touch/pen: nessun listener separato
    // serve per il touch, ma su mobile manca la rotella del mouse (zoom) e
    // manca un modo per "toccare" un edificio o la creatura, percio'
    // aggiungiamo: pinch a due dita per lo zoom, e riconoscimento del tap
    // (pointerdown+up senza spostamento significativo) per aprire la Scheda.
    const TAP_MOVE_THRESHOLD = 10; // px: oltre questo e' un drag, non un tap
    const activePointers = new Map<number, { x: number; y: number }>();
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let moved = 0;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    const pointerDistance = () => {
      const pts = [...activePointers.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const hitTestTap = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const cam: Camera = {
        ox: rect.width / 2 + panRef.current.x,
        oy: rect.height / 2 - 40 + panRef.current.y,
        zoom: zoomRef.current,
      };
      const world = screenToWorld(cx, cy, cam, rect.width, rect.height);

      let best: { kind: "building"; building: BuildingKind } | { kind: "player" } | null = null;
      let bestD = Infinity;

      const player = engineRef.current?.player;
      if (player) {
        const d = Math.hypot(world.x - player.transform.pos.x, world.y - player.transform.pos.y);
        if (d < 1.3 && d < bestD) {
          bestD = d;
          best = { kind: "player" };
        }
      }
      for (const key of Object.keys(BUILDINGS) as BuildingKind[]) {
        const b = BUILDINGS[key];
        const d = Math.hypot(world.x - b.pos.x, world.y - b.pos.y);
        const threshold = b.radius + 1.2;
        if (d < threshold && d < bestD) {
          bestD = d;
          best = { kind: "building", building: key };
        }
      }
      if (best) setTappedTarget(best);
    };

    const onDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        dragging = false;
        pinchStartDist = pointerDistance();
        pinchStartZoom = zoomRef.current;
      } else if (activePointers.size === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        downX = e.clientX;
        downY = e.clientY;
        moved = 0;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 2) {
        // pinch-to-zoom: la distanza tra le due dita scala lo zoom.
        const d = pointerDistance();
        if (pinchStartDist > 0) {
          const next = Math.min(4, Math.max(0.3, pinchStartZoom * (d / pinchStartDist)));
          zoomRef.current = next;
          setZoom(next);
        }
        return;
      }
      if (!dragging) return;
      panRef.current.x += e.clientX - lastX;
      panRef.current.y += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    };
    const onUp = (e: PointerEvent) => {
      const wasSinglePointerTap =
        activePointers.size === 1 && moved < TAP_MOVE_THRESHOLD && dragging;
      activePointers.delete(e.pointerId);
      dragging = false;
      if (wasSinglePointerTap) hitTestTap(e.clientX, e.clientY);
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.style.touchAction = "none"; // evita scroll/zoom nativi del browser sul canvas

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.min(4, Math.max(0.3, zoomRef.current - e.deltaY * 0.0015));
      zoomRef.current = next;
      setZoom(next);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      engine.save();
      window.clearInterval(saveTimer);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <div className="relative flex-1">
        <canvas ref={canvasRef} className="h-[60vh] w-full touch-none lg:h-screen" />
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            onClick={() => setDebug((d) => !d)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium shadow ${
              debug ? "bg-primary text-primary-foreground" : "bg-card/90 text-card-foreground"
            }`}
          >
            Debug
          </button>
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded-md bg-card/90 px-3 py-1.5 text-sm font-medium text-card-foreground shadow"
          >
            {paused ? "Riprendi" : "Pausa"}
          </button>
          <button
            onClick={() => {
              if (!confirm("Iniziare una nuova partita? I progressi attuali andranno persi."))
                return;
              engineRef.current?.reset();
              window.location.reload();
            }}
            className="rounded-md bg-destructive/90 px-3 py-1.5 text-sm font-medium text-destructive-foreground shadow"
          >
            Nuova
          </button>
        </div>
        <div className="absolute left-3 top-3 flex gap-1.5">
          {[1, 2, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-md px-2.5 py-1.5 text-sm font-semibold shadow ${
                speed === s ? "bg-primary text-primary-foreground" : "bg-card/90 text-card-foreground"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.25) * 100) / 100))}
            className="rounded-md bg-card/90 px-3 py-1.5 text-sm font-bold text-card-foreground shadow"
          >
            −
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
            className="rounded-md bg-card/90 px-3 py-1.5 text-sm font-bold text-card-foreground shadow"
          >
            +
          </button>
          <button
            onClick={() => {
              panRef.current = { x: 0, y: 0 };
              setZoom(1);
            }}
            className="rounded-md bg-card/90 px-3 py-1.5 text-xs font-medium text-card-foreground shadow"
          >
            Centra
          </button>
        </div>
      </div>
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-t border-border bg-card p-4 text-card-foreground lg:h-screen lg:w-80 lg:border-l lg:border-t-0">
        <CreaturePanel
          hud={hud}
          onSetMode={(m, biome) => engineRef.current?.setAiMode(m, biome)}
        />
        <Inventory hud={hud} />
        <EquipmentDepotPanel
          hud={hud}
          onSchedule={(slot, itemId) => engineRef.current?.scheduleEquipment(slot, itemId)}
          onCancel={(slot) => engineRef.current?.cancelScheduledEquipment(slot)}
        />
        <ArtisanButtons openBuilding={openBuilding} onOpen={setOpenBuilding} />
        <BiomeDensityPanel
          hud={hud}
          onSetDensity={(b, d) => engineRef.current?.setBiomeDensity(b, d)}
        />
        <BossPanel hud={hud} />
        <ActivityLog hud={hud} />
      </aside>
      {openBuilding && (
        <ArtisanModal
          building={openBuilding}
          engine={engineRef.current}
          hud={hud}
          onClose={() => setOpenBuilding(null)}
        />
      )}
      {tappedTarget && (
        <SchedaModal
          target={tappedTarget}
          hud={hud}
          onClose={() => setTappedTarget(null)}
          onOpenBuilding={(b) => {
            setTappedTarget(null);
            setOpenBuilding(b);
          }}
        />
      )}
    </div>
  );
}

// Scheda compatta che si apre toccando un edificio o la creatura sulla
// mappa (vedi hitTestTap nell'useEffect sopra). Per gli Artigiani offre un
// pulsante per aprire il pannello completo (ArtisanModal); per gli altri
// edifici mostra solo nome/icona/descrizione, dato che non hanno ancora
// un'interfaccia dedicata.
function SchedaModal({
  target,
  hud,
  onClose,
  onOpenBuilding,
}: {
  target: { kind: "building"; building: BuildingKind } | { kind: "player" };
  hud: HudState | null;
  onClose: () => void;
  onOpenBuilding: (b: BuildingKind) => void;
}) {
  const isArtisan = target.kind === "building" && ARTISAN_BUILDINGS.includes(target.building);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 lg:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-card p-4 text-card-foreground shadow-xl lg:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {target.kind === "player" ? (
          <PlayerScheda hud={hud} />
        ) : (
          <BuildingScheda building={target.building} />
        )}
        <div className="mt-4 flex gap-2">
          {isArtisan && target.kind === "building" && (
            <button
              onClick={() => onOpenBuilding(target.building)}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Apri
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-medium text-card-foreground"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function BuildingScheda({ building }: { building: BuildingKind }) {
  const info = BUILDINGS[building];
  const npc = BUILDING_NPC[building];
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="text-2xl leading-none">{info.icon}</span>
        {info.name}
      </h2>
      {npc && <div className="mt-0.5 text-sm text-muted-foreground">{npc}</div>}
      <p className="mt-2 text-sm">{BUILDING_DESCRIPTION[building]}</p>
    </div>
  );
}

function PlayerScheda({ hud }: { hud: HudState | null }) {
  if (!hud) return <p className="text-muted-foreground">Caricamento…</p>;
  const c = hud.creature;
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="text-2xl leading-none">{SPECIES_EMOJI.croc}</span>
        {SPECIES_LABEL.croc}
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Livello" value={c.level} />
        <Stat label="HP" value={`${c.hp}/${c.maxHp}`} />
        <Stat label="Attacco" value={c.attack} />
        <Stat label="Difesa" value={c.defense} />
        <Stat label="Velocita'" value={c.speed} />
        <Stat label="Stato" value={c.state} />
      </div>
      {c.role && <div className="mt-2 text-sm text-muted-foreground">Ruolo: {ROLE_LABEL[c.role]}</div>}
    </div>
  );
}

function ArtisanButtons({
  openBuilding,
  onOpen,
}: {
  openBuilding: BuildingKind | null;
  onOpen: (b: BuildingKind) => void;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold">Artigiani</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {ARTISAN_BUILDINGS.map((kind) => {
          const info = BUILDINGS[kind];
          return (
            <button
              key={kind}
              onClick={() => onOpen(kind)}
              className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-2 text-xs font-medium ${
                openBuilding === kind ? "bg-primary text-primary-foreground" : "bg-muted text-card-foreground"
              }`}
            >
              <span className="text-lg leading-none">{info.icon}</span>
              <span className="text-center leading-tight">{info.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CreaturePanel({
  hud,
  onSetMode,
}: {
  hud: HudState | null;
  onSetMode: (m: AiMode, biome?: BiomeId) => void;
}) {
  if (!hud) return <p className="text-muted-foreground">Caricamento…</p>;
  const c = hud.creature;
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-lg font-bold">
        {SPECIES_EMOJI.croc} {SPECIES_LABEL.croc}
      </h2>
      <div className="space-y-2">
        <Bar label={`Livello ${c.level}`} value={c.xp / c.xpToNext} color="bg-primary" sub={`${c.xp}/${c.xpToNext} XP`} />
        <Bar label="HP" value={c.hp / c.maxHp} color="bg-destructive" sub={`${c.hp}/${c.maxHp}`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Attacco" value={c.attack} />
        <Stat label="Difesa" value={c.defense} />
        <Stat label="Velocita'" value={c.speed} />
        <div className="rounded-md bg-muted px-2 py-1.5">
          <div className="text-xs text-muted-foreground">Stato</div>
          <div className="font-semibold capitalize">{c.state}</div>
          {c.state === "returning" && c.nextStop && (
            <div className="text-[11px] text-muted-foreground">
              → {BUILDINGS[c.nextStop].name}
            </div>
          )}
          {c.state === "healing" && (
            <div className="text-[11px] text-muted-foreground">→ Ospedale (cura in corso)</div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 text-xs font-semibold">Modalita' IA</div>
        <div className="space-y-1.5">
          {AI_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onSetMode(m.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium ${
                c.aiMode === m.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-card-foreground"
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
              {m.id === "zone" && c.aiMode === "zone" && (
                <span className="ml-auto text-xs opacity-80">{BIOMES[c.zoneBiome].name}</span>
              )}
            </button>
          ))}
        </div>
        {c.aiMode === "zone" && (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {BIOME_ORDER.map((id) => {
              const biome = BIOMES[id];
              const active = c.zoneBiome === id;
              return (
                <button
                  key={id}
                  onClick={() => onSetMode("zone", id)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted/70 text-card-foreground"
                  }`}
                >
                  {biome.name}
                  {!biome.active && <span className="ml-1 opacity-60">(vuoto)</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const CATEGORY_LABELS: { category: "gold" | "material" | "equipment"; label: string; building: BuildingKind }[] = [
  { category: "gold", label: "Oro (Municipio)", building: "townhall" },
  { category: "material", label: "Materiali (Magazzino)", building: "warehouse" },
  { category: "equipment", label: "Equipaggiamenti (Deposito)", building: "equipmentDepot" },
];

function Inventory({ hud }: { hud: HudState | null }) {
  if (!hud) return null;
  const kinds = Object.keys(ITEMS) as ItemKind[];
  const carriedTotal = kinds.reduce((s, k) => s + hud.stats.carried[k], 0);
  const kindsOf = (category: string) => kinds.filter((k) => ITEM_CATEGORY[k] === category);
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">
        Inventario personale ({carriedTotal}/{INVENTORY_CAP})
      </h2>
      <div className="mb-3 space-y-1.5">
        {CATEGORY_LABELS.map(({ category, label }) => {
          const ks = kindsOf(category);
          if (ks.length === 0) return null;
          return (
            <div key={category} className="rounded-md bg-muted px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">{label}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {ks.map((k) => (
                  <span key={k}>
                    {ITEMS[k].name}: <b>{hud.stats.carried[k]}</b>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <h2 className="mb-1 text-sm font-semibold">Magazzino Condiviso del Villaggio</h2>
      <div className="space-y-1.5">
        {CATEGORY_LABELS.map(({ category, label }) => {
          const ks = kindsOf(category);
          if (ks.length === 0) {
            // Equipaggiamenti: nessun oggetto ancora esistente, ma la
            // categoria/edificio esiste gia' pronta per il futuro sistema.
            return (
              <div key={category} className="rounded-md bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
                {label}: —
              </div>
            );
          }
          return (
            <div key={category} className="rounded-md bg-muted px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">{label}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {ks.map((k) => (
                  <span key={k}>
                    {ITEMS[k].name}: <b>{hud.stats.bank[k]}</b>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Uccisioni" value={hud.stats.kills} />
        <Stat label="Viaggi" value={hud.stats.trips} />
      </div>
    </div>
  );
}

type StatBonusTotal = { hp: number; attack: number; defense: number; speed: number };
const ZERO_BONUS: StatBonusTotal = { hp: 0, attack: 0, defense: 0, speed: 0 };

function sumBonus(ids: (string | null | undefined)[]): StatBonusTotal {
  const total = { ...ZERO_BONUS };
  for (const id of ids) {
    if (!id) continue;
    const def = EQUIPMENT_CATALOG[id];
    if (!def) continue;
    total.hp += def.statBonus.hp ?? 0;
    total.attack += def.statBonus.attack ?? 0;
    total.defense += def.statBonus.defense ?? 0;
    total.speed += def.statBonus.speed ?? 0;
  }
  return total;
}

function finalStats(base: Stats | undefined, bonus: StatBonusTotal) {
  const b = base ?? { hp: 0, attack: 0, defense: 0, speed: 0 };
  return {
    hp: b.hp + bonus.hp,
    attack: b.attack + bonus.attack,
    defense: b.defense + bonus.defense,
    speed: Math.round((b.speed + bonus.speed) * 100) / 100,
  };
}

function diffLabel(delta: number) {
  if (Math.abs(delta) < 0.005) return null;
  const rounded = Math.round(delta * 100) / 100;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

/**
 * Pannello del Deposito Equipaggiamenti: per la creatura selezionata mostra
 * equip attuale/programmato per ognuno degli 8 slot, la differenza delle
 * statistiche risultante e un'anteprima delle statistiche finali, oltre allo
 * stato corrente della creatura (GDD cap. Villaggio/Equipaggiamento).
 */
function EquipmentDepotPanel({
  hud,
  onSchedule,
  onCancel,
}: {
  hud: HudState | null;
  onSchedule: (slot: EquipmentSlot, itemId: string | null) => void;
  onCancel: (slot: EquipmentSlot) => void;
}) {
  if (!hud) return null;
  const c = hud.creature;
  const role = c.role;

  const currentBonus = sumBonus(EQUIPMENT_SLOTS.map((s) => c.equipment[s]));
  const previewBonus = sumBonus(
    EQUIPMENT_SLOTS.map((s) => (s in c.scheduledEquipment ? c.scheduledEquipment[s] : c.equipment[s])),
  );
  const currentFinal = finalStats(c.baseStats, currentBonus);
  const previewFinal = finalStats(c.baseStats, previewBonus);
  const hasPending = Object.keys(c.scheduledEquipment).length > 0;

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        🛡️ Deposito Equipaggiamenti
      </h2>
      <div className="mb-2 rounded-md bg-muted px-2 py-1.5 text-xs">
        <span className="text-muted-foreground">Stato: </span>
        <b>{c.statusLabel}</b>
        {role && (
          <span className="ml-2 text-muted-foreground">
            Ruolo: <b>{ROLE_LABEL[role]}</b>
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {EQUIPMENT_SLOTS.map((slot) => {
          const currentId = c.equipment[slot];
          const currentDef = currentId ? EQUIPMENT_CATALOG[currentId] : null;
          const hasSchedule = slot in c.scheduledEquipment;
          const scheduledId = hasSchedule ? c.scheduledEquipment[slot] : undefined;
          const scheduledDef = scheduledId ? EQUIPMENT_CATALOG[scheduledId] : null;

          const available = Object.values(EQUIPMENT_CATALOG).filter(
            (def) =>
              def.slot === slot &&
              (!role || def.compatibleRoles.includes(role)) &&
              (hud.stats.equipmentStorage[def.id] ?? 0) > 0,
          );

          const selectValue = !hasSchedule ? "__keep__" : scheduledId === null ? "__none__" : scheduledId;

          return (
            <div key={slot} className="rounded-md bg-muted px-2 py-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {EQUIPMENT_SLOT_LABEL[slot]}
                  {!EQUIPMENT_SLOT_VISIBLE[slot] && <span className="ml-1 opacity-60">(non visibile)</span>}
                </span>
              </div>
              <div className="text-xs">
                Attuale:{" "}
                <b style={{ color: currentDef ? RARITY_COLOR[currentDef.rarity] : undefined }}>
                  {currentDef ? currentDef.name : "—"}
                </b>
              </div>
              {hasSchedule && (
                <div className="text-xs">
                  Programmato:{" "}
                  <b style={{ color: scheduledDef ? RARITY_COLOR[scheduledDef.rarity] : undefined }}>
                    {scheduledDef ? scheduledDef.name : "Rimozione"}
                  </b>
                  <button
                    onClick={() => onCancel(slot)}
                    className="ml-2 text-muted-foreground underline decoration-dotted"
                  >
                    annulla
                  </button>
                </div>
              )}
              <select
                className="mt-1 w-full rounded bg-background px-1.5 py-1 text-xs text-foreground"
                value={selectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__keep__") onCancel(slot);
                  else if (v === "__none__") onSchedule(slot, null);
                  else onSchedule(slot, v);
                }}
              >
                <option value="__keep__">— mantieni attuale —</option>
                <option value="__none__">Nessuno (rimuovi)</option>
                {available.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.name} · {RARITY_LABEL[def.rarity]} · Lv.{def.level}
                  </option>
                ))}
              </select>
              {available.length === 0 && (
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Nessun oggetto compatibile disponibile nel Magazzino
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-1 mt-3 text-xs font-semibold">Anteprima statistiche finali</h3>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {(["hp", "attack", "defense", "speed"] as const).map((key) => {
          const labels = { hp: "HP", attack: "Attacco", defense: "Difesa", speed: "Velocita'" };
          const delta = previewFinal[key] - currentFinal[key];
          const dl = hasPending ? diffLabel(delta) : null;
          return (
            <div key={key} className="rounded-md bg-muted px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">{labels[key]}</div>
              <div className="font-semibold">
                {hasPending ? previewFinal[key] : currentFinal[key]}
                {dl && <span className={delta > 0 ? "ml-1 text-primary" : "ml-1 text-destructive"}>({dl})</span>}
              </div>
            </div>
          );
        })}
      </div>
      {hasPending && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Il cambio verra' applicato quando la creatura raggiungera' fisicamente il Deposito.
        </p>
      )}
    </div>
  );
}

function BossPanel({ hud }: { hud: HudState | null }) {
  if (!hud) return null;
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="mb-1 text-xs font-semibold">👹 Boss dei biomi</div>
      <div className="space-y-0.5 text-xs">
        {BIOME_ORDER.map((b) => {
          const s = hud.boss[b];
          return (
            <div key={b} className="flex items-center justify-between gap-2">
              <span className="text-card-foreground">{BIOMES[b].name}</span>
              {s?.alive ? (
                <span className="text-emerald-400">Presente</span>
              ) : (
                <span className="text-muted-foreground">
                  respawn {Math.ceil(s?.respawnIn ?? 0)}s
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityLog({ hud }: { hud: HudState | null }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">Registro Attivita'</h2>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {hud?.log.slice(0, 12).map((l) => <li key={l.id}>{l.text}</li>)}
      </ul>
    </div>
  );
}

function Bar({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{sub}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted px-2 py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function BiomeDensityPanel({
  hud,
  onSetDensity,
}: {
  hud: HudState | null;
  onSetDensity: (biome: BiomeId, density: SpawnDensity) => void;
}) {
  if (!hud) return null;
  const densities: SpawnDensity[] = ["low", "medium", "high"];
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold">Densità nemici per bioma</h3>
      <div className="space-y-1.5">
        {BIOME_ORDER.map((id) => {
          const current = hud.biomeDensity[id];
          return (
            <div key={id} className="flex items-center gap-1.5">
              <span className="w-20 shrink-0 text-xs">{BIOMES[id].name}</span>
              <div className="flex flex-1 gap-1">
                {densities.map((d) => (
                  <button
                    key={d}
                    onClick={() => onSetDensity(id, d)}
                    className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium ${
                      current === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-card-foreground"
                    }`}
                  >
                    {SPAWN_DENSITY_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



// Riferimento agli edifici disponibili (usato solo per eventuale debug futuro;
// il rendering effettivo avviene in game/render.ts).
export const AVAILABLE_BUILDINGS = BUILDINGS;
