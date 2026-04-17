import type { NextRequest } from "next/server";
import { getNeonAuth, isNeonAuthConfigured } from "../../../../lib/neon-auth";

type RouteContext = { params: Promise<{ all: string[] }> };

function adaptParams(context: RouteContext) {
  return {
    params: context.params.then(({ all }) => ({ path: all })),
  };
}

async function proxy(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if (!isNeonAuthConfigured()) {
    return new Response("Neon Auth is not configured.", { status: 503 });
  }
  const handlers = getNeonAuth().handler();
  return handlers[method](request, adaptParams(context));
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy("GET", request, context);
}
export function POST(request: NextRequest, context: RouteContext) {
  return proxy("POST", request, context);
}
export function PUT(request: NextRequest, context: RouteContext) {
  return proxy("PUT", request, context);
}
export function DELETE(request: NextRequest, context: RouteContext) {
  return proxy("DELETE", request, context);
}
export function PATCH(request: NextRequest, context: RouteContext) {
  return proxy("PATCH", request, context);
}
