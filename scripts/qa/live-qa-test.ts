import { loadEnvConfig } from "@next/env";
import crypto from "crypto";

loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");
  const { completeOnboarding } = await import("@/lib/chat/completeOnboarding");
  const {
    ensureStorageBucket,
    insertUploadedFile,
    insertDocumentSource,
    uploadFileToStorage
  } = await import("@/lib/data/fileRepository");
  const { getSessionDocumentNamespace, ingestDocumentToPinecone } = await import(
    "@/lib/langchain/ingestDocumentToPinecone"
  );

  console.log("==================================================");
  console.log("🚀 STARTING LIVE CONVERSATIONAL QA TEST SIMULATION");
  console.log("==================================================");

  // 1. Start Session
  const session = await startSession();
  const sessionId = session.id;
  console.log(`\n[STEP 1] Session Created!`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Initial Bot Greeting: \n"${session.openingMessage}"`);
  console.log(`--------------------------------------------------`);

  const chatTranscript: Array<{ role: string; content: string }> = [
    { role: "assistant", content: session.openingMessage }
  ];

  // Helper to send message and log
  async function sendMessage(userText: string) {
    console.log(`\n👤 User: "${userText}"`);
    chatTranscript.push({ role: "user", content: userText });
    
    const response = await handleMessage(sessionId, userText);
    console.log(`🤖 Bot: "${response.message}"`);
    console.log(`📈 Progress Score: ${response.completionScore}%`);
    console.log(`⚠️ Missing Fields: [${response.missingFields.join(", ")}]`);
    console.log(`✅ Collected Fields: [${response.collectedFields.join(", ")}]`);
    console.log(`🏷️ Onboarding State: ${response.status} (${response.statusLabel})`);
    console.log(`--------------------------------------------------`);
    
    chatTranscript.push({ role: "assistant", content: response.message });
    return response;
  }

  // 2. User introduces themselves and shares core details
  await sendMessage(
    "Hello! My name is Alex, my email is alex@apexmortgage.com, my phone is 555-0199, and I am from Apex Mortgage. We need Mortgage Automation."
  );

  // 3. User responds to dynamic onboarding questions (Encompass focus)
  await sendMessage(
    "We use Encompass LOS. Our workflow is manual loan status sync which takes 4 hours daily. Main pain point is delay in updating loan officers."
  );

  // 4. Ask a general company service question (Website RAG)
  await sendMessage(
    "How does your Encompass Integration work? Do you have experience with it?"
  );

  // 5. Simulate File Upload (apex-requirements.txt)
  console.log(`\n[STEP 5] Simulating Upload of "apex-requirements.txt"...`);
  const fileContent = `Apex Mortgage Integration Requirements:
  - Connect Encompass status changes to Salesforce CRM.
  - Custom rules: Sync must trigger exception alerts to tech-support@apexmortgage.com.
  - Project budget is set at $45,000.
  - Project timeline goal is August 2026.`;
  
  const buffer = Buffer.from(fileContent);
  const originalName = "apex-requirements.txt";
  const contentType = "text/plain";
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const bucket = "client-uploads";
  const storagePath = `${sessionId}/${crypto.randomUUID()}-${originalName}`;

  await ensureStorageBucket(bucket);
  await uploadFileToStorage({ bucket, path: storagePath, buffer, contentType });
  
  const uploadedFile = await insertUploadedFile({
    sessionId,
    storageBucket: bucket,
    storagePath,
    originalName,
    mimeType: contentType,
    sizeBytes: buffer.length,
    fileKind: "document",
    extractedText: fileContent,
    metadata: { contentHash, readable: true }
  });

  const documentSource = await insertDocumentSource({
    uploadedFileId: uploadedFile.id,
    sessionId,
    title: originalName,
    extractedText: fileContent,
    contentHash,
    pineconeNamespace: await getSessionDocumentNamespace(sessionId)
  });

  const ingestResult = await ingestDocumentToPinecone(documentSource);
  console.log(`✅ File indexed in Pinecone namespace: "${documentSource.pinecone_namespace}"`);
  console.log(`   Chunks Created: ${ingestResult.chunksCreated}, Vectors Upserted: ${ingestResult.vectorsUpserted}`);
  console.log(`--------------------------------------------------`);

  // 6. Query the document RAG to verify dynamic context parsing
  await sendMessage(
    "I just uploaded our requirements document. Tell me, what is the tech support email and project budget listed in it?"
  );

  // 7. Complete Onboarding (Triggers Brief generation and Google Drive push)
  console.log(`\n[STEP 7] Simulating Onboarding Completion...`);
  const completionResult = await completeOnboarding(sessionId);
  console.log(`🎉 Completion Call Successful!`);
  console.log(`📜 Brief Title: "${completionResult.brief.title}"`);
  console.log(`📂 Google Drive Status: ${completionResult.drive.status}`);
  if (completionResult.drive.status === "uploaded") {
    console.log(`🔗 Web View Link: ${completionResult.drive.webViewLink}`);
  }
  console.log(`==================================================`);
  console.log("✅ CONVERSATIONAL QA TEST SIMULATION COMPLETED successfully!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ QA Simulation failed with error:", error);
  process.exit(1);
});
