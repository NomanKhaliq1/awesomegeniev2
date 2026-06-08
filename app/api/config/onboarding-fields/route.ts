import { NextRequest, NextResponse } from "next/server";
import { listOnboardingFields } from "@/lib/data/configRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const service = request.nextUrl.searchParams.get("service") ?? undefined;
  const onboardingFields = await listOnboardingFields(service);

  return NextResponse.json({
    onboardingFields
  });
}
