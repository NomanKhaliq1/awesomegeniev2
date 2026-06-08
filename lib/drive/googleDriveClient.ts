import { google } from "googleapis";
import { env } from "@/lib/env";

const driveScope = "https://www.googleapis.com/auth/drive";

export function isGoogleDriveConfigured() {
  return Boolean(env.GOOGLE_DRIVE_ROOT_FOLDER_ID && (isGoogleOAuthConfigured() || isServiceAccountConfigured()));
}

export function getGoogleDriveRootFolderId() {
  if (!env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured.");
  }

  return env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
}

export function createGoogleDriveClient() {
  if (isGoogleOAuthConfigured()) {
    const auth = createGoogleOAuthClient();

    auth.setCredentials({
      refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN
    });

    return google.drive({
      version: "v3",
      auth
    });
  }

  if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Google Drive credentials are not configured.");
  }

  const auth = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: normalizePrivateKey(env.GOOGLE_PRIVATE_KEY),
    scopes: [driveScope]
  });

  return google.drive({
    version: "v3",
    auth
  });
}

export function createGoogleOAuthClient() {
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REDIRECT_URI
  ) {
    throw new Error("Google OAuth client credentials are not configured.");
  }

  return new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

export function getGoogleOAuthConsentUrl() {
  return createGoogleOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [driveScope]
  });
}

export function isGoogleOAuthConfigured() {
  return Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID &&
      env.GOOGLE_OAUTH_CLIENT_SECRET &&
      env.GOOGLE_OAUTH_REDIRECT_URI &&
      env.GOOGLE_OAUTH_REFRESH_TOKEN
  );
}

function isServiceAccountConfigured() {
  return Boolean(env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY);
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n");
}
