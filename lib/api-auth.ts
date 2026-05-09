import { NextRequest, NextResponse } from "next/server";
import { getDefaultUserId } from "@/lib/user-context";

const USER_ID_HEADER = "x-kairos-user-id";
const API_KEY_HEADER = "x-kairos-api-key";
const AUTHORIZATION_HEADER = "authorization";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeHeaderValue(value: string | null): string {
  return value?.trim() ?? "";
}

function extractApiKeyFromRequest(request: NextRequest): string {
  const direct = normalizeHeaderValue(request.headers.get(API_KEY_HEADER));
  if (direct) return direct;

  const authorization = normalizeHeaderValue(request.headers.get(AUTHORIZATION_HEADER));
  if (!authorization) return "";

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return "";
  if (scheme.toLowerCase() !== "bearer") return "";
  return token.trim();
}

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export type AuthenticatedRequestContext = {
  userId: string;
};

export function requireApiAuth(request: NextRequest): {
  ok: true;
  context: AuthenticatedRequestContext;
} | {
  ok: false;
  response: NextResponse;
} {
  const configuredApiKey = normalizeHeaderValue(process.env.KAIROS_API_KEY ?? "");
  const requestApiKey = extractApiKeyFromRequest(request);

  if (configuredApiKey && requestApiKey !== configuredApiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Nao autorizado. Informe uma chave valida em 'x-kairos-api-key' ou 'Authorization: Bearer <token>'.",
        },
        { status: 401 },
      ),
    };
  }

  const requestedUserId = normalizeHeaderValue(request.headers.get(USER_ID_HEADER));
  if (requestedUserId && !isValidUuid(requestedUserId)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Header '${USER_ID_HEADER}' invalido. Informe um UUID no formato padrao.`,
        },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId: requestedUserId || getDefaultUserId(),
    },
  };
}

