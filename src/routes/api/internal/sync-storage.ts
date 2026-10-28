import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/sync-storage")({
  server: {
    handlers: {
      POST: () => Response.json(
        { error: "Transferência encerrada." },
        { status: 410, headers: { "cache-control": "no-store" } },
      ),
    },
  },
});
