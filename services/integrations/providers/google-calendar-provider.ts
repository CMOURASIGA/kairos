import { checkGoogleCalendarConnection } from "@/services/integrations/google-calendar-service";
import { IntegrationAdapter } from "@/services/integrations/types";

export function createGoogleCalendarProvider(): IntegrationAdapter {
  return {
    id: "google_calendar",
    label: "Google Calendar",
    capabilities: ["read_events", "daily_agenda_sync"],
    checkHealth: checkGoogleCalendarConnection,
  };
}

