import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createGoogleOAuthClient } from "@/lib/drive/googleDriveClient";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return htmlResponse(`Google OAuth failed: ${escapeHtml(error)}`, 400);
  }

  if (!code) {
    return htmlResponse("Google OAuth callback did not include a code.", 400);
  }

  try {
    const oauthClient = createGoogleOAuthClient();
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.refresh_token) {
      return htmlResponse(
        [
          "Google did not return a refresh token.",
          "Open /api/google/oauth/start again and make sure consent is approved."
        ].join("<br>")
      );
    }

    writeRefreshToken(tokens.refresh_token);

    return htmlResponse(
      [
        "Google Drive OAuth refresh token saved to .env.local.",
        "Restart the Next.js dev server, then run:",
        "<code>npm run drive:check</code>"
      ].join("<br>")
    );
  } catch (callbackError) {
    console.error("Google OAuth callback failed:", callbackError);
    const message =
      callbackError instanceof Error ? callbackError.message : "Unknown OAuth callback error.";

    return htmlResponse(`Google OAuth callback failed: ${escapeHtml(message)}`, 500);
  }
}

function writeRefreshToken(refreshToken: string) {
  const envPath = path.join(process.cwd(), ".env.local");
  const line = `GOOGLE_OAUTH_REFRESH_TOKEN="${refreshToken}"`;
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (/^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m.test(envContent)) {
    envContent = envContent.replace(/^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m, line);
  } else {
    envContent += `${envContent.endsWith("\n") ? "" : "\n"}${line}\n`;
  }

  fs.writeFileSync(envPath, envContent);
}

function htmlResponse(body: string, status = 200) {
  return new NextResponse(
    [
      "<!doctype html>",
      "<html>",
      "<head><title>Google OAuth</title></head>",
      "<body style=\"font-family: Arial, sans-serif; line-height: 1.5; padding: 32px;\">",
      `<p>${body}</p>`,
      "</body>",
      "</html>"
    ].join(""),
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    }
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
