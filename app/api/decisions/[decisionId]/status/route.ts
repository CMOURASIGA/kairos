import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { updateDecisionStatus } from "@/services/decision-service";
import { DecisionStatus } from "@/types/decision";

type RouteContext = {
  params: Promise<{
    decisionId: string;
  }>;
};

type UpdateStatusPayload = {
  status: DecisionStatus;
};

function isValidStatus(status: string): status is DecisionStatus {
  return ["aberta", "em_andamento", "concluida", "cancelada"].includes(status);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireApiAuth(request);
    if (!auth.ok) return auth.response;

    const { decisionId } = await context.params;
    if (!decisionId?.trim()) {
      return NextResponse.json({ error: "decisionId obrigatorio." }, { status: 400 });
    }

    const body = (await request.json()) as UpdateStatusPayload;
    if (!body?.status || !isValidStatus(body.status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const updated = await updateDecisionStatus({
      userId: auth.context.userId,
      decisionId,
      status: body.status,
    });

    if (!updated) {
      return NextResponse.json({ error: "Decisao nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[/api/decisions/:id/status] PATCH error", error);
    return NextResponse.json({ error: "Erro ao atualizar status da decisao." }, { status: 500 });
  }
}
