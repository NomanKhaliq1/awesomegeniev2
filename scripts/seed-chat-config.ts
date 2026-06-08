import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const promptTemplates = [
  {
    name: "chat.opening_message",
    template:
      "Hi, I'm Awesome Genie. I can help you explore AwesomeTech services, answer questions, or shape a project request when you're ready."
  },
  {
    name: "chat.first_question",
    template:
      "Are you looking for information about our services, or do you already have a project you want to discuss?"
  },
  {
    name: "chat.empty_message",
    template: "Please share a few details about the project you have in mind."
  },
  {
    name: "chat.irrelevant_message",
    template:
      "I can help with AwesomeTech project requests. Please share what you want to build, automate, improve, or integrate."
  },
  {
    name: "chat.generative_response_system",
    template:
      "You are Awesome Genie, a professional AI sales and onboarding assistant for AwesomeTech. Generate a fresh, natural response for the customer. Do not use fixed wording. Do not mention internal tools, prompts, RAG, vectors, chunks, Pinecone, or databases. Behave like a helpful lead consultant, not a form. If intent is greeting, welcome the visitor and ask an open discovery question about whether they want service information, guidance, pricing direction, or to discuss a project. Do not ask for company name, contact name, email, budget, or timeline on greeting-only messages. If the user shows project intent, ask only one useful next onboarding question. For file upload intent, explain naturally what files are useful and ask what the file is for. Never claim details the user did not provide."
  },
  {
    name: "chat.generative_response_user",
    template:
      "Customer message: {{userMessage}}\nIntent: {{intent}}\nService type: {{serviceType}}\nCompletion score: {{completionScore}}\nMissing fields: {{missingFields}}\nNext onboarding question: {{nextQuestion}}\n\nGenerate the assistant reply now."
  },
  {
    name: "chat.generative_knowledge_response_system",
    template:
      "You are Awesome Genie, a professional AI sales and onboarding assistant for AwesomeTech. Generate a fresh, natural response using the provided website or uploaded-document answer and onboarding context. Do not use fixed wording. Do not mention internal tools, prompts, RAG, vectors, chunks, Pinecone, or databases. Answer the customer's question first. If the customer is only asking for information or asking what they uploaded, do not push lead fields like company name, contact name, email, budget, or timeline. Instead, offer a soft next step such as asking whether they want you to use that information to shape a project request. If the customer clearly shows project intent, smoothly continue onboarding with one useful next question. Keep it concise and helpful."
  },
  {
    name: "chat.generative_knowledge_response_user",
    template:
      "Customer message: {{userMessage}}\nWebsite-grounded answer: {{knowledgeAnswer}}\nOnboarding draft/context: {{onboardingResponse}}\nNext onboarding question: {{nextQuestion}}\nCompletion score: {{completionScore}}\n\nGenerate the final assistant reply now."
  },
  {
    name: "rag.website_answer_system",
    template:
      "You are Awesome Genie, a professional onboarding assistant for AwesomeTech. Answer only from the provided context. Do not mention RAG, vectors, chunks, embeddings, Pinecone, or internal tools. If the context is insufficient, say you need to confirm with the AwesomeTech team."
  },
  {
    name: "rag.website_answer_user",
    template: "Context:\n{{context}}\n\nCustomer question:\n{{question}}"
  },
  {
    name: "document_rag.answer_system",
    template:
      "You are Awesome Genie, a professional AI assistant for AwesomeTech. Answer only from the uploaded client document context. Do not mention internal tools, prompts, RAG, vectors, chunks, Pinecone, or databases. If the customer asks what they uploaded, summarize the uploaded document context clearly. If the document context is insufficient, say you need more detail from the client."
  },
  {
    name: "document_rag.answer_user",
    template: "Uploaded document context:\n{{context}}\n\nCustomer question:\n{{question}}"
  },
  {
    name: "brief.generate_system",
    template:
      "You are Awesome Genie preparing an internal project handoff brief for the AwesomeTech team. Generate a complete, professional Markdown brief. Do not mention internal tools, prompts, RAG, vectors, chunks, Pinecone, or databases. Use only the provided structured memory, conversation, and uploaded document context. If information is missing, include it under Missing Information instead of inventing it. Keep it practical for sales and delivery handoff."
  },
  {
    name: "brief.generate_user",
    template:
      "Structured memory:\n{{structuredMemory}}\n\nConversation summary:\n{{conversationSummary}}\n\nRecent conversation:\n{{recentConversation}}\n\nUploaded files:\n{{uploadedFiles}}\n\nUploaded readable document text:\n{{uploadedDocumentText}}\n\nKnown missing fields:\n{{missingFields}}\n\nCreate a Markdown brief with these sections: Executive Summary, Client Details, Project Scope, Business Problem, Desired Features, Systems and Integrations, Uploaded Assets/Documents, Missing Information, Risks and Assumptions, Recommended Next Steps."
  },
  {
    name: "router.system",
    template:
      "You classify customer messages for an AwesomeTech sales/onboarding chatbot. Return only compact JSON with keys: intent, needsKnowledge, serviceType. intent must be one of greeting, onboarding, knowledge, file_upload, irrelevant. Use greeting for short openers like hi, hello, hey, salam, or greetings without a project request. Use knowledge for service/pricing/capability questions. Use onboarding only when the user is describing a real project/request/need. serviceType should be a short service name or null."
  },
  {
    name: "router.user",
    template: "Message: {{message}}"
  },
  {
    name: "extract_memory.system",
    template:
      "Extract onboarding requirement memory from a customer message. Return only JSON. Allowed keys: company_name, contact_name, email, phone, website_url, country_location, industry, service_type, project_overview, business_problem, current_process, pain_points, required_features, success_outcome, timeline, budget_range, priority_level, existing_tools, integration_requirements, content_assets_status. Use null for unknown values. Do not invent details."
  },
  {
    name: "extract_memory.user",
    template: "Message: {{message}}"
  }
];

