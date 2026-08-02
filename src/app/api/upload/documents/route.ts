import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  // Documents
  'application/pdf',
  // Office — Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Office — Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Office — PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // CAD
  'application/dxf',
  'application/acad',
  // Email
  'application/vnd.ms-outlook', // .msg
  'message/rfc822', // .eml
  // Archives
  'application/zip',
  // BIM / CAD / 3D fallback (validated by extension below)
  'application/octet-stream',
])

/** Extensions accepted when the MIME type is application/octet-stream */
const OCTET_STREAM_ALLOWED_EXTENSIONS = new Set([
  '.dwg', '.dxf', '.ifc', '.rvt', '.nwd', '.nwc', '.skp', '.3dm', '.msg', '.eml',
])

/** All CAD/BIM/3D extensions that are valid regardless of MIME type */
const CAD_BIM_EXTENSIONS = new Set([
  '.dwg', '.dxf', '.ifc', '.rvt', '.nwd', '.nwc', '.skp', '.3dm',
])

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx).toLowerCase() : ''
}

/**
 * POST /api/upload/documents — Upload a project document to Supabase Storage.
 *
 * Accepts multipart/form-data with `file` and `projectId` fields.
 * Returns `{ url, fileName, fileSize, contentType }`.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const formData = await request.formData()
  const file = formData.get('file')
  const projectId = formData.get('projectId')

  if (!file || !(file instanceof File)) {
    throw new ValidationError('A file is required')
  }

  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    throw new ValidationError('projectId is required')
  }

  const extension = getExtension(file.name)

  // Validate file type — check MIME type first, then handle edge cases
  const mimeAllowed = ALLOWED_MIME_TYPES.has(file.type)
  const cadBimByExtension = CAD_BIM_EXTENSIONS.has(extension)

  if (!mimeAllowed && !cadBimByExtension) {
    throw new ValidationError(
      `File type "${file.type}" is not allowed. Accepted: PDF, images, Office documents, CAD/BIM files, ZIP archives.`,
    )
  }

  // For application/octet-stream, only allow known CAD/BIM extensions
  if (file.type === 'application/octet-stream' && !OCTET_STREAM_ALLOWED_EXTENSIONS.has(extension)) {
    throw new ValidationError(
      `File extension "${extension}" is not allowed for binary files. Accepted extensions: ${[...OCTET_STREAM_ALLOWED_EXTENSIONS].join(', ')}`,
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB`,
    )
  }

  // Build storage path: {orgId}/{projectId}/{timestamp}-{sanitisedFilename}
  const timestamp = Date.now()
  const sanitisedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${profile.organisationId}/${projectId}/${timestamp}-${sanitisedName}`

  // Create a Supabase client with the service role key for storage operations
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Read file into buffer and upload
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[DOCUMENT_UPLOAD] Storage error:', uploadError.message)
    throw new ValidationError(`Upload failed: ${uploadError.message}`)
  }

  // Generate a signed URL with 1-year expiry (in seconds)
  const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(storagePath, ONE_YEAR_SECONDS)

  if (signError || !signedData?.signedUrl) {
    console.error('[DOCUMENT_UPLOAD] Signed URL error:', signError?.message)
    throw new ValidationError('File uploaded but failed to generate access URL')
  }

  return success({
    url: signedData.signedUrl,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type,
  }, 201)
})
