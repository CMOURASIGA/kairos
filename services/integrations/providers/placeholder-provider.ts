import { IntegrationAdapter, IntegrationCheckResult, IntegrationId } from "@/services/integrations/types";

export function createPlaceholderProvider(params: {
  id: IntegrationId;
  label: string;
  capabilities: string[];
  requiredEnvKeys?: string[];
}): IntegrationAdapter {
  return {
    id: params.id,
    label: params.label,
    capabilities: params.capabilities,
    async checkHealth(): Promise<IntegrationCheckResult> {
      const missingEnvKeys = (params.requiredEnvKeys ?? []).filter((key) => !process.env[key]?.trim());
      if (missingEnvKeys.length > 0) {
        return {
          status: "disabled",
          message: "Integracao desabilitada por configuracao ausente.",
          details: missingEnvKeys.map((key) => `Variavel ausente: ${key}`),
        };
      }

      return {
        status: "warning",
        message: "Camada base pronta. Integracao funcional sera concluida nas proximas US.",
        details: ["Adapter desacoplado registrado e monitorado."],
      };
    },
  };
}

