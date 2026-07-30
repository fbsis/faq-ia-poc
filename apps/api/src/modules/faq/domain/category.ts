export interface Category {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function createCategory(name: string, id: string, now: Date): Category {
  const cleanName = name.trim();
  if (cleanName.length < 2) throw new Error("Category name is too short.");
  return {
    id,
    name: cleanName,
    slug: slugify(cleanName),
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
