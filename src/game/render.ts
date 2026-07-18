import {
  BIOMES,
  BIOME_ORDER,
  BOSS_AREAS,
  BUILDINGS,
  ENEMIES,
  ITEMS,
  TILE,
  VILLAGE,
  VILLAGE_GATE_HALF,
  WORLD,
  biomeAt,
} from "./config";
import type { BuildingKind, Entity, EnemyKind, ItemKind } from "./types";
import type { GameEngine } from "./engine";

export interface Camera {
  ox: number;
  oy: number;
  zoom: number;
}

export interface PlayerSprites {
  idle: HTMLImageElement | null;
  walk: HTMLImageElement | null;
  attack: HTMLImageElement | null;
}

export type SpeciesSprites = Record<string, PlayerSprites>;

// I mostri riusano la stessa forma (idle/walk/attack) degli sprite del
// giocatore. Solo alcune specie hanno sprite dedicati: le altre restano sul
// placeholder a cerchio disegnato da drawEnemy quando la entry manca o le
// immagini non sono ancora caricate.
export type EnemySprites = Partial<Record<string, PlayerSprites>>;

export type BuildingSprites = Partial<Record<BuildingKind, HTMLImageElement>>;

const CELL = 104; // source cell size in the sprite strips
const ATTACK_DUR = 0.25; // matches engine attackAnim duration
const WALL_HEIGHT = 78;

const toIso = (x: number, y: number, cam: Camera) => ({
  sx: (x - y) * (TILE.w / 2) + cam.ox,
  sy: (x + y) * (TILE.h / 2) + cam.oy,
});

/**
 * Inversa di toIso + della trasformazione di zoom applicata in render()
 * (scala centrata su (w/2,h/2)). Converte una coordinata canvas (es. un tap)
 * nella corrispondente posizione world-space, per il tap-to-inspect su
 * edifici e creatura (vedi GameView.tsx).
 */
