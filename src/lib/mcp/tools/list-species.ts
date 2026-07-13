import { defineTool } from "@lovable.dev/mcp-js";
import { SPECIES_BASE } from "@/game/config";

const LABELS: Record<string, string> = {
  croc: "Coccodrillo",
};

export default defineTool({
  name: "list_species",
  title: "List playable species",
  description: "List every playable creature with its base stats (hp, attack, defense, speed).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const roster = Object.entries(SPECIES_BASE).map(([id, stats]) => ({
      id,
      name: LABELS[id] ?? id,
      ...stats,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(roster, null, 2) }],
      structuredContent: { species: roster },
    };
  },
});