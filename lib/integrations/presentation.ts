import type { ConnectionStatus } from "@/lib/integrations/types";

export type ConnectionPresentation = {
  label: string;
  tone: "neutral" | "ok" | "warn" | "danger";
  comingSoon: boolean;
  connectDisabled: true;
  reconnectDisabled: true;
  disconnectDisabled: true;
};

export function presentConnection(
  status: ConnectionStatus | null,
): ConnectionPresentation {
  const disabled = {
    connectDisabled: true as const,
    reconnectDisabled: true as const,
    disconnectDisabled: true as const,
  };

  if (status === "connected") {
    return {
      label: "Conectat",
      tone: "ok",
      comingSoon: false,
      ...disabled,
    };
  }
  if (status === "needs_reconnect") {
    return {
      label: "Necesită reconectare",
      tone: "warn",
      comingSoon: false,
      ...disabled,
    };
  }
  if (status === "error") {
    return {
      label: "Eroare",
      tone: "danger",
      comingSoon: false,
      ...disabled,
    };
  }
  return {
    label: status === "setup_required" ? "Configurare necesară" : "Neconectat",
    tone: "neutral",
    comingSoon: true,
    ...disabled,
  };
}
