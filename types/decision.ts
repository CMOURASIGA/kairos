export type DecisionStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";

export type Decision = {
  id: string;
  userId: string;
  title: string;
  context: string;
  reason: string;
  impact: string;
  status: DecisionStatus;
  projectId: string | null;
  createdAt: string;
};

export type CreateDecisionInput = {
  userId: string;
  title: string;
  context?: string;
  reason?: string;
  impact?: string;
  status?: DecisionStatus;
  projectId?: string | null;
};
