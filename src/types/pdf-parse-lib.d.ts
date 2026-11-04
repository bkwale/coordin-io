declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdfParse: (data: Uint8Array, opts?: Record<string, unknown>) => Promise<{ numpages: number; text: string }>
  export default pdfParse
}
