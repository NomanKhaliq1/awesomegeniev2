import { NextResponse } from "next/server";
import { getGoogleOAuthConsentUrl } from "@/lib/drive/googleDriveClient";

export async function GET() {
  try {
    return NextResponse.redirect(getGoogleOAuthConsentUrl());
  } catch (error) {
    console.error("Google OAuth start failed:", error);
    return NextResponse.json(
      { error: "Google OAuth is not configured." },
      { status: 500 }
    );
  }
}
