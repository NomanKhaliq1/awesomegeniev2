async function main() {
  const docAnswer = "According to the uploaded document context, the tech support email is tech-support@apexmortgage.com, and the project budget is set at $45,000.";
  const webAnswer = "I need to confirm with the AwesomeTech team to provide the specific details about the tech support email and project budget listed in your requirements document, as this information is not available in the provided context.";

  const cleanWebsiteAnswer =
    docAnswer && webAnswer &&
    (webAnswer.toLowerCase().includes("confirm with the awesometech team") ||
     webAnswer.toLowerCase().includes("insufficient"))
      ? null
      : webAnswer;

  console.log("cleanWebsiteAnswer should be null:");
  console.log(`Result: ${cleanWebsiteAnswer}`);
}

main().catch(console.error);
