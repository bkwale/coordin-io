import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError, PermissionError } from '@/lib/errors'
import { canManageHR } from '@/lib/staffing-utils'
import type { OrgPermission } from '@/generated/prisma/client'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/octet-stream',
])

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx).toLowerCase() : ''
}

/**
 * POST /api/staffing/hr-documents/upload — Upload an HR document file.
 *
 * Accepts multipart/form-data with `file` and `profileId` fields.
 * Stores in Supabase storage under `documents/hr/{organisationId}/{profileId}/`.
 * Returns `{ url, fileName, fileSize, contentType }`.
 *
 * Permission: HR+ only (HR, ADMIN, OWNER).
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!canManageHR(profile.orgPermission as OrgPermission)) {
    throw new PermissionError('Only HR managers and admins can upload HR documents')
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const targetProfileId = formData.get('profileId')

  if (!file || !(file instanceof File)) {
    throw new ValidationError('A file is required')
  }

  if (!targetProfileId || typeof targetProfileId !== 'string' || !targetProfileId.trim()) {
    throw new ValidationError('profileId is required')
  }

  // Validate file type
  const extension = getExtension(file.name)
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ValidationError(
      `File type "${file.type}" is not allowed. Accepted: PDF, images, Office documents, ZIP archives.`,
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB`,
    )
  }

  // Build storage path: hr/{orgId}/{profileId}/{timestamp}-{sanitisedFilename}
  const timestamp = Date.now()
  const sanitisedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `hr/${profile.organisationId}/${targetProfileId}/${timestamp}-${sanitisedName}`

  // Create Supabase admin client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Read file and upload
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[HR_DOC_UPLOAD] Storage error:', uploadError.message)
    throw new ValidationError(`Upload failed: ${uploadError.message}`)
  }

  // Generate signed URL (1-year expiry)
  const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(storagePath, ONE_YEAR_SECONDS)

  if (signError || !signedData?.signedUrl) {
    console.error('[HR_DOC_UPLOAD] Signed URL error:', signError?.message)
    throw new ValidationError('File uploaded but failed to generate access URL')
  }

  return success({
    url: signedData.signedUrl,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type,
    extension,
  }, 201)
})
