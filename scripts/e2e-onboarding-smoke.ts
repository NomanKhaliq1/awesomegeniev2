import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function postJson<T>(path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const json = (await response.json().catch(() => null)) as T;

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function main() {
  const start = await postJson<{
    session: { id: string };
    message: string;
    firstQuestion: string;
  }>("/api/chat/start");

  if (!start.session?.id) {
    throw new Error("Chat start did not return a session id.");
  }

  const sessionId = start.session.id;

  const greeting = await postJson<{ message: string }>(
    "/api/chat/message",
    {
      sessionId,
      message: "Hi"
    }
  );

  const greetingText = greeting.message ?? "";

  if (!greetingText || /company name/i.test(greetingText)) {
    throw new Error("Greeting flow is too form-like or empty.");
  }

  await postJson("/api/chat/message", {
    sessionId,
    message:
      "I am exploring a mortgage automation project. We use Encompass and want to reduce manual loan file checks."
  });

  const formData = new FormData();
  formData.append("sessionId", sessionId);
  formData.append(
    "files",
    new Blob(
      [
        "Sample project notes: The client needs Encompass workflow automation, document checklist validation, and a weekly exception report."
      ],
      { type: "text/plain" }
    ),
    "project-notes.txt"
  );

  const uploadResponse = await fetch(`${baseUrl}/api/chat/upload`, {
    method: "POST",
    body: formData
  });
  const upload = await uploadResponse.json().catch(() => null);

  if (!uploadResponse.ok) {
    throw new Error(`upload failed with ${uploadResponse.status}: ${JSON.stringify(upload)}`);
  }

  if (!Array.isArray(upload?.uploaded) || upload.uploaded.length === 0) {
    throw new Error("Upload did not return uploaded file metadata.");
  }

  const docAnswer = await postJson<{ message: string }>(
    "/api/chat/message",
    {
      sessionId,
      message: "What did I upload?"
    }
  );

  if (!/encompass|workflow|document|checklist|report/i.test(docAnswer.message)) {
    throw new Error("Uploaded document context was not used in chat answer.");
  }

  const complete = await postJson<{
    brief?: { id: string; contentMarkdown: string };
    drive?: { status: string };
  }>("/api/chat/complete", { sessionId });

  if (!complete.brief?.id || !complete.brief.contentMarkdown) {
    throw new Error("Completion did not generate a project brief.");
  }

  console.log("E2E onboarding smoke passed.");
  console.log(`Session: ${sessionId}`);
  console.log(`Drive status: ${complete.drive?.status ?? "not returned"}`);
}

main().catch((error) => {
  console.error("E2E onboarding smoke failed:", error);
  process.exit(1);
});
