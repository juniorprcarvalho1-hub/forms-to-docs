import {createFileRoute} from "@tanstack/react-router";
import {executarBridgeEmail} from "@/lib/automacao-email-bridge.adapter.server";
export const Route=createFileRoute("/api/internal/documentos-email")({
 server:{handlers:{POST:({request})=>executarBridgeEmail(request)}},
});