export function screenToWorld(
  cx: number,
  cy: number,
  cam: Camera,
  w: number,
  h: number,
): { x: number; y: number } {
  const zoom = cam.zoom || 1;
  const isoX = (cx - w / 2) / zoom + w / 2;
  const isoY = (cy - h / 2) / zoom + h / 2;
  const a = (isoX - cam.ox) / (TILE.w / 2); // x - y
  const b = (isoY - cam.oy) / (TILE.h / 2); // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + TILE.w / 2, sy + TILE.h / 2);
  ctx.lineTo(sx, sy + TILE.h);
  ctx.lineTo(sx - TILE.w / 2, sy + TILE.h / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  cam: Camera,
  sprites: SpeciesSprites,
  time: number,
  w: number,
  h: number,
  debug = false,
  buildingSprites: BuildingSprites = {},
  enemySprites: EnemySprites = {},
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#1b2a1f";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  const zoom = cam.zoom ?? 1;
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  // ground tiles: dentro il villaggio terreno chiaro, fuori un bioma diverso
  // a seconda del settore (Modifica 7). Solo la Prateria e' attiva: gli altri
  // biomi esistono gia' come area della mappa ma restano vuoti.
  for (let x = WORLD.min; x <= WORLD.max; x++) {
    for (let y = WORLD.min; y <= WORLD.max; y++) {
      const { sx, sy } = toIso(x, y, cam);
      const inVillage =
        Math.abs(x - VILLAGE.x) <= VILLAGE.radius && Math.abs(y - VILLAGE.y) <= VILLAGE.radius;
      const tint = inVillage ? "#6b5a36" : BIOMES[biomeAt({ x, y })].groundColor;
      const shade = (x + y) % 2 === 0 ? tint : shadeColor(tint, -0.08);
      drawDiamond(ctx, sx, sy - TILE.h / 2, shade, "#0003");
    }
  }

  // mura del villaggio: blocchi isometrici alti sul perimetro quadrato, 4 varchi.
  for (let x = VILLAGE.x - VILLAGE.radius; x <= VILLAGE.x + VILLAGE.radius; x++) {
    for (let y = VILLAGE.y - VILLAGE.radius; y <= VILLAGE.y + VILLAGE.radius; y++) {
      const onEdge =
        Math.abs(x - VILLAGE.x) === VILLAGE.radius ||
        Math.abs(y - VILLAGE.y) === VILLAGE.radius;
      if (!onEdge) continue;
      const isGate =
        (Math.abs(x - VILLAGE.x) <= VILLAGE_GATE_HALF &&
          Math.abs(y - VILLAGE.y) === VILLAGE.radius) ||
        (Math.abs(y - VILLAGE.y) <= VILLAGE_GATE_HALF &&
          Math.abs(x - VILLAGE.x) === VILLAGE.radius);
      if (isGate) continue;
      const { sx, sy } = toIso(x, y, cam);
      drawWall(ctx, sx, sy);
    }
  }

  // etichette dei biomi non ancora attivi (Modifica 7: solo struttura, vuoti)
  drawBiomeLabels(ctx, cam);

  // edifici (sprite pixel-art se disponibile, altrimenti fallback isometrico)
  for (const key of Object.keys(BUILDINGS) as BuildingKind[]) {
    const b = BUILDINGS[key];
    const { sx, sy } = toIso(b.pos.x, b.pos.y, cam);
    drawBuilding(ctx, sx, sy, b.icon, b.name, buildingSprites[key]);
  }

  // sort entities by depth (x+y)
  const sorted = [...engine.entities].sort(
    (a, b) =>
      a.transform.pos.x + a.transform.pos.y - (b.transform.pos.x + b.transform.pos.y),
  );

  for (const e of sorted) {
    const { sx, sy } = toIso(e.transform.pos.x, e.transform.pos.y, cam);
    if (e.kind === "item") {
      drawItem(ctx, e, sx, sy);
    } else if (e.kind === "player") {
      const set = sprites[e.species ?? "croc"] ?? sprites.croc;
      drawPlayer(ctx, e, sx, sy, set, time);
    } else {
      drawEnemy(ctx, e, sx, sy, enemySprites[e.kind] ?? null, time);
    }
  }

  if (debug) drawDebug(ctx, engine, cam);

  // floating combat numbers
  ctx.textAlign = "center";
  ctx.font = "bold 11px ui-sans-serif, system-ui";
  for (const f of engine.floaters) {
    const { sx, sy } = toIso(f.x, f.y, cam);
    const t = f.age / f.ttl;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = "#000";
    ctx.fillText(f.text, sx + 1, sy - 22 - t * 20 + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, sx, sy - 22 - t * 20);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Disegna un cerchio del mondo di gioco (spawn area, aggro range, leash...)
// campionando punti lungo la circonferenza e proiettandoli in isometrico,
// cosi' risulta correttamente "schiacciato" come il resto della mappa.
function drawWorldCircle(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  center: { x: number; y: number },
  radius: number,
  color: string,
  dashed = false,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wx = center.x + Math.cos(a) * radius;
    const wy = center.y + Math.sin(a) * radius;
    const { sx, sy } = toIso(wx, wy, cam);
    const py = sy - TILE.h / 2;
    if (i === 0) ctx.moveTo(sx, py);
    else ctx.lineTo(sx, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Debug overlay (Modifica 9): Spawn Point / Spawn Radius, Aggro Range,
// Leash Distance e Boss Area. Attivabile/disattivabile dal pulsante "Debug".
function drawDebug(ctx: CanvasRenderingContext2D, engine: GameEngine, cam: Camera) {
  ctx.save();
  ctx.textAlign = "center";

  // Boss Area (oro): punto di apparizione iniziale del Boss di ciascun
  // bioma. Il resto dei mostri (Boss inclusi, dopo l'apparizione) vaga su
  // tutta l'estensione del proprio bioma, niente piu' Spawn Area fisse.
  for (const b of BIOME_ORDER) {
    const area = BOSS_AREAS[b];
    const bossDef = ENEMIES[area.kind];
    drawWorldCircle(ctx, cam, area.pos, area.radius, "#ffd65a");
    const { sx, sy } = toIso(area.pos.x, area.pos.y, cam);
    ctx.font = "bold 9px ui-sans-serif, system-ui";
    ctx.fillStyle = "#ffd65a";
    ctx.fillText(`Boss Area (${bossDef.name})`, sx, sy - TILE.h / 2 - 6);
  }

  // Aggro Range corrente di ogni mostro vivo (rosso, intorno alla sua posizione).
  for (const e of engine.entities) {
    if (e.faction !== "enemy" || !e.alive || !e.aggroRange) continue;
    drawWorldCircle(ctx, cam, e.transform.pos, e.aggroRange, "#e05a4d");
  }

  // Stato/modalita' della creatura giocabile.
  const p = engine.player;
  if (p.alive) {
    const ap = toIso(p.transform.pos.x, p.transform.pos.y, cam);
    const label = `${p.aiMode ?? "rest"} · ${p.ai?.state ?? "idle"}`;
    ctx.font = "bold 10px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText(label, ap.sx + 1, ap.sy - 64);
    ctx.fillStyle = "#7fe6ff";
    ctx.fillText(label, ap.sx, ap.sy - 65);
  }
  ctx.restore();
}

function drawShadow(ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number) {
  ctx.beginPath();
  ctx.ellipse(sx, sy, r, r / 2.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#0006";
  ctx.fill();
}

// Darken/lighten a #rrggbb color by amount in [-1, 1].
function shadeColor(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + c * amount)));
  const r = f((n >> 16) & 0xff);
  const g = f((n >> 8) & 0xff);
  const b = f(n & 0xff);
  return `rgb(${r},${g},${b})`;
}

// Draw a tall isometric wall block at ground iso (sx, sy).
function drawWall(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  const H = WALL_HEIGHT;
  const gy = sy - TILE.h / 2;
  const ty = gy - H;
  const hw = TILE.w / 2;
  const hh = TILE.h / 2;
  ctx.beginPath();
  ctx.moveTo(sx, ty);
  ctx.lineTo(sx + hw, ty + hh);
  ctx.lineTo(sx, ty + TILE.h);
  ctx.lineTo(sx - hw, ty + hh);
  ctx.closePath();
  ctx.fillStyle = "#8a8074";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx - hw, ty + hh);
  ctx.lineTo(sx, ty + TILE.h);
  ctx.lineTo(sx, ty + TILE.h + H);
  ctx.lineTo(sx - hw, ty + hh + H);
  ctx.closePath();
  ctx.fillStyle = "#5b5249";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx + hw, ty + hh);
  ctx.lineTo(sx, ty + TILE.h);
  ctx.lineTo(sx, ty + TILE.h + H);
  ctx.lineTo(sx + hw, ty + hh + H);
  ctx.closePath();
  ctx.fillStyle = "#6e6458";
  ctx.fill();
  ctx.strokeStyle = "#2a2620";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Etichetta ogni bioma al centro del proprio settore. Con la mappa più
// grande e i 7 biomi attivi, ognuno ha una fetta uguale intorno al
// villaggio.
function drawBiomeLabels(ctx: CanvasRenderingContext2D, cam: Camera) {
  const R = VILLAGE.radius + 22;
  const SECTOR = 360 / BIOME_ORDER.length;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 12px ui-sans-serif, system-ui";
  for (let i = 0; i < BIOME_ORDER.length; i++) {
    const id = BIOME_ORDER[i];
    const biome = BIOMES[id];
    const angMid = (i * SECTOR * Math.PI) / 180;
    const wx = VILLAGE.x + Math.cos(angMid) * R;
    const wy = VILLAGE.y + Math.sin(angMid) * R;
    const { sx, sy } = toIso(wx, wy, cam);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(biome.name, sx + 1, sy + 1);
    ctx.fillStyle = "#f6efd8";
    ctx.fillText(biome.name, sx, sy);
  }
  ctx.restore();
}


// Disegna un edificio come un semplice blocco isometrico con icona + nome
// sopra. Nessuna specie/mostro puo' entrarci: e' solo scenografia/interazione
// (l'Ospedale cura, il Fabbro e il Municipio sono presenti ma senza logica
// aggiuntiva in questa vertical slice).
function drawBuilding(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  icon: string,
  name: string,
  img?: HTMLImageElement,
) {
  ctx.save();
  ctx.textAlign = "center";

  if (img && img.complete && img.naturalWidth > 0) {
    // Sprite pixel-art isometrico. Scala mantenendo le proporzioni,
    // ancorato alla base del tile (piedi dell'edificio sulla cella).
    const spriteW = TILE.w * 2.6;
    const scale = spriteW / img.naturalWidth;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const baseY = sy + TILE.h / 2; // fondo del tile isometrico
    const drawX = sx - drawW / 2;
    const drawY = baseY - drawH;
    // Rendering nitido per pixel art.
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.font = "bold 10px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText(name, sx + 1, drawY - 4 + 1);
    ctx.fillStyle = "#fff3d6";
    ctx.fillText(name, sx, drawY - 4);
    ctx.restore();
    return;
  }

  // Fallback: blocco isometrico geometrico + emoji.
  const H = 34;
  const hw = TILE.w * 0.9;
  const hh = TILE.h * 0.9;
  const gy = sy - TILE.h / 2;
  const ty = gy - H;
  ctx.beginPath();
  ctx.moveTo(sx, ty);
  ctx.lineTo(sx + hw / 2, ty + hh / 2);
  ctx.lineTo(sx, ty + hh);
  ctx.lineTo(sx - hw / 2, ty + hh / 2);
  ctx.closePath();
  ctx.fillStyle = "#caa15a";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx - hw / 2, ty + hh / 2);
  ctx.lineTo(sx, ty + hh);
  ctx.lineTo(sx, ty + hh + H);
  ctx.lineTo(sx - hw / 2, ty + hh / 2 + H);
  ctx.closePath();
  ctx.fillStyle = "#8a6a3a";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx + hw / 2, ty + hh / 2);
  ctx.lineTo(sx, ty + hh);
  ctx.lineTo(sx, ty + hh + H);
  ctx.lineTo(sx + hw / 2, ty + hh / 2 + H);
  ctx.closePath();
  ctx.fillStyle = "#a17c46";
  ctx.fill();
  ctx.strokeStyle = "#3a2513";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = "16px ui-sans-serif, system-ui";
  ctx.fillText(icon, sx, ty - 6);
  ctx.font = "bold 10px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(name, sx + 1, ty - 20 + 1);
  ctx.fillStyle = "#fff3d6";
  ctx.fillText(name, sx, ty - 20);
  ctx.restore();
}

