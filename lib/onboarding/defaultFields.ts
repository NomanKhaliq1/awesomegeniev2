import { getCoreRequiredFields } from "./fields";
import { getSystemSetting } from "@/lib/data/settingsRepository";

export async function getDefaultMissingFields() {
  const [fields, initialKeys] = await Promise.all([
    getCoreRequiredFields(),
    getSystemSetting<string[]>("initial_missing_field_keys")
  ]);

  return fields
    .filter((field) => initialKeys.includes(field.key))
    .map((field) => field.label);
}
