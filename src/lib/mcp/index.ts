import { defineMcp } from "@lovable.dev/mcp-js";
import listSpecies from "./tools/list-species";
import listEnemies from "./tools/list-enemies";
import gameEconomy from "./tools/game-economy";

export default defineMcp({
  name: "creature-village-mcp",
  title: "Creature Village MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools describing the Creature Village game: playable species and stats, enemies, and the game economy.",
  tools: [listSpecies, listEnemies, gameEconomy],
});