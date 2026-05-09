import { checkGoogleDriveConnection } from "@/services/integrations/google-drive-service";
import { IntegrationAdapter } from "@/services/integrations/types";

export function createGoogleDriveProvider(): IntegrationAdapter {
  return {
    id: "google_drive",
    label: "Google Drive",
    capabilities: ["read_documents", "contextual_documents"],
    checkHealth: checkGoogleDriveConnection,
  };
}

