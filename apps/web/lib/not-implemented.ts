import { NextResponse } from "next/server";

export function notImplemented(feature: string) {
  return NextResponse.json(
    {
      ok: false,
      feature,
      message: `${feature} is not implemented yet.`,
    },
    { status: 501 },
  );
}
