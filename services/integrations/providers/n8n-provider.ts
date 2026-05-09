import { checkN8nConnection } from "@/services/integrations/n8n-service";
import { IntegrationAdapter } from "@/services/integrations/types";

export function createN8nProvider(): IntegrationAdapter {
  return {
    id: "n8n",
    label: "n8n",
    capabilities: ["trigger_workflows", "execution_monitoring", "automation_bridge"],
    checkHealth: checkN8nConnection,
  };
}

