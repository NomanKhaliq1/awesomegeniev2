# Awesome Genie – Full-Screen AI Onboarding Chatbot

**Project:** Awesome Genie  
**Company:** AwesomeTech  
**Version:** Clean rebuild plan  
**Main requirement:** Full-screen chatbot only. No dashboard. No CRM. No admin panel in first production version.

---

## 1. Project Goal

Awesome Genie will be a **full-screen AI onboarding chatbot** for AwesomeTech.

The chatbot will:

- Answer AwesomeTech service questions using proper RAG
- Collect complete client project requirements
- Ask dynamic onboarding questions
- Accept uploaded files, documents, images, logos, screenshots, PDFs, Word files, Excel files, ZIP files, and other assets
- Process readable documents
- Use uploaded documents as context when generating the final brief
- Generate a full project brief
- Create a Google Drive handoff folder
- Upload all collected files and generated documents to Google Drive
- Store chat history, requirements, files, and logs in Supabase
- Use Pinecone as the vector database
- Use LangChain for proper RAG flow

This project is **not** a dashboard project.

The only user-facing product is:

```txt
Full-screen Awesome Genie chatbot
```

---

## 2. What This Project Is Not

Do not build:

```txt
Admin dashboard
PM dashboard
Client list page
CRM pipeline
Analytics dashboard
AI cost dashboard UI
Knowledge viewer UI
Theme settings dashboard
Role management screens
Large internal panel
```

Backend logs and records can exist in Supabase, but no dashboard UI is needed in the first version.

---

## 3. Final App Pages

Only these frontend pages are required:

```txt
/chat
/thank-you
/error
```

Main route:

```txt
/chat
```

The `/chat` page must be a full-screen chatbot interface.

---

## 4. Full-Screen Chatbot UI

The chatbot should look like a clean, professional SaaS assistant.

### Layout

```txt
Header
  - Logo
  - Awesome Genie name
  - Short helper line

Main area
  - Chat conversation

Optional right-side or inline progress panel
  - Project type
  - Completion score
  - Collected details
  - Uploaded files
  - Missing information

Bottom
  - Message input
  - File upload button
  - Send button
```

The progress panel is optional, but if implemented, it must stay inside the full-screen chatbot page. It must not become a separate dashboard.

---

## 5. UI Theme

Use a clean light theme with a clear AwesomeTech brand identity.

The theme must not look like a single-color pink UI. The main visible brand color is red.

### Colors

```txt
Primary Brand Red: #B5212F
White: #FFFFFF
Very Light Pink/Rose Accent: #FAF0F1
Dark Text: near black
Soft Borders: light gray/pink
```

Usage:

```txt
Main background: #FFFFFF
Primary brand identity: #B5212F red
Header brand accents: #B5212F
Primary send button: #B5212F
Muted send button states: soft/muted red-pink variants
Soft section background accents: very light pink/rose
Chat body: #FFFFFF
Chat bubbles: #FFFFFF / very light pink or rose accents
Cards: #FFFFFF
Borders: soft gray/pink
Text: dark readable near-black color
```

Avoid:

```txt
Dark theme
Heavy gradients
Flashy colors
Dark sidebar
Complex admin-style UI
UI dominated only by pale pink
Weak brand identity where #B5212F is not visibly used
```

---

## 6. Font

Use Lato globally.

```css
font-family: "Lato", sans-serif;
```

Apply it to:

```txt
Chat UI
Inputs
Buttons
Progress panel
File upload area
Final summary screen
Error/thank-you pages
```

---

## 7. Logo Handling

The logo will be placed manually in the project root or public folder.

The app should automatically pick the logo without hardcoding an external URL.

### Preferred logo locations

Check in this order:

```txt
/public/logo.svg
/public/logo.png
/public/awesome-genie-logo.svg
/public/awesome-genie-logo.png
/logo.svg
/logo.png
/awesome-genie-logo.svg
/awesome-genie-logo.png
```

### Implementation rule

Create a reusable `Logo` component.

The component should:

1. Check configured logo path first.
2. If no configured path exists, use default `/logo.png`.
3. If `/logo.png` does not exist, try `/logo.svg`.
4. If no logo is found, show text fallback:

