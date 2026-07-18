import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'

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
 * Returns `{ url: string }` — a signed URL with 1-year expiry.
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

  // Create a Supabase client with the service role key for storage operations
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

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

  // Generate a signed URL with 1-year expiry (in seconds)
  const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from('receipts')
    .createSignedUrl(storagePath, ONE_YEAR_SECONDS)

  if (signError || !signedData?.signedUrl) {
    console.error('[RECEIPT_UPLOAD] Signed URL error:', signError?.message)
    throw new ValidationError('File uploaded but failed to generate access URL')
  }

  return success({ url: signedData.signedUrl }, 201)
})
