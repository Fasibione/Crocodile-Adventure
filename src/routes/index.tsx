import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Creature Tycoon — Vertical Slice" },
      {
        name: "description",
        content:
          "Vertical slice: il Coccodrillo esplora la Prateria, combatte automaticamente Slime, Scarabei e Conigli Selvatici, raccoglie bottino e rientra al villaggio per curarsi.",
      },
      { property: "og:title", content: "Creature Tycoon — Vertical Slice" },
      {
        property: "og:description",
        content:
          "Il Coccodrillo esce dal Villaggio, esplora la Prateria, combatte e rientra per curarsi all'Ospedale.",
      },
    ],
  }),
  component: Index,
});

const GameView = lazy(() => import("@/components/GameView"));

function Index() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading game…
        </div>
      }
    >
      <GameView />
    </Suspense>
  );
}