```txt
Awesome Genie
```

### Optional config

Support environment variable:

```env
NEXT_PUBLIC_LOGO_PATH=/logo.png
```

If logo location changes later, only this env value should be changed.

### Example component behavior

```txt
If NEXT_PUBLIC_LOGO_PATH exists:
  use that

Else try:
  /logo.png

Else try:
  /logo.svg

Else:
  show "Awesome Genie"
```

Logo should appear on:

```txt
/chat header
/thank-you page
/error page
Generated project brief header if possible
```

---

## 8. Main Chatbot Flow

```txt
User opens /chat
↓
Chat session starts
↓
Bot greets user
↓
User explains project need
↓
Bot detects intent and service category
↓
Bot answers service questions using Pinecone RAG
↓
Bot collects client details
↓
Bot asks service-specific onboarding questions
↓
User uploads files/documents/assets
↓
Bot stores and processes uploaded files
↓
Bot checks missing information
↓
Bot generates final project brief
↓
Bot creates Google Drive folder
↓
Bot uploads files and generated docs to Google Drive
↓
Bot shows confirmation / thank-you message
```

---

## 9. Chatbot Opening Message

Example:

```txt
Hi, I’m Awesome Genie. I’ll help collect your project details for the AwesomeTech team.

Tell me what you’re looking to build, automate, improve, or integrate.
```

The tone should be:

```txt
Professional
Friendly
Sales-style
Clear
Focused
Not robotic
No internal technical terms
```

---

## 10. Services The Chatbot Should Understand

Service categories must come from Supabase, not hardcoded.

Seed initial service categories:

```txt
Mortgage Automation
Mortgage Website Development
Custom Mortgage Software
MISMO Integration
Encompass Integration
BytePro Integration
MeridianLink Integration
Power BI / Reporting
Salesforce Development
CRM Integration
Custom Software Development
LOS Admin Services
Other
```

---

## 11. Client Information To Collect

The chatbot should collect:

```txt
Company name
Contact person
Email
Phone
Website URL
Country/location
Industry
Decision maker info if available
```

---

## 12. Project Information To Collect

The chatbot should collect:

```txt
Project type
Project overview
Business problem
Current process/system
Current pain points
Required features
Expected success outcome
Timeline
Budget range
Priority level
Existing tools/platforms
Integration requirements
Content/assets status
```

---

## 13. Service-Specific Onboarding

Questions must come from Supabase `onboarding_fields`, not hardcoded.

### Example: Mortgage Automation

Collect:

```txt
Current LOS/CRM
Workflow to automate
Manual steps
API availability
Data fields involved
Users affected
Current bottlenecks
Expected timeline
Budget range
Screenshots or workflow docs
```

### Example: Mortgage Website Development

Collect:

```txt
Website type: lender, broker, branch, loan officer
Pages needed
Mortgage calculators needed
Loan officer profile pages
Branch pages
Lead forms
CRM integration
Content ready or not
Branding ready or not
Reference websites
Hosting requirement
Timeline
Budget range
```

### Example: MISMO Integration

Collect:

```txt
Systems involved
MISMO version if known
Sample XML availability
Field mapping needs
Validation rules
Data transformation needs
Receiving system
API docs
Timeline
```

### Example: Power BI / Reporting

Collect:

```txt
Data sources
Reports needed
KPIs
Dashboard users
Role-based visibility
Refresh frequency
Sample reports
Current Excel/database files
```

---

## 14. Requirement Memory

The chatbot must maintain structured requirement memory during the session.

Example:

```json
{
  "company_name": "ABC Mortgage",
  "contact_name": "John Smith",
  "email": "john@abcmortgage.com",
  "service_type": "Mortgage Automation",
  "los_system": "Encompass",
  "workflow_goal": "Loan status sync",
  "timeline": "6 weeks",
  "budget_range": "$15k-$50k",
  "files_uploaded": ["workflow.pdf", "screenshots.zip"]
}
```

Store this in Supabase:

```txt
client_requirements
client_requirement_values
```

---

## 15. Completion Score

The chatbot should calculate onboarding completion.

Example required fields:

