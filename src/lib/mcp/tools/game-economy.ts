import { defineTool } from "@lovable.dev/mcp-js";
import { BOSS_RESPAWN_TIME, BUILDINGS, INVENTORY_CAP, ITEMS } from "@/game/config";

export default defineTool({
  name: "game_economy",
  title: "Game economy",
  description:
    "Explain the vertical-slice game economy: village buildings, item drops, inventory cap and boss respawn time.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      buildings: BUILDINGS,
      items: ITEMS,
      inventoryCap: INVENTORY_CAP,
      bossRespawnSeconds: BOSS_RESPAWN_TIME,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
