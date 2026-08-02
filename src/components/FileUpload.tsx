'use client'

import { useCallback, useRef, useState } from 'react'
import {
  Upload, File, FileText, Image, Archive, CheckCircle2,
  AlertTriangle, Loader2, X, RotateCcw, Paperclip,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ─────────────────────────────────────────────────── */

export interface UploadResult {
  url: string
  fileName: string
  fileSize: number
  contentType?: string
}

export interface FileItem {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  result?: UploadResult
}

interface FileUploadProps {
  /** Called whenever the uploaded file list changes (add/remove/complete) */
  onFilesChange: (files: UploadResult[]) => void
  /** Project ID — required for storage path */
  projectId: string
  /** Custom accept string for the file input */
  accept?: string
  /** Max file size in MB (default: 50) */
  maxSizeMB?: number
  /** Label shown above the drop zone */
  label?: string
  /** Allow multiple files (default: true) */
  multiple?: boolean
}

/* ── Constants ─────────────────────────────────────────────── */

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.tiff,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.ifc,.rvt,.nwd,.nwc,.skp,.3dm,.zip,.msg,.eml'
const DEFAULT_MAX_MB = 50

/* Architecture-firm file categories for display */
const FILE_CATEGORIES = [
  { label: 'Drawings', exts: 'DWG, DXF, PDF' },
  { label: 'BIM', exts: 'IFC, RVT, NWD, NWC' },
  { label: '3D', exts: 'SKP, 3DM' },
  { label: 'Documents', exts: 'DOC, XLS, PPT, PDF' },
  { label: 'Images', exts: 'JPG, PNG, TIFF' },
  { label: 'Email', exts: 'MSG, EML' },
]

/* ── Helpers ───────────────────────────────────────────────── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp'].includes(ext)) return Image
  if (['zip', 'rar', '7z'].includes(ext)) return Archive
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return FileText
  if (['dwg', 'dxf', 'ifc', 'rvt', 'nwd', 'nwc', 'skp', '3dm'].includes(ext)) return Paperclip
  return File
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['dwg', 'dxf'].includes(ext)) return 'text-orange-500'
  if (['ifc', 'rvt', 'nwd', 'nwc'].includes(ext)) return 'text-violet-500'
  if (['pdf'].includes(ext)) return 'text-red-500'
  if (['jpg', 'jpeg', 'png', 'webp', 'tiff'].includes(ext)) return 'text-blue-500'
  if (['doc', 'docx'].includes(ext)) return 'text-blue-600'
  if (['xls', 'xlsx'].includes(ext)) return 'text-emerald-600'
  if (['skp', '3dm'].includes(ext)) return 'text-amber-500'
  return 'text-ink-400'
}

/* ── Component ─────────────────────────────────────────────── */

export default function FileUpload({
  onFilesChange,
  projectId,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_MB,
  label = 'Attach files',
  multiple = true,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<FileItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  /* ── Notify parent of successful uploads ─────────────────── */

  const notifyParent = useCallback((updatedItems: FileItem[]) => {
    const successful = updatedItems
      .filter((i) => i.status === 'success' && i.result)
      .map((i) => i.result!)
    onFilesChange(successful)
  }, [onFilesChange])

  /* ── Client-side validation ──────────────────────────────── */

  function validateFile(file: File): string | null {
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      return `Too large (${formatFileSize(file.size)}). Max: ${maxSizeMB}MB`
    }
    const acceptedExts = accept.split(',').map((s) => s.trim().toLowerCase())
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
    const extMatch = acceptedExts.some((a) => a === ext || a === file.type || a === '*')
    if (!extMatch && acceptedExts.length > 0) {
      return `File type "${ext}" is not supported.`
    }
    return null
  }

  /* ── Upload single file ──────────────────────────────────── */

  const uploadFile = useCallback(async (item: FileItem, allItems: FileItem[]) => {
    const validationError = validateFile(item.file)
    if (validationError) {
      const updated = allItems.map((i) =>
        i.id === item.id ? { ...i, status: 'error' as const, error: validationError } : i
      )
      setItems(updated)
      notifyParent(updated)
      return
    }

    // Mark as uploading
    let currentItems = allItems.map((i) =>
      i.id === item.id ? { ...i, status: 'uploading' as const, progress: 0 } : i
    )
    setItems(currentItems)

    const formData = new FormData()
    formData.append('file', item.file)
    formData.append('projectId', projectId)

    try {
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setItems((prev) =>
              prev.map((i) => i.id === item.id ? { ...i, progress: pct } : i)
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText)
              resolve(json.data as UploadResult)
            } catch {
              reject(new Error('Invalid response'))
            }
          } else {
            try {
              const json = JSON.parse(xhr.responseText)
              reject(new Error(json.error?.message || `Upload failed (${xhr.status})`))
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`))
            }
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error')))
        xhr.open('POST', '/api/upload/documents')
        xhr.send(formData)
      })

      setItems((prev) => {
        const updated = prev.map((i) =>
          i.id === item.id ? { ...i, status: 'success' as const, progress: 100, result } : i
        )
        notifyParent(updated)
        return updated
      })
    } catch (err) {
      setItems((prev) => {
        const updated = prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'error' as const, error: err instanceof Error ? err.message : 'Upload failed' }
            : i
        )
        notifyParent(updated)
        return updated
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, notifyParent, maxSizeMB, accept])

  /* ── Handle new files ────────────────────────────────────── */

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return

    const newItems: FileItem[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as const,
      progress: 0,
    }))

    // If single mode, replace; if multiple, append
    const updatedItems = multiple ? [...items, ...newItems] : newItems
    setItems(updatedItems)

    // Start uploading each
    newItems.forEach((item) => uploadFile(item, updatedItems))
  }

  /* ── Remove file ─────────────────────────────────────────── */

  function removeFile(id: string) {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id)
      notifyParent(updated)
      return updated
    })
  }

  /* ── Retry failed file ───────────────────────────────────── */

  function retryFile(id: string) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    const resetItem = { ...item, status: 'queued' as const, progress: 0, error: undefined }
    const updated = items.map((i) => i.id === id ? resetItem : i)
    setItems(updated)
    uploadFile(resetItem, updated)
  }

  /* ── Drop handlers ───────────────────────────────────────── */

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  /* ── Counts ──────────────────────────────────────────────── */

  const successCount = items.filter((i) => i.status === 'success').length
  const uploadingCount = items.filter((i) => i.status === 'uploading' || i.status === 'queued').length
  const errorCount = items.filter((i) => i.status === 'error').length

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div>
      <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
        {label}
        {successCount > 0 && (
          <span className="ml-2 text-emerald-600 normal-case font-normal">
            {successCount} file{successCount !== 1 ? 's' : ''} attached
          </span>
        )}
      </label>

      {/* ── Drop zone (always visible) ───────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
          dragOver
            ? 'border-accent-400 bg-accent-50'
            : 'border-ink-200 bg-surface-50 hover:border-ink-300 hover:bg-ink-50',
        )}
      >
        <Upload className={cn('w-5 h-5', dragOver ? 'text-accent-500' : 'text-ink-300')} />
        <div className="text-center">
          <p className="text-[13px] font-medium text-ink-600">
            {dragOver ? 'Drop files here' : 'Drag and drop or click to browse'}
          </p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-1">
            {FILE_CATEGORIES.map((cat) => (
              <span key={cat.label} className="text-[10px] text-ink-400">
                <span className="font-medium text-ink-500">{cat.label}:</span> {cat.exts}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-ink-300 mt-1">Max {maxSizeMB}MB per file</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* ── File list ────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {items.map((item) => {
            const FileIcon = getFileIcon(item.file.name)
            const fileColor = getFileColor(item.file.name)
            const ext = item.file.name.split('.').pop()?.toUpperCase() ?? ''

            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                  item.status === 'success' && 'border-emerald-200 bg-emerald-50/50',
                  item.status === 'error' && 'border-red-200 bg-red-50/50',
                  (item.status === 'uploading' || item.status === 'queued') && 'border-ink-200 bg-white',
                )}
              >
                {/* Icon */}
                <FileIcon className={cn('w-4 h-4 shrink-0', fileColor)} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-medium text-ink-800 truncate">
                      {item.file.name}
                    </p>
                    <span className="text-[10px] text-ink-400 shrink-0">
                      {formatFileSize(item.file.size)}
                    </span>
                    {ext && (
                      <span className={cn(
                        'text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0',
                        item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500',
                      )}>
                        {ext}
                      </span>
                    )}
                  </div>

                  {/* Progress bar for uploading */}
                  {(item.status === 'uploading' || item.status === 'queued') && (
                    <div className="mt-1 h-1 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {item.status === 'error' && item.error && (
                    <p className="text-[11px] text-red-600 mt-0.5">{item.error}</p>
                  )}
                </div>

                {/* Status icon / actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'uploading' && (
                    <Loader2 className="w-4 h-4 text-accent-500 animate-spin" />
                  )}
                  {item.status === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  {item.status === 'error' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); retryFile(item.id) }}
                      className="p-1 rounded text-red-500 hover:bg-red-100 transition-colors"
                      title="Retry"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Remove button — always available */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(item.id) }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      item.status === 'success'
                        ? 'text-emerald-500 hover:text-red-500 hover:bg-emerald-100'
                        : item.status === 'error'
                          ? 'text-red-400 hover:text-red-600 hover:bg-red-100'
                          : 'text-ink-400 hover:text-ink-600 hover:bg-ink-50',
                    )}
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Summary bar */}
          {items.length > 1 && (
            <div className="flex items-center justify-between px-3 py-1.5 text-[11px]">
              <span className="text-ink-400">
                {items.length} file{items.length !== 1 ? 's' : ''}
                {uploadingCount > 0 && ` · ${uploadingCount} uploading`}
                {errorCount > 0 && <span className="text-red-500"> · {errorCount} failed</span>}
              </span>
              {items.length > 0 && (
                <button
                  onClick={() => {
                    setItems([])
                    notifyParent([])
                    if (inputRef.current) inputRef.current.value = ''
                  }}
                  className="text-ink-400 hover:text-red-500 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
