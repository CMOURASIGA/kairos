import { NextResponse } from "next/server";
import { validatePublicEnv, validateServerEnv } from "@/lib/env";

export async function GET() {
  const missingPublic = validatePublicEnv();
  const missingServer = validateServerEnv();

  return NextResponse.json({
    ready: missingServer.length === 0,
    publicEnv: {
      ready: missingPublic.length === 0,
      missing: missingPublic,
    },
    serverEnv: {
      ready: missingServer.length === 0,
      missing: missingServer,
    },
  });
}