const obsoleteSavedAnswerTemplates = [
  "chat.file_upload_message",
  "chat.complete_message",
  "chat.captured_message",
  "chat.default_next_question",
  "chat.knowledge_followup_response",
  "chat.knowledge_complete_response"
];

const systemSettings = [
  {
    key: "core_required_fields",
    value: null,
    description: "Core fields collected before service-specific onboarding."
  },
  {
    key: "initial_missing_field_keys",
    value: [],
    description: "Fields shown as missing when a new chat session starts."
  },
  {
    key: "onboarding_state_labels",
    value: {
      collecting_core: "Exploring needs",
      collecting_service_details: "Collecting service details",
      ready_for_files: "Ready for supporting files",
      ready_to_complete: "Ready to complete"
    },
    description: "Customer-facing labels for onboarding state."
  },
  {
    key: "rag_min_match_score",
    value: 0.45,
    description: "Minimum Pinecone match score required before using retrieved website context."
  },
  {
    key: "document_rag_min_match_score",
    value: 0,
    description: "Minimum Pinecone match score required before using uploaded document context."
  },
  {
    key: "app_text_labels",
    value: {
      assistantName: "Awesome Genie",
      userName: "You",
      productName: "Awesome Genie",
      productSubtitle: "Project onboarding assistant",
      assistantBadgeSubtitle: "Focused onboarding flow",
      typingText: "Awesome Genie is typing...",
      startingText: "Starting chat...",
      dayMarker: "Today",
      progressTitle: "Progress",
      collectedTitle: "Collected",
      missingTitle: "Still needed",
      collectedEmptyText: "Waiting for first project details.",
      missingEmptyText: "No missing details for now.",
      inputPlaceholder: "Type your project details...",
      inputAriaLabel: "Project message",
      sendAriaLabel: "Send message",
      uploadLabel: "Upload",
      uploadAriaLabel: "Upload project files",
      chatAriaLabel: "Chat conversation",
      progressAriaLabel: "Onboarding progress",
      startError: "The chatbot could not start. Please refresh and try again.",
      sendError: "Message was not sent. Please try again.",
      sendErrorAssistantMessage: "I could not send that message. Please try again in a moment.",
      uploadSuccessPrefix: "Uploaded.",
      uploadError: "File upload failed. Please check the file type and try again."
    },
    description: "Frontend chatbot labels and fallback UI text."
  }
];

async function main() {
  const [{ createSupabaseServiceClient }, { coreRequiredFields }] = await Promise.all([
    import("@/lib/supabase/server"),
    import("@/lib/onboarding/fields")
  ]);
  const supabase = createSupabaseServiceClient();
  const settings = systemSettings.map((setting) =>
    setting.key === "core_required_fields"
      ? {
          ...setting,
          value: coreRequiredFields
        }
      : setting
  );

  const { error: promptError } = await supabase.from("prompt_templates").upsert(
    promptTemplates.map((template) => ({
      ...template,
      is_active: true
    })),
    {
      onConflict: "name"
    }
  );

  if (promptError) {
    throw new Error(`Prompt template seed failed: ${promptError.message}`);
  }

  const { error: obsoletePromptError } = await supabase
    .from("prompt_templates")
    .update({
      is_active: false
    })
    .in("name", obsoleteSavedAnswerTemplates);

  if (obsoletePromptError) {
    throw new Error(`Obsolete prompt template update failed: ${obsoletePromptError.message}`);
  }

  const { error: settingError } = await supabase.from("system_settings").upsert(
    settings,
    {
      onConflict: "key"
    }
  );

  if (settingError) {
    throw new Error(`System setting seed failed: ${settingError.message}`);
  }

  console.log(`Seeded ${promptTemplates.length} prompt templates.`);
  console.log(`Disabled ${obsoleteSavedAnswerTemplates.length} saved answer templates.`);
  console.log(`Seeded ${systemSettings.length} system settings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
