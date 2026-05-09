import { checkGmailConnection } from "@/services/integrations/gmail-service";
import { IntegrationAdapter } from "@/services/integrations/types";

export function createGmailProvider(): IntegrationAdapter {
  return {
    id: "gmail",
    label: "Gmail",
    capabilities: ["read_emails", "email_automation"],
    checkHealth: checkGmailConnection,
  };
}

