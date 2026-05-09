import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { createDecision, listDecisions } from "@/services/decision-service";
import { DecisionStatus } from "@/types/decision";

type DecisionPayload = {
  title: string;
  context?: string;
  reason?: string;
  impact?: string;
  status?: DecisionStatus;
  projectId?: string | null;
};

function validateStatus(status?: string): status is DecisionStatus {
  return status === undefined || ["aberta", "em_andamento", "concluida", "cancelada"].includes(status);
}

function validatePayload(payload: DecisionPayload): string | null {
  if (!payload.title?.trim()) return "Campo 'title' obrigatorio.";
  if (payload.title.trim().length > 180) return "Campo 'title' excedeu limite.";
  if (!validateStatus(payload.status)) return "Status invalido.";
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const decisions = await listDecisions(auth.context.userId);
    return NextResponse.json({ data: decisions });
  } catch (error) {
    console.error("[/api/decisions] GET error", error);
    return NextResponse.json({ error: "Erro ao listar decisoes." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as DecisionPayload;
    const validationError = validatePayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const decision = await createDecision({
      userId: auth.context.userId,
      title: body.title.trim(),
      context: body.context?.trim(),
      reason: body.reason?.trim(),
      impact: body.impact?.trim(),
      status: body.status,
      projectId: body.projectId,
    });

    return NextResponse.json({ data: decision }, { status: 201 });
  } catch (error) {
    console.error("[/api/decisions] POST error", error);
    return NextResponse.json({ error: "Erro ao criar decisao." }, { status: 500 });
  }
}
