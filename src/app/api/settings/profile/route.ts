import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { ValidationError } from '@/lib/errors'

/**
 * PATCH /api/settings/profile — Update the current user's profile.
 *
 * Accepts: phone, emergencyContactName, emergencyContactPhone.
 * Updates Profile.phone and EmployeeProfile emergency fields.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  try {
    const body = await request.json()
    const { phone, emergencyContactName, emergencyContactPhone } = body

    // Validate phone formats if provided
    if (phone !== undefined && phone !== null && phone !== '') {
      const cleaned = String(phone).replace(/[\s\-().]/g, '')
      if (!/^\+?\d{7,15}$/.test(cleaned)) {
        throw new ValidationError('Invalid phone number format')
      }
    }

    if (emergencyContactPhone !== undefined && emergencyContactPhone !== null && emergencyContactPhone !== '') {
      const cleaned = String(emergencyContactPhone).replace(/[\s\-().]/g, '')
      if (!/^\+?\d{7,15}$/.test(cleaned)) {
        throw new ValidationError('Invalid emergency contact phone format')
      }
    }

    // Update Profile.phone
    if (phone !== undefined) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { phone: phone || null },
      })
    }

    // Update EmployeeProfile emergency fields
    const hasEmergencyUpdate =
      emergencyContactName !== undefined || emergencyContactPhone !== undefined

    if (hasEmergencyUpdate) {
      await prisma.employeeProfile.upsert({
        where: { profileId: profile.id },
        create: {
          profileId: profile.id,
          emergencyName: emergencyContactName || null,
          emergencyPhone: emergencyContactPhone || null,
        },
        update: {
          ...(emergencyContactName !== undefined && { emergencyName: emergencyContactName || null }),
          ...(emergencyContactPhone !== undefined && { emergencyPhone: emergencyContactPhone || null }),
        },
      })
    }

    return success({ updated: true })
  } catch (err) {
    return error(err)
  }
})
