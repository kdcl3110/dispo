// Validation d'un local ou d'un équipement saisi à la main (ou importé).
// Les personnes ne passent pas par ici : leur fiche vient de Google.

import type { ValidationError } from "@/lib/validation/calendar";

export const MAX_RESOURCE_NAME_LENGTH = 120;

// Types qu'un administrateur peut créer ou modifier.
export type EditableResourceType = "LOCAL" | "EQUIPMENT";
export const EDITABLE_TYPES: EditableResourceType[] = ["LOCAL", "EQUIPMENT"];

export function validateResourceInput(input: { type: string; name: string }): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!EDITABLE_TYPES.includes(input.type as EditableResourceType)) {
    errors.push({ field: "type", message: "Choisissez « local » ou « équipement »." });
  }

  const name = input.name.trim();
  if (!name) {
    errors.push({ field: "name", message: "Donnez un nom à la ressource." });
  } else if (name.length > MAX_RESOURCE_NAME_LENGTH) {
    errors.push({ field: "name", message: `Le nom dépasse ${MAX_RESOURCE_NAME_LENGTH} caractères.` });
  }

  return errors;
}
