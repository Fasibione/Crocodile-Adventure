import { defineTool } from "@lovable.dev/mcp-js";
import { ENEMIES } from "@/game/config";

export default defineTool({
  name: "list_enemies",
  title: "List enemies",
  description: "List every enemy kind with its stats, XP reward and item drops.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const enemies = Object.entries(ENEMIES).map(([id, def]) => ({
      id,
      name: def.name,
      stats: def.stats,
      xp: def.xp,
      drops: def.drops,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(enemies, null, 2) }],
      structuredContent: { enemies },
    };
  },
});