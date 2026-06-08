const serviceSlugMap: Record<string, string> = {
  "mortgage automation": "mortgage-automation",
  "mortgage website development": "mortgage-website-development",
  "custom mortgage software": "custom-mortgage-software",
  "mismo integration": "mismo-integration",
  "encompass integration": "encompass-integration",
  "bytepro integration": "bytepro-integration",
  "meridianlink integration": "meridianlink-integration",
  "power bi / reporting": "power-bi-reporting",
  "power bi reporting": "power-bi-reporting",
  "salesforce development": "salesforce-development",
  "crm integration": "crm-integration",
  "custom software development": "custom-software-development",
  "los admin services": "los-admin-services",
  other: "other"
};

export function serviceNameToSlug(serviceName?: string | null) {
  if (!serviceName) {
    return null;
  }

  return serviceSlugMap[serviceName.trim().toLowerCase()] ?? null;
}
