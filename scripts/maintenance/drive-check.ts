import { loadEnvConfig } from "@next/env";
import { Readable } from "stream";

loadEnvConfig(process.cwd());

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n");
}

function maskEmail(email?: string) {
  if (!email) return "(missing)";
  const [name, domain] = email.split("@");

  if (!domain) return "(configured)";

  return `${name.slice(0, 3)}***@${domain}`;
}

async function main() {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  const hasOAuth = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );

  console.log("Google Drive credential check");
  console.log(`- root folder id: ${rootFolderId ? "(configured)" : "(missing)"}`);
  console.log(`- OAuth refresh token: ${hasOAuth ? "(configured)" : "(missing)"}`);
  console.log(`- service account email: ${maskEmail(process.env.GOOGLE_CLIENT_EMAIL)}`);

  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is missing.");
  }

  const { google } = await import("googleapis");
  const hasServiceAccount = Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
  const auth = hasOAuth ? createOAuthAuth(google) : (hasServiceAccount ? createServiceAccountAuth(google) : undefined);
  if (!auth) {
    throw new Error("No Google OAuth or service account credentials configured.");
  }
  const drive = google.drive({
    version: "v3",
    auth
  });
  const folder = await drive.files.get({
    fileId: rootFolderId,
    fields: "id,name,mimeType,driveId",
    supportsAllDrives: true
  });

  if (folder.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID does not point to a Google Drive folder.");
  }

  console.log(`Drive root folder access verified: ${folder.data.name ?? folder.data.id}`);

  if (folder.data.driveId) {
    console.log("Drive root is inside a Shared Drive.");
  } else {
    console.log("Drive root is inside My Drive.");
  }

  const tempName = `awesome-genie-write-check-${Date.now()}.txt`;
  const tempFile = await drive.files.create({
    requestBody: {
      name: tempName,
      parents: [rootFolderId],
      mimeType: "text/plain"
    },
    media: {
      mimeType: "text/plain",
      body: Readable.from(["Awesome Genie Drive write check"])
    },
    fields: "id",
    supportsAllDrives: true
  });

  if (!tempFile.data.id) {
    throw new Error("Drive write check did not return a file ID.");
  }

  await drive.files.delete({
    fileId: tempFile.data.id,
    supportsAllDrives: true
  });

  console.log("Drive write/delete access verified.");
}

function createOAuthAuth(google: typeof import("googleapis").google) {
  if (
    !process.env.GOOGLE_OAUTH_CLIENT_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    !process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    throw new Error("Google OAuth credentials are incomplete.");
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  });

  return auth;
}

function createServiceAccountAuth(google: typeof import("googleapis").google) {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  console.log(`- private key: ${privateKey ? "(configured)" : "(missing)"}`);

  if (!email || !privateKey) {
    throw new Error("No complete Google OAuth or service-account credentials were found.");
  }

  const normalizedKey = normalizePrivateKey(privateKey);
  const hasPemHeader = normalizedKey.startsWith("-----BEGIN PRIVATE KEY-----");
  const hasPemFooter = normalizedKey.trimEnd().endsWith("-----END PRIVATE KEY-----");

  console.log(`- PEM header: ${hasPemHeader ? "yes" : "no"}`);
  console.log(`- PEM footer: ${hasPemFooter ? "yes" : "no"}`);
  console.log(`- key length: ${privateKey.length}`);

  if (!hasPemHeader || !hasPemFooter) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is not a full PEM private key. Replace it with the service-account private_key value."
    );
  }

  return new google.auth.JWT({
    email,
    key: normalizedKey,
    scopes: ["https://www.googleapis.com/auth/drive"]
  });
}

main().catch((error) => {
  console.error("Drive check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