```txt
Company name
Contact name
Email
Service type
Project overview
Business problem
Timeline
Budget
Required features
Uploaded files if needed
```

Example:

```txt
Completion score: 75%
Missing: API documentation, timeline
```

The chatbot should say:

```txt
I have most of the details. I still need your expected timeline and any API documentation if available.
```

---

## 16. File Upload Requirements

The chatbot must support file upload.

Allowed file types:

```txt
PDF
DOCX
XLSX
CSV
TXT
PNG
JPG
JPEG
SVG
ZIP
HTML
JSON
XML
```

Examples of files client may upload:

```txt
Logo
Brand guide
PDF requirements
Word documents
Excel files
CSV files
Screenshots
Website templates
HTML files
API documentation
Sample XML
Wireframes
ZIP folders
Reference material
Current process docs
```

---

## 17. File Upload Flow

```txt
User uploads file
↓
File validates type and size
↓
File saves to Supabase Storage
↓
File metadata saves in uploaded_files
↓
If readable document:
   extract text
   save extracted_text
   create document source
   chunk text
   embed chunks
   store vectors in Pinecone client namespace
↓
If image/logo/zip:
   store as asset only
↓
All uploaded files later move/copy to Google Drive handoff folder
```

---

## 18. Proper RAG Requirement

The chatbot must use proper RAG.

Wrong flow:

```txt
User question
→ keyword search
→ JSON source
→ answer
```

Correct flow:

```txt
Website content
→ chunks
→ embeddings
→ Pinecone
→ user query embedding
→ Pinecone similarity search
→ top relevant chunks
→ LLM grounded answer
```

---

## 19. RAG Technology

Use:

```txt
LangChain
Pinecone
Embedding model
LLM provider
```

### LangChain role

LangChain handles:

```txt
text splitting
document chunking
embedding generation flow
Pinecone vector store/retriever
RAG chain
context building
LLM answer orchestration
```

### Pinecone role

Pinecone stores:

```txt
website vectors
uploaded document vectors
chunk metadata
```

### Supabase role

Supabase stores:

```txt
app data
chat history
requirements
file metadata
Drive logs
AI logs
RAG logs
website source metadata
chunk metadata and Pinecone vector IDs
```

---

## 20. Pinecone Index

Suggested index:

```txt
awesome-genie-rag
```

Vector type:

```txt
Dense
```

Metric:

```txt
cosine
```

Dimension:

```txt
Must match embedding model dimension.
```

Examples:

```txt
384-dimensional embedding model  → Pinecone dimension 384
768-dimensional embedding model  → Pinecone dimension 768
1536-dimensional embedding model → Pinecone dimension 1536
```

Do not create the Pinecone index until the embedding model is selected.

---

## 21. Pinecone Namespaces

Use:

```txt
website
client-files-{clientId}-{sessionId}
```

### `website`

For global AwesomeTech website knowledge.

### `client-files-{clientId}-{sessionId}`

For private uploaded documents of a specific client/session.

Important:

```txt
Never retrieve one client's uploaded files for another client/session.
```

---

## 22. Website RAG Ingestion

Source:

```txt
Yoast sitemap
Playwright rendered page extraction
website_json_sources
website_sections
```

Flow:

```txt
Approved website source
↓
website_sections
↓
LangChain text splitter
↓
chunks
↓
embedding provider
↓
Pinecone upsert into website namespace
↓
rag_chunks metadata saved in Supabase
↓
pinecone_synced = true
```

Only ingest:

```txt
approved_for_rag = true
needs_review = false
```

---

## 23. Stable Pinecone Vector IDs

Use deterministic vector IDs.

Website chunks:

```txt
website-{sourceId}-{sectionId}-{chunkIndex}
```

Client file chunks:

```txt
file-{clientId}-{sessionId}-{uploadedFileId}-{chunkIndex}
```

Benefits:

```txt
easy update
easy delete
no duplicates
clear audit trail
Supabase ↔ Pinecone mapping
```

---

## 24. Automated Website Updates

Pinecone must not be manually maintained.

### WordPress webhook

When website content changes:

