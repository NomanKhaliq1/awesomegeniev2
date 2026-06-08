import { NextResponse } from "next/server";
import { listServiceCategories } from "@/lib/data/configRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  const serviceCategories = await listServiceCategories();

  return NextResponse.json({
    serviceCategories
  });
}
