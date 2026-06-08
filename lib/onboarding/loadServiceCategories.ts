import { listServiceCategories } from "@/lib/data/configRepository";

export async function loadServiceCategories() {
  return listServiceCategories();
}
