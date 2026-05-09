import { createGmailProvider } from "@/services/integrations/providers/gmail-provider";
import { createGoogleCalendarProvider } from "@/services/integrations/providers/google-calendar-provider";
import { createGoogleDriveProvider } from "@/services/integrations/providers/google-drive-provider";
import { createAzureDevOpsProvider } from "@/services/integrations/providers/azure-devops-provider";
import { createN8nProvider } from "@/services/integrations/providers/n8n-provider";
import { IntegrationAdapter, IntegrationId } from "@/services/integrations/types";

const adapterRegistry = new Map<IntegrationId, IntegrationAdapter>();
let initialized = false;

export function registerIntegrationAdapter(adapter: IntegrationAdapter): void {
  adapterRegistry.set(adapter.id, adapter);
}

export function listIntegrationAdapters(): IntegrationAdapter[] {
  ensureDefaultIntegrationAdapters();
  return Array.from(adapterRegistry.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function ensureDefaultIntegrationAdapters(): void {
  if (initialized) return;
  initialized = true;

  registerIntegrationAdapter(
    createGmailProvider(),
  );

  registerIntegrationAdapter(
    createGoogleCalendarProvider(),
  );

  registerIntegrationAdapter(
    createGoogleDriveProvider(),
  );

  registerIntegrationAdapter(
    createAzureDevOpsProvider(),
  );

  registerIntegrationAdapter(
    createN8nProvider(),
  );
}