function hpBar(
  ctx: CanvasRenderingContext2D,
  sx: number,
  topY: number,
  ratio: number,
  width = 30,
) {
  ctx.fillStyle = "#000a";
  ctx.fillRect(sx - width / 2, topY, width, 5);
  ctx.fillStyle = ratio > 0.5 ? "#5fd17a" : ratio > 0.25 ? "#f5c542" : "#e05a4d";
  ctx.fillRect(sx - width / 2, topY, width * Math.max(0, ratio), 5);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  sprites: PlayerSprites,
  time: number,
) {
  drawShadow(ctx, sx, sy + 4, 15);

  let img: HTMLImageElement | null;
  let frame = 0;
  let frames = 1;
  if (e.attackAnim > 0 && sprites.attack) {
    img = sprites.attack;
    frames = 4;
    const progress = 1 - Math.max(0, e.attackAnim) / ATTACK_DUR;
    frame = Math.min(frames - 1, Math.floor(progress * frames));
  } else if (e.moving && sprites.walk) {
    img = sprites.walk;
    frames = 4;
    frame = Math.floor(time * 8) % frames;
  } else {
    img = sprites.idle;
    frames = 1;
    frame = 0;
  }

  const drawW = 48;
  const drawH = 48;
  const bobIdle = !e.moving && e.attackAnim <= 0 ? Math.sin(time * 3) * 1.5 : 0;
  const destX = sx - drawW / 2;
  const destY = sy + 8 - drawH + bobIdle;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    if (e.transform.facing < 0) {
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-sx, 0);
    }
    if (e.hitFlash > 0) ctx.globalAlpha = 0.6;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, frame * CELL, 0, CELL, CELL, destX, destY, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#4f8a4a";
    ctx.beginPath();
    ctx.arc(sx, sy - 11, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEquipment(ctx, e, sx, sy + bobIdle);
  if (e.health) hpBar(ctx, sx, sy - 48, e.health.hp / e.health.maxHp, 26);
}

