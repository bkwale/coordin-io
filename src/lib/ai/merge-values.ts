/**
 * Merge values from a document / Ehitisregister into the questionnaire.
 * Same rule as typing: heated + enclosed net area follow gross (≈90%) until someone sets them explicitly.
 * Explicit values (e.g. EHR köetav pind) count as "edited" so a later gross change won't overwrite them.
 */
export type AreaEdited = { heated: boolean; enclosed: boolean }

export function mergeValues<T extends { grossFloorArea?: number; heatedArea?: number; enclosedNetArea?: number }>(
  form: T, values: Record<string, unknown>, edited: AreaEdited,
): { form: T; edited: AreaEdited } {
  const next = { ...form, ...(values as Partial<T>) }
  const e = { ...edited }
  if (typeof values.heatedArea === 'number') e.heated = true
  if (typeof values.enclosedNetArea === 'number') e.enclosed = true
  const g = values.grossFloorArea
  if (typeof g === 'number') {
    if (!e.heated) next.heatedArea = Math.round(g * 0.9)
    if (!e.enclosed) next.enclosedNetArea = Math.round(g * 0.9)
  }
  return { form: next, edited: e }
}