```txt
WordPress page/post update
↓
Webhook hits Awesome Genie
↓
Backend receives URL/post ID
↓
Render updated page with Playwright
↓
Extract latest content
↓
Update Supabase website source and sections
↓
Regenerate chunks
↓
Create embeddings
↓
Upsert/delete Pinecone vectors
↓
Update pinecone_synced flags
```

Endpoint:

```txt
POST /api/webhooks/wordpress-content-updated
```

Use secret:

```env
WORDPRESS_WEBHOOK_SECRET=
```

### Daily cron backup

If webhook misses anything:

```txt
Daily sitemap scan
↓
Compare lastmod/content hash
↓
Detect changed URLs
↓
Resync only changed pages
↓
Update Pinecone automatically
```

### Manual sync

Manual sync can exist only as backup/debug:

```txt
Sync single URL
Re-ingest website vectors
```

---

## 25. Uploaded File RAG

For readable files:

```txt
PDF
DOCX
TXT
CSV
JSON
XML
HTML
```

Flow:

```txt
Extract text
↓
Create document_sources row
↓
Split into chunks with LangChain
↓
Generate embeddings
↓
Upsert into Pinecone namespace client-files-{clientId}-{sessionId}
↓
Save document_chunks metadata in Supabase
```

For non-readable files:

```txt
Images
Logos
ZIPs
Screenshots
```

Flow:

```txt
Store file
Save metadata
Include in Google Drive handoff
Do not embed unless image analysis is added later
```

---

## 26. Google Drive Handoff

When onboarding is complete, create Drive folder:

```txt
Awesome Genie Leads
└── Client Company Name
    ├── 01 Uploaded Files
    ├── 02 Project Brief
    ├── 03 Requirements
    ├── 04 Chat Transcript
    ├── 05 File Summaries
    └── 06 Internal Notes
```

Upload:

```txt
Original uploaded files
project-brief.md
requirements.json
chat-transcript.txt
file-summaries.md
internal-notes.md
```

The chatbot should confirm:

```txt
Thanks. Your project details and files have been submitted to the AwesomeTech team.
```

---

## 27. Project Brief Content

The final project brief should include:

```txt
Client name
Company name
Contact details
Requested service
Project overview
Business problem
Current system
Pain points
Required features
Integrations
Uploaded assets
Uploaded file summaries
Missing information
Recommended AwesomeTech service
Technical notes
Complexity level
Risk level
Suggested next step
```

Use context from:

```txt
client_requirements
chat_messages / conversation summary
website chunks from Pinecone
uploaded file chunks from Pinecone
uploaded_files metadata
```

---

## 28. Supabase Tables

Supabase is still required for app data.

### Core tables

```txt
clients
chat_sessions
chat_messages
client_requirements
client_requirement_values
uploaded_files
project_briefs
drive_logs
ai_usage_logs
rag_retrieval_logs
```

### Dynamic configuration tables

```txt
service_categories
onboarding_fields
prompt_templates
model_settings
system_settings
```

### Website metadata tables

```txt
website_json_sources
website_sections
website_assets
website_buttons
website_forms
rag_chunks
```

### Uploaded document metadata tables

```txt
document_sources
document_chunks
```

### Sync tables

```txt
sync_jobs
sync_job_items
webhook_events
```

No dashboard is required for these tables in the first version.

---

## 29. Tables/Code Not Needed

Remove or do not build:

```txt
Admin dashboard UI
PM dashboard UI
Client list UI
Knowledge viewer UI
Analytics dashboard UI
AI cost dashboard UI
Full CRM pipeline
Role management UI
Supabase pgvector
match_rag_chunks RPC
embedding columns in Supabase
primary JSON-only retrieval
primary keyword-only retrieval
full JSON-to-LLM context flow
```

Keep only as backend/fallback/debug where needed:

```txt
keyword fallback retrieval
local extraction report
manual sync API
debug logs
```

---

## 30. Required Backend APIs

### Chat APIs

```txt
POST /api/chat/start
POST /api/chat/message
POST /api/chat/upload
POST /api/chat/complete
GET  /api/chat/session/:id
```

### RAG APIs

```txt
POST /api/rag/ingest
POST /api/rag/test
POST /api/rag/retrieve
```

