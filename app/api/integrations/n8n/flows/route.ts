import { NextRequest, NextResponse } from "next/server";
import {
  N8nIntegrationError,
  listN8nExecutionRecords,
  listN8nWorkflows,
  triggerN8nFlow,
} from "@/services/integrations/n8n-service";
import { logIntegrationEvent } from "@/services/integrations/logger";
import { requireApiAuth } from "@/lib/api-auth";

type TriggerPayload = {
  workflowId: string;
  payload?: unknown;
  source?: "api" | "webhook";
  webhookPath?: string;
};

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function validateTriggerPayload(body: TriggerPayload): string | null {
  if (!body.workflowId?.trim()) return "Campo 'workflowId' obrigatorio.";
  if (body.source !== undefined && body.source !== "api" && body.source !== "webhook") {
    return "Campo 'source' invalido. Use 'api' ou 'webhook'.";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = parsePositiveInt(searchParams.get("limit"), 20);
    const executionLimit = parsePositiveInt(searchParams.get("executionLimit"), 20);
    const includeExecutions = searchParams.get("includeExecutions") !== "false";

    const workflows = await listN8nWorkflows(limit);
    const executions = includeExecutions ? listN8nExecutionRecords(executionLimit) : [];

    return NextResponse.json({
      data: {
        workflows,
        executions,
      },
      meta: {
        workflowsCount: workflows.length,
        executionsCount: executions.length,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof N8nIntegrationError) {
      logIntegrationEvent({
        integrationId: "n8n",
        level: "warn",
        message: "Falha controlada ao listar fluxos n8n.",
        metadata: {
          statusCode: error.statusCode,
        },
      });
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("[/api/integrations/n8n/flows] GET error", error);
    logIntegrationEvent({
      integrationId: "n8n",
      level: "error",
      message: "Falha inesperada ao listar fluxos n8n.",
    });
    return NextResponse.json({ error: "Erro inesperado ao listar fluxos n8n." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as TriggerPayload;
    const validationError = validateTriggerPayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const execution = await triggerN8nFlow({
      workflowId: body.workflowId.trim(),
      payload: body.payload,
      source: body.source ?? "api",
      webhookPath: body.webhookPath?.trim(),
    });

    return NextResponse.json({ data: execution }, { status: 201 });
  } catch (error) {
    if (error instanceof N8nIntegrationError) {
      logIntegrationEvent({
        integrationId: "n8n",
        level: "warn",
        message: "Falha controlada ao acionar fluxo n8n.",
        metadata: {
          statusCode: error.statusCode,
        },
      });
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("[/api/integrations/n8n/flows] POST error", error);
    logIntegrationEvent({
      integrationId: "n8n",
      level: "error",
      message: "Falha inesperada ao acionar fluxo n8n.",
    });
    return NextResponse.json({ error: "Erro inesperado ao acionar fluxo n8n." }, { status: 500 });
  }
}
