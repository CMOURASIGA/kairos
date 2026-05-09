import { NextRequest, NextResponse } from "next/server";
import {
  AzureDevOpsIntegrationError,
  listAzureDevOpsProjects,
  listAzureDevOpsWorkItems,
} from "@/services/integrations/azure-devops-service";
import { logIntegrationEvent } from "@/services/integrations/logger";
import { requireApiAuth } from "@/lib/api-auth";

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(raw: string | null, fallback: boolean): boolean {
  if (!raw) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = parsePositiveInt(searchParams.get("limit"), 10);
    const project = searchParams.get("project")?.trim() || undefined;
    const onlyOpen = parseBoolean(searchParams.get("onlyOpen"), true);
    const includeProjects = parseBoolean(searchParams.get("includeProjects"), true);

    const [workItems, projects] = await Promise.all([
      listAzureDevOpsWorkItems({ project, limit, onlyOpen }),
      includeProjects ? listAzureDevOpsProjects() : Promise.resolve([]),
    ]);

    return NextResponse.json({
      data: {
        workItems,
        projects,
      },
      meta: {
        workItemsCount: workItems.length,
        projectsCount: projects.length,
        onlyOpen,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof AzureDevOpsIntegrationError) {
      logIntegrationEvent({
        integrationId: "azure_devops",
        level: "warn",
        message: "Falha controlada ao consultar contexto do Azure DevOps.",
        metadata: {
          statusCode: error.statusCode,
        },
      });

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: error.statusCode },
      );
    }

    console.error("[/api/integrations/azure-devops/work-items] GET error", error);
    logIntegrationEvent({
      integrationId: "azure_devops",
      level: "error",
      message: "Falha inesperada ao consultar Azure DevOps.",
    });

    return NextResponse.json(
      {
        error: "Erro inesperado ao consultar dados do Azure DevOps.",
      },
      { status: 500 },
    );
  }
}
