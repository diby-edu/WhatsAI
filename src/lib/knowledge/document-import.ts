type ExtractedDocument = {
    text: string
    pages: number | null
    format: 'pdf' | 'docx'
}

type ZipEntry = {
    fileName: string
}

type ZipReadStream = NodeJS.ReadableStream & {
    on(event: 'data', listener: (chunk: Buffer) => void): ZipReadStream
    on(event: 'end', listener: () => void): ZipReadStream
    on(event: 'error', listener: (error: Error) => void): ZipReadStream
}

type ZipFile = {
    readEntry: () => void
    close: () => void
    on: (event: 'entry', listener: (entry: ZipEntry) => void) => void
        & ((event: 'end', listener: () => void) => void)
        & ((event: 'error', listener: (error: Error) => void) => void)
    openReadStream: (entry: ZipEntry, callback: (error: Error | null, stream: ZipReadStream | null) => void) => void
}

type YauzlModule = {
    fromBuffer: (
        buffer: Buffer,
        options: { lazyEntries: boolean },
        callback: (error: Error | null, zipFile: ZipFile | null) => void
    ) => void
}

function decodeXmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
}

function normalizeExtractedText(text: string): string {
    return decodeXmlEntities(text)
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}

function extractTextFromWordXml(xml: string): string {
    const withStructure = xml
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<\/w:p>/g, '\n\n')
        .replace(/<[^>]+>/g, '')

    return normalizeExtractedText(withStructure)
}

function readDocxXmlEntries(buffer: Buffer): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const yauzl = require('yauzl') as YauzlModule
        const xmlParts: string[] = []
        let settled = false

        const finish = (callback: () => void) => {
            if (settled) return
            settled = true
            callback()
        }

        yauzl.fromBuffer(buffer, { lazyEntries: true }, (error: Error | null, zipFile: ZipFile | null) => {
            if (error || !zipFile) {
                finish(() => reject(error || new Error('Impossible de lire le document Word')))
                return
            }

            zipFile.on('entry', (entry: ZipEntry) => {
                const entryName = entry.fileName
                const isRelevantXml = /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(entryName)

                if (!isRelevantXml) {
                    zipFile.readEntry()
                    return
                }

                zipFile.openReadStream(entry, (streamError: Error | null, stream: ZipReadStream | null) => {
                    if (streamError || !stream) {
                        zipFile.close()
                        finish(() => reject(streamError || new Error('Impossible de lire le contenu du document Word')))
                        return
                    }

                    const chunks: Buffer[] = []
                    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
                    stream.on('end', () => {
                        xmlParts.push(Buffer.concat(chunks).toString('utf8'))
                        zipFile.readEntry()
                    })
                    stream.on('error', (streamReadError: Error) => {
                        zipFile.close()
                        finish(() => reject(streamReadError))
                    })
                })
            })

            zipFile.on('end', () => finish(() => resolve(xmlParts)))
            zipFile.on('error', (zipError: Error) => finish(() => reject(zipError)))
            zipFile.readEntry()
        })
    })
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedDocument> {
    const { PDFParse } = require('pdf-parse')
    const parser = new PDFParse({ data: buffer })

    try {
        const textResult = await parser.getText()
        const infoResult = await parser.getInfo().catch(() => null)

        return {
            text: normalizeExtractedText(textResult?.text || ''),
            pages: infoResult?.total ?? null,
            format: 'pdf'
        }
    } finally {
        if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => {})
        }
    }
}

export async function extractDocxText(buffer: Buffer): Promise<ExtractedDocument> {
    const xmlParts = await readDocxXmlEntries(buffer)
    const text = normalizeExtractedText(xmlParts.map(extractTextFromWordXml).join('\n\n'))

    if (!text) {
        throw new Error("Impossible d'extraire le texte de ce document Word")
    }

    return {
        text,
        pages: null,
        format: 'docx'
    }
}
