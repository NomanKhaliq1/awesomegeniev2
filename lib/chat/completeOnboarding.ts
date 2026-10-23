import { generateProjectBrief } from "@/lib/brief/generateProjectBrief";
import { updateSessionProgress } from "@/lib/data/chatRepository";
import { handoffBriefToDrive, type DriveHandoffResult } from "@/lib/drive/handoffToDrive";

export type CompleteOnboardingResult = {
  status: "complete";
  message: string;
  brief: {
    id: string;
    title: string;
    contentMarkdown: string;
  };
  drive: DriveHandoffResult;
};

export async function completeOnboarding(sessionId: string): Promise<CompleteOnboardingResult> {
  const brief = await generateProjectBrief(sessionId);
  const drive = await handoffBriefToDrive({
    sessionId,
    brief
  });

  await updateSessionProgress({
    sessionId,
    completionScore: 100,
    missingFields: [],
    status: "ready_to_complete"
  });

  return {
    status: "complete",
    message: getCompletionMessage(drive),
    brief,
    drive
  };
}

function getCompletionMessage(drive: DriveHandoffResult) {
  if (drive.status === "uploaded") {
    return "Project brief generated and uploaded to Google Drive.";
  }

  if (drive.status === "failed") {
    return "Project brief generated. Google Drive handoff failed and was logged.";
  }

  return "Project brief generated. Google Drive handoff was skipped.";
}
