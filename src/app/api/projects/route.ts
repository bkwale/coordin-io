import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { hasOrgPermission } from '@/lib/permissions'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { requireString, optionalString, optionalId, optionalEnum, optionalDate, optionalNumber, parseBody } from '@/lib/validation'

/**
 * GET /api/projects — List projects for the current user.
 *
 * Admins / Owners see all org projects.
 * Everyone else sees only projects they are a member of.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const orgId = profile.organisationId
  const isAdmin = hasOrgPermission(profile.orgPermission, 'ADMIN')

  const projects = await prisma.project.findMany({
    where: isAdmin
      ? { organisationId: orgId }
      : {
          organisationId: orgId,
          memberships: {
            some: {
              profileId: profile.id,
              removedAt: null,
            },
          },
        },
    include: {
      office: { select: { id: true, name: true } },
      _count: {
        select: { tasks: true, memberships: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return success({ projects })
})

/**
 * POST /api/projects — Create a new project. MANAGER+ only.
 *
 * Accepts all project fields from the 9-step wizard.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  // ── Step 1: General Information ──────────────────────
  const name = requireString(body.name, 'Project name', 200)
  const code = optionalString(body.code, 'Project code', 50)
  const description = optionalString(body.description, 'Description', 5000)
  const projectType = optionalEnum(body.projectType, 'Project type', [
    'HOTEL', 'RESIDENTIAL', 'MIXED_USE', 'RESORT', 'REFURBISHMENT', 'OFFICE_FIT_OUT',
  ] as const)
  const clientBrand = optionalString(body.clientBrand, 'Client name', 200)
  const clientType = optionalString(body.clientType, 'Client type', 50)
  const currency = optionalEnum(body.currency, 'Currency', ['NGN', 'GBP', 'USD', 'EUR'] as const)
  const startDate = optionalDate(body.startDate, 'Start date')
  const targetCompletion = optionalDate(body.targetCompletion, 'Target completion')
  const officeId = optionalId(body.officeId, 'Office ID')

  // ── Step 2: Location ────────────────────────────────
  const location = optionalString(body.location, 'Location', 500)
  const siteAddress = optionalString(body.siteAddress, 'Site address', 1000)
  const siteCity = optionalString(body.siteCity, 'City', 200)
  const siteCountry = optionalString(body.siteCountry, 'Country', 200)
  const siteRegion = optionalString(body.siteRegion, 'Region', 200)
  const sitePostcode = optionalString(body.sitePostcode, 'Postcode', 20)
  const mapLatitude = optionalNumber(body.mapLatitude, 'Latitude', { min: -90, max: 90 })
  const mapLongitude = optionalNumber(body.mapLongitude, 'Longitude', { min: -180, max: 180 })
  const planningAuthority = optionalString(body.planningAuthority, 'Planning authority', 300)
  const buildingControlAuthority = optionalString(body.buildingControlAuthority, 'Building control authority', 300)

  // ── Step 3: Development Type ────────────────────────
  const developmentType = optionalString(body.developmentType, 'Development type', 50)

  // ── Step 4: Client & Operator ───────────────────────
  const operatorName = optionalString(body.operatorName, 'Operator name', 200)
  const operatorBrand = optionalString(body.operatorBrand, 'Operator brand', 200)
  const managementType = optionalString(body.managementType, 'Management type', 50)
  const targetKeys = optionalNumber(body.targetKeys, 'Target keys', { min: 0 })
  const currentKeys = optionalNumber(body.currentKeys, 'Current keys', { min: 0 })
  const modelRoomRequired = body.modelRoomRequired === true ? true : undefined
  const operatorContact = optionalString(body.operatorContact, 'Operator contact', 500)
  const operatorStandardVersion = optionalString(body.operatorStandardVersion, 'Operator standard version', 100)

  // ── Step 5: Work Stages ─────────────────────────────
  const workStageFramework = optionalString(body.workStageFramework, 'Work stage framework', 50)
  const stage = optionalEnum(body.stage, 'Stage', [
    'BRIEF', 'CONCEPT', 'SPATIAL_COORDINATION', 'WORKING_DRAWINGS',
    'CONSTRUCTION', 'HANDOVER', 'OPERATIONS',
  ] as const)

  // ── Step 6: Compliance ──────────────────────────────
  const isBRPD = body.isBRPD === true
  const isCDM = body.isCDM === true
  const complianceFrameworks = optionalString(body.complianceFrameworks, 'Compliance frameworks', 500)

  // ── Step 7: Metrics ─────────────────────────────────
  const siteArea = optionalNumber(body.siteArea, 'Site area', { min: 0 })
  const grossFloorArea = optionalNumber(body.grossFloorArea, 'GFA', { min: 0 })
  const netInternalArea = optionalNumber(body.netInternalArea, 'NIA', { min: 0 })
  const numberOfBlocks = optionalNumber(body.numberOfBlocks, 'Number of blocks', { min: 0 })
  const numberOfFloors = optionalNumber(body.numberOfFloors, 'Number of floors', { min: 0 })
  const numberOfUnits = optionalNumber(body.numberOfUnits, 'Number of units', { min: 0 })
  const parkingSpaces = optionalNumber(body.parkingSpaces, 'Parking spaces', { min: 0 })
  const accessibleParking = optionalNumber(body.accessibleParking, 'Accessible parking', { min: 0 })
  const fohArea = optionalNumber(body.fohArea, 'FOH area', { min: 0 })
  const bohArea = optionalNumber(body.bohArea, 'BOH area', { min: 0 })
  const budgetVal = optionalNumber(body.budget, 'Budget', { min: 0 })
  const developmentStatus = optionalString(body.developmentStatus, 'Development status', 50)
  const targetOpeningDate = optionalDate(body.targetOpeningDate, 'Target opening date')

  // ── Status ──────────────────────────────────────────
  const status = optionalEnum(body.status, 'Status', ['ACTIVE', 'DRAFT'] as const)

  // ── Helper: convert to Int or undefined ─────────────
  const toInt = (n: number | null): number | undefined =>
    n !== null ? Math.round(n) : undefined
  const toVal = (n: number | null): number | undefined =>
    n !== null ? n : undefined

  const project = await prisma.project.create({
    data: {
      organisationId: profile.organisationId,
      name,
      code: code || undefined,
      description: description || undefined,
      location: location || undefined,
      projectType: projectType || undefined,
      stage: stage || undefined,
      status: status || undefined,
      currency: currency || undefined,
      clientBrand: clientBrand || undefined,
      clientType: clientType || undefined,
      officeId: officeId || undefined,
      startDate: startDate || undefined,
      targetCompletion: targetCompletion || undefined,
      // Location fields
      siteAddress: siteAddress || undefined,
      siteCity: siteCity || undefined,
      siteCountry: siteCountry || undefined,
      siteRegion: siteRegion || undefined,
      sitePostcode: sitePostcode || undefined,
      mapLatitude: toVal(mapLatitude),
      mapLongitude: toVal(mapLongitude),
      planningAuthority: planningAuthority || undefined,
      buildingControlAuthority: buildingControlAuthority || undefined,
      // Development
      developmentType: developmentType || undefined,
      // Operator
      operatorName: operatorName || undefined,
      operatorBrand: operatorBrand || undefined,
      managementType: managementType || undefined,
      targetKeys: toInt(targetKeys),
      currentKeys: toInt(currentKeys),
      modelRoomRequired,
      operatorContact: operatorContact || undefined,
      operatorStandardVersion: operatorStandardVersion || undefined,
      // Work stages
      workStageFramework: workStageFramework || undefined,
      // Compliance
      isBRPD,
      isCDM,
      complianceFrameworks: complianceFrameworks || undefined,
      // Metrics
      siteArea: toVal(siteArea),
      grossFloorArea: toVal(grossFloorArea),
      netInternalArea: toVal(netInternalArea),
      numberOfBlocks: toInt(numberOfBlocks),
      numberOfFloors: toInt(numberOfFloors),
      numberOfUnits: toInt(numberOfUnits),
      parkingSpaces: toInt(parkingSpaces),
      accessibleParking: toInt(accessibleParking),
      fohArea: toVal(fohArea),
      bohArea: toVal(bohArea),
      budget: toVal(budgetVal),
      developmentStatus: developmentStatus || undefined,
      targetOpeningDate: targetOpeningDate || undefined,
    },
  })

  await recordAuditEvent({
    organisationId: profile.organisationId,
    actorId: profile.id,
    action: AuditActions.PROJECT_CREATED,
    entityType: 'Project',
    entityId: project.id,
    metadata: { projectName: project.name },
  })

  return success({ project }, 201)
}, { requiredPermission: 'MANAGER' })
