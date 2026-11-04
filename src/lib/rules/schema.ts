import { z } from 'zod'

/** Zod schema for the 18-parameter questionnaire. Used by the API and (later) by document extraction. */
export const ProjectParametersSchema = z.object({
  jurisdiction: z.enum(['EE', 'GB', 'PL', 'ES']),
  buildingType: z.enum(['detached_house', 'apartment_block', 'semi_detached', 'terraced', 'non_residential', 'other']),
  workType: z.enum(['new_build', 'extension', 'reconstruction', 'change_of_use', 'demolition']),
  grossFloorArea: z.number().min(0).max(1_000_000),
  height: z.number().min(0).max(500),
  storeys: z.number().int().min(0).max(200),
  apartments: z.number().int().min(0).max(10_000).optional(),
  parkingSpaces: z.number().int().min(0).max(100_000).optional(),
  heatedArea: z.number().min(0).max(1_000_000).optional(),
  enclosedNetArea: z.number().min(0).max(1_000_000).optional(),
  timberStructure: z.boolean().optional(),
  heritage: z.boolean().optional(),
  protectedArea: z.boolean().optional(),
  detailedPlanExists: z.boolean().optional(),
  detailedPlanAgeYears: z.number().min(0).max(100).optional(),
  nearMajorRoad: z.boolean().optional(),
  districtHeatingAvailable: z.boolean().optional(),
  urbanArea: z.boolean().optional(),
  seasonalUseOnly: z.boolean().optional(),
  temporary: z.boolean().optional(),
  placeOfWorship: z.boolean().optional(),
  county: z.string().max(80).optional(),
})

export type ProjectParametersInput = z.infer<typeof ProjectParametersSchema>
