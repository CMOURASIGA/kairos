import { checkAzureDevOpsConnection } from "@/services/integrations/azure-devops-service";
import { IntegrationAdapter } from "@/services/integrations/types";

export function createAzureDevOpsProvider(): IntegrationAdapter {
  return {
    id: "azure_devops",
    label: "Azure DevOps",
    capabilities: ["read_work_items", "project_tracking", "operational_context"],
    checkHealth: checkAzureDevOpsConnection,
  };
}