// Overlay procedurali per l'equipaggiamento visibile (Elmo / Corazza / Arma),
// allineati allo sprite 48px del Coccodrillo.
// Rende visivamente i 6 slot visibili come layer procedurali indipendenti
// (placeholder in attesa di sprite dedicati): Elmo, Armatura, Guanti,
// Stivali, Arma Mano Destra, Arma Mano Sinistra/Scudo. Anello e Cintura non
// sono mai disegnati: modificano solo le statistiche (slot non visibili).
function drawEquipment(ctx: CanvasRenderingContext2D, e: Entity, sx: number, sy: number) {
  const eq = e.equipment;
  if (!eq) return;
  const dir = e.transform.facing < 0 ? -1 : 1;
  ctx.save();
  ctx.lineWidth = 1;
  if (eq.armor) {
    ctx.fillStyle = "#8a5a2b";
    ctx.strokeStyle = "#3a2513";
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 24);
    ctx.lineTo(sx + 8, sy - 24);
    ctx.lineTo(sx + 6, sy - 10);
    ctx.lineTo(sx - 6, sy - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (eq.weaponRight) {
    const hx = sx + dir * 13;
    ctx.strokeStyle = "#d8d2c4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, sy - 26);
    ctx.lineTo(hx, sy - 6);
    ctx.stroke();
    ctx.strokeStyle = "#6b4a25";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx - 3, sy - 10);
    ctx.lineTo(hx + 3, sy - 10);
    ctx.stroke();
  }
  if (eq.weaponLeft) {
    // Mano sinistra/Scudo: disegnato sul lato opposto all'arma destra.
    const hx = sx - dir * 13;
    ctx.fillStyle = "#5c6a70";
    ctx.strokeStyle = "#2a3236";
    ctx.beginPath();
    ctx.ellipse(hx, sy - 16, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (eq.helmet) {
    ctx.fillStyle = "#7a5230";
    ctx.strokeStyle = "#3a2513";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy - 31, 8, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(sx - 8, sy - 32, 16, 2);
  }
  if (eq.gloves) {
    ctx.fillStyle = "#5a4530";
    ctx.beginPath();
    ctx.arc(sx + dir * 13, sy - 8, 2.4, 0, Math.PI * 2);
    ctx.arc(sx - dir * 13, sy - 8, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (eq.boots) {
    ctx.fillStyle = "#3a2f22";
    ctx.fillRect(sx - 7, sy - 4, 5, 4);
    ctx.fillRect(sx + 2, sy - 4, 5, 4);
  }
  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  sx: number,
  sy: number,
  sprite: PlayerSprites | null,
  time: number,
) {
  const def = ENEMIES[e.kind as EnemyKind];
  const isBoss = !!e.isBoss;
  drawShadow(ctx, sx, sy + 2, isBoss ? 18 : 11);
  const hasSprite = !!(sprite && sprite.idle && sprite.idle.complete && sprite.idle.naturalWidth > 0);

  let labelY: number; // riferimento verticale per nome/barra HP, sopra la testa

  if (hasSprite) {
    let img: HTMLImageElement | null = sprite!.idle;
    let frames = 1;
    let frame = 0;
    if (e.attackAnim > 0 && sprite!.attack) {
      img = sprite!.attack;
      frames = Math.max(1, Math.round(img.naturalWidth / CELL));
      const progress = 1 - Math.max(0, e.attackAnim) / ATTACK_DUR;
      frame = Math.min(frames - 1, Math.floor(progress * frames));
    } else if (e.moving && sprite!.walk) {
      img = sprite!.walk;
      frames = Math.max(1, Math.round(img.naturalWidth / CELL));
      frame = Math.floor(time * 8) % frames;
    } else {
      frames = Math.max(1, Math.round(img.naturalWidth / CELL));
      frame = Math.floor(time * 3) % frames; // idle: bob lento tra i frame disponibili
    }
    const size = isBoss ? 68 : 44; // i Boss sono visibilmente piu' grandi
    const bob = e.attackAnim > 0 ? -2 : 0;
    const destX = sx - size / 2;
    const destY = sy + 4 - size + bob;
    ctx.save();
    if (isBoss) {
      ctx.strokeStyle = "#ffd65a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, size * 0.4, size * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.transform.facing < 0) {
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-sx, 0);
    }
    if (e.hitFlash > 0) ctx.globalAlpha = 0.6;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, frame * CELL, 0, CELL, CELL, destX, destY, size, size);
    ctx.restore();
    labelY = sy - size + bob;
  } else {
    const bob = e.attackAnim > 0 ? -2 : 0;
    ctx.save();
    if (e.hitFlash > 0) ctx.globalAlpha = 0.5;
    ctx.fillStyle = e.hitFlash > 0 ? "#fff" : def.color;
    ctx.strokeStyle = isBoss ? "#ffd65a" : "#0008";
    ctx.lineWidth = isBoss ? 2.5 : 1.5;
    const r = isBoss ? 17 : 10;
    ctx.beginPath();
    ctx.arc(sx, sy - r + bob, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a1a1a";
    const ex = e.transform.facing < 0 ? -3 : 3;
    ctx.beginPath();
    ctx.arc(sx + ex - 2, sy - r - 1 + bob, isBoss ? 2.4 : 1.5, 0, Math.PI * 2);
    ctx.arc(sx + ex + 2, sy - r - 1 + bob, isBoss ? 2.4 : 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    labelY = sy - 2 * r;
  }

  ctx.fillStyle = isBoss ? "#ffd65a" : "#dfe6df";
  ctx.font = isBoss ? "bold 9px ui-sans-serif, system-ui" : "8px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(def.name, sx, labelY - 9);
  if (e.health) hpBar(ctx, sx, labelY - 6, e.health.hp / e.health.maxHp, isBoss ? 34 : 20);
}

function drawItem(ctx: CanvasRenderingContext2D, e: Entity, sx: number, sy: number) {
  const def = ITEMS[e.item!.kind as ItemKind];
  const blink = e.item!.ttl < 4 && Math.floor(e.item!.ttl * 6) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.fillStyle = def.color;
  ctx.strokeStyle = "#0009";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(sx, sy - 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