### Sync APIs

```txt
POST /api/sync/sitemap
POST /api/sync/single-url
POST /api/webhooks/wordpress-content-updated
```

### Drive APIs

```txt
POST /api/drive/create-client-folder
POST /api/drive/upload-file
POST /api/drive/create-brief
POST /api/drive/retry-sync/:clientId
```

No admin UI routes are required.

---

## 31. LangChain Files Required

Create:

```txt
/lib/langchain/embeddingProvider.ts
/lib/langchain/pineconeClient.ts
/lib/langchain/chunkWebsiteSections.ts
/lib/langchain/ingestWebsiteChunksToPinecone.ts
/lib/langchain/retrieveWebsiteChunksFromPinecone.ts
/lib/langchain/ingestUploadedFilesToPinecone.ts
/lib/langchain/retrieveClientFileChunksFromPinecone.ts
/lib/langchain/buildRagContext.ts
/lib/langchain/ragAnswer.ts
/lib/langchain/logRetrieval.ts
```

---

## 32. Other Core Files

```txt
/lib/chat/startSession.ts
/lib/chat/handleMessage.ts
/lib/chat/completeOnboarding.ts

/lib/onboarding/stateMachine.ts
/lib/onboarding/loadOnboardingFields.ts
/lib/onboarding/updateRequirementMemory.ts
/lib/onboarding/calculateCompletionScore.ts
/lib/onboarding/getNextQuestion.ts

/lib/files/validateFile.ts
/lib/files/extractText.ts
/lib/files/uploadToStorage.ts

/lib/drive/googleDriveClient.ts
/lib/drive/createClientFolder.ts
/lib/drive/uploadFile.ts
/lib/drive/createTextFile.ts

/lib/sync/fetchSitemap.ts
/lib/sync/renderWithPlaywright.ts
/lib/sync/extractRenderedContent.ts
/lib/sync/syncSingleUrl.ts
/lib/sync/webhookSync.ts

/components/chat/FullScreenChat.tsx
/components/chat/ChatMessage.tsx
/components/chat/FileUpload.tsx
/components/chat/ChatInput.tsx
/components/chat/ProgressPanel.tsx
/components/shared/Logo.tsx
```

---

## 33. Required Scripts

### `npm run rag:ingest`

Should:

```txt
read approved website_sections
split into chunks
generate embeddings
upsert to Pinecone website namespace
save rag_chunks metadata
mark pinecone_synced
log results
```

### `npm run rag:test`

Should:

```txt
run sample queries
generate query embedding
query Pinecone
print matched chunks
print source URLs
print similarity scores
print context preview
```

Sample queries:

```txt
Do you build mortgage websites?
Do you provide MISMO integration?
Do you work with Encompass?
Do you provide Power BI dashboards?
How can I contact AwesomeTech?
```

---

## 34. Chat API Flow

### `POST /api/chat/message`

```txt
1. Validate session.
2. Save user message.
3. Run rule engine.
4. If irrelevant:
   - return simple redirect response
   - no LLM call
5. If relevant:
   - detect intent and service category
6. If service/company knowledge needed:
   - generate query embedding
   - retrieve top chunks from Pinecone website namespace
   - build RAG context
   - generate grounded LLM answer
   - log retrieval
7. If onboarding active:
   - update requirement memory
   - calculate completion score
   - ask next missing question
8. Save assistant response.
9. Save AI usage log.
10. Return response.
```

---

## 35. Context Management

Send only this to LLM:

```txt
system prompt
current user message
current state
last 5-8 messages
requirement memory
missing fields
retrieved website chunks
retrieved client document chunks if needed
conversation summary if long
```

Do not send:

```txt
full website
full database
all JSON files
other clients' files
unapproved RAG sources
full raw chat history every time
```

---

## 36. Memory Management

Use:

```txt
Raw memory:
chat_messages

Structured memory:
client_requirements
client_requirement_values

Compressed memory:
conversation_summaries

Global knowledge:
Pinecone website namespace

Client document memory:
Pinecone client-files namespace
```

---

## 37. Internal Agents

The customer only sees one assistant:

```txt
Awesome Genie
```

