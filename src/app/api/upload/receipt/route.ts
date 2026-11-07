import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'
import { fileLink } from '@/lib/storage-links'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

/**
 * POST /api/upload/receipt — Upload an expense receipt to Supabase Storage.
 *
 * Accepts multipart/form-data with a single `file` field.
 * Returns `{ url: string }` — a stable link (/api/files…) that opens the file through a 1-hour signed URL.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    throw new ValidationError('A file is required')
  }

  // Validate file type
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ValidationError(
      `File type "${file.type}" is not allowed. Accepted: JPEG, PNG, WebP, PDF`,
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB`,
    )
  }

  // Build storage path: {orgId}/{profileId}/{timestamp}-{filename}
  const timestamp = Date.now()
  const sanitisedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${profile.organisationId}/${profile.id}/${timestamp}-${sanitisedName}`

  // Ensure service role key is available
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[RECEIPT_UPLOAD] SUPABASE_SERVICE_ROLE_KEY is not set')
    throw new ValidationError('File storage is not configured — contact your administrator')
  }

  // Create a Supabase client with the service role key for storage operations
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
  // Read file into buffer and upload
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabaseAdmin.storage
    .from('receipts')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[RECEIPT_UPLOAD] Storage error:', uploadError.message)
    throw new ValidationError(`Upload failed: ${uploadError.message}`)
  }

  // Store a stable app link; /api/files signs a 1-hour URL each time the file is opened
  const fileUrl = fileLink('receipts', storagePath)

  return success({ url: fileUrl }, 201)
  } catch (err) {
    if (err instanceof ValidationError) throw err
    console.error('[RECEIPT_UPLOAD] Unexpected error:', err)
    throw new ValidationError(
      `Upload failed: ${err instanceof Error ? err.message : 'Unknown storage error'}`,
    )
  }
})
