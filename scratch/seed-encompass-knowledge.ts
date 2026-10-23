import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function seedEncompassKnowledge() {
  const { createOptionalSupabaseServiceClient } = await import("../lib/supabase/server");
  const { deleteWebsiteVectorsForSource } = await import("../lib/langchain/deleteWebsiteVectors");

  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase credentials missing.");
  }

  const url = "https://www.awesometech.com/encompass-plugins";
  const title = "AwesomeTech Encompass Plugin Use Cases";
  const content = `AwesomeTech provides custom Encompass plugin development and mortgage technology solutions for lenders that need to automate repetitive LOS workflows, reduce manual work, enforce business rules, and improve operational visibility.

Encompass plugin use-case categories include:

FHA / VA Document Submission Automation:
AwesomeTech’s FHA Case Binder Plugin supports FHA and VA loan document submission workflows. It helps streamline document handling and reduce manual submission errors.

Lending Process Automation:
Plugins can simplify and automate repetitive lending processes that otherwise require manual staff effort.

Business Rule Enforcement:
Plugins can help reduce dependency on complicated manual business rule tracking by enforcing required conditions and workflow logic inside the lending process.

Manual Procedure Automation:
Plugins can automate repeated manual procedures in mortgage lending systems, reducing operational effort and human error.

Conditional Workflow Management:
Plugins can manage business workflows conditionally based on loan attributes, statuses, rules, or process requirements.

Data Collection and Reporting:
Plugins can help collect, organize, and analyze lending data from databases to improve reporting, visibility, and operational decision-making.

CRM / LOS Synchronization:
Custom integrations can support synchronization between Encompass and CRM systems such as HubSpot when lenders need better consistency across systems.

Borrower Notification Workflows:
Automation can trigger borrower communication based on loan milestones, status changes, or required actions.

Vendor Coordination Automation:
Mortgage teams can reduce manual coordination with title, appraisal, and other vendors by automating status visibility and workflow triggers.

Operational Visibility:
Custom dashboards and reporting can help processing, underwriting, closing, and leadership teams see loan status, bottlenecks, and workflow progress.

Common problems these solutions help solve:

* duplicate data entry
* manual status updates
* inconsistent workflow execution
* delayed borrower communication
* poor visibility across teams
* manual vendor coordination
* reporting gaps
* operational bottlenecks as loan volume grows
* dependency on staff memory for rules and process steps

Recommended comparison table:

| Use Case Category                       | What It Helps With                                                | Example Impact                                         |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| FHA / VA Document Submission Automation | Streamlines FHA and VA loan document submissions                  | Reduces manual document handling and submission errors |
| Lending Process Automation              | Automates repetitive lending tasks and workflows                  | Saves processor time and improves consistency          |
| Business Rule Enforcement               | Helps manage required workflow rules and conditions               | Reduces missed steps and manual rule tracking          |
| Manual Procedure Automation             | Automates repeated manual procedures in mortgage lending systems  | Reduces operational effort and human error             |
| Conditional Workflow Management         | Manages workflows based on loan conditions or business logic      | Improves consistency across teams                      |
| Data Collection and Reporting           | Helps collect and analyze lending data                            | Improves visibility into workflow and performance      |
| CRM / LOS Synchronization               | Helps keep Encompass and CRM data aligned                         | Reduces duplicate updates and data mismatch            |
| Borrower Notification Workflows         | Triggers borrower updates based on loan events                    | Improves communication and reduces follow-up workload  |
| Vendor Coordination Automation          | Improves coordination with title, appraisal, and vendor workflows | Reduces manual handoffs and delays                     |
| Operational Visibility                  | Provides workflow and reporting visibility across teams           | Helps teams track bottlenecks and loan progress        |

Response guidance for Awesome Genie:

When asked to compare Encompass plugin use cases, provide one concise use-case category comparison table.

Do not say the AwesomeTech team must confirm normal use-case comparisons.

Use this wording:
"Based on the available context, here is a practical use-case category comparison:"

For final notes, use:
"This comparison is based on the available context. The final plugin fit and implementation scope can be reviewed during project scoping."

Do not use:
"The AwesomeTech team can confirm the full plugin catalog if needed."
"I need to confirm with the AwesomeTech team."
"Would you like me to follow up?"

If FHA Case Binder Plugin appears in the context, include this first row:
FHA / VA Document Submission Automation | Streamlines FHA and VA loan document submissions | Reduces manual document handling and submission errors`;

  console.log("Seeding Encompass RAG source...");

  const { data: existingSource, error: findError } = await supabase
    .from("website_json_sources")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  let sourceId = existingSource?.id;

  const { data: source, error: sourceError } = await supabase
    .from("website_json_sources")
    .upsert({
      id: sourceId,
      url,
      title,
      content_hash: "manual_seed_encompass_plugins_v1",
      approved_for_rag: true,
      needs_review: false,
      pinecone_synced: false,
      raw_json: { seededBy: "scratch:seed-encompass-knowledge" }
    })
    .select("id")
    .single();

  if (sourceError || !source) {
    throw sourceError || new Error("Upsert source failed.");
  }

  sourceId = source.id;
  console.log("Upserted source ID:", sourceId);

  // Clear existing sections for this source
  await deleteWebsiteVectorsForSource(sourceId);
  await supabase.from("website_sections").delete().eq("source_id", sourceId);

  // Insert sections
  const { error: insertError } = await supabase
    .from("website_sections")
    .insert({
      source_id: sourceId,
      heading: "AwesomeTech Encompass Plugin Use Cases",
      content,
      sort_order: 1,
      content_hash: "manual_seed_encompass_plugins_v1_section",
      pinecone_synced: false
    });

  if (insertError) {
    throw insertError;
  }

  console.log("Upserted website_sections row. Skipping full Pinecone ingestion in seed script. Run scratch/ingest-encompass-only.ts instead.");
}

seedEncompassKnowledge().catch(console.error);