Internally, code should be modular:

```txt
Router Agent
Knowledge Agent
Onboarding Agent
File Agent
Memory Agent
Drive Handoff Agent
```

### Router Agent

Detects intent and route.

### Knowledge Agent

Uses LangChain + Pinecone.

### Onboarding Agent

Collects requirements.

### File Agent

Handles uploads and file RAG.

### Memory Agent

Manages context and summaries.

### Drive Handoff Agent

Creates final Drive handoff.

---

## 38. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

PINECONE_API_KEY=
PINECONE_INDEX_NAME=awesome-genie-rag
PINECONE_NAMESPACE_WEBSITE=website

EMBEDDING_PROVIDER=
EMBEDDING_MODEL=
EMBEDDING_DIMENSION=

LLM_PROVIDER=
LLM_MODEL=

GROQ_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=

GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

WORDPRESS_WEBHOOK_SECRET=
WORDPRESS_BASE_URL=https://awesometechinc.com

NEXT_PUBLIC_LOGO_PATH=/logo.png

APP_URL=
```

---

## 39. Customer-Facing Rules

Customer should see:

```txt
helpful answers
clear onboarding questions
professional sales tone
simple file upload requests
confirmation messages
```

Customer should not see:

```txt
RAG
Pinecone
LangChain
vector
embedding
chunks
retrieval
SLM
LLM
similarity score
internal logs
source debugging
```

---

## 40. Production Safety

```txt
Do not expose API keys.
Do not send files to wrong Drive folder.
Do not retrieve client file chunks across clients.
Do not use unapproved RAG sources.
Do not rely on one AI model only.
Do not lose chat messages if AI fails.
Do not block onboarding if Drive fails.
Do not use LLM for obvious irrelevant messages.
Do not guess company services if no context is retrieved.
Pinecone updates must be automated through webhook/cron.
Manual sync is backup only.
```

---

## 41. Acceptance Criteria

The clean project is accepted only if:

```txt
1. Full-screen chatbot works at /chat.
2. No dashboard UI exists.
3. Logo auto-loads from root/public path.
4. Supabase stores app data.
5. Pinecone stores vectors.
6. LangChain chunks website sections.
7. rag:ingest upserts approved website chunks to Pinecone.
8. rag:test retrieves correct chunks using vector similarity.
9. Chatbot answers service questions using Pinecone RAG.
10. Keyword/JSON search is fallback only.
11. Chatbot collects full client onboarding details.
12. Chatbot supports file uploads.
13. Readable uploaded files are chunked and embedded into client Pinecone namespace.
14. Project brief is generated from requirements + website chunks + uploaded file chunks.
15. Google Drive folder is created.
16. Original files and generated docs are uploaded to Drive.
17. Chatbot shows final confirmation.
18. Customer never sees internal technical terms.
19. Website updates can automatically refresh Pinecone through webhook/cron.
```

---

## 42. Build Order

```txt
1. Create clean full-screen chatbot project.
2. Add theme, Lato font, and auto logo handling.
3. Setup Supabase app DB.
4. Setup Pinecone index after choosing embedding model.
5. Add LangChain.
6. Import/prepare approved website sections.
7. Chunk and embed website sections.
8. Upsert website vectors to Pinecone.
9. Build RAG retrieval and context builder.
10. Connect chatbot message API to Pinecone RAG.
11. Build dynamic onboarding memory.
12. Add file upload support.
13. Add uploaded document RAG.
14. Add project brief generation.
15. Add Google Drive handoff.
16. Add WordPress webhook and daily cron for updates.
17. Final test complete onboarding flow.
```

---

## 43. Final Explanation

```txt
Awesome Genie is a full-screen AI onboarding chatbot. It does not need a dashboard in the first version. The chatbot collects full client project details and files, answers service questions using proper LangChain + Pinecone RAG, processes uploaded documents, generates a project brief, and creates a Google Drive handoff folder.

Supabase is used only for app data such as chats, clients, requirements, files, logs, and website metadata. Pinecone is used as the vector database. LangChain handles chunking, embeddings, retrieval, and RAG context. Website changes update Pinecone automatically through webhook and scheduled sync.
```
