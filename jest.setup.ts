import '@testing-library/jest-dom'

// E#8 : jsdom (testEnvironment) n'expose pas les Web APIs utilisées par
// next/server (Request/Response/Headers...). Sans ce polyfill, tout test qui
// importe (même transitivement) next/server plante à l'import.
// require() (pas import) : undici lit global.TextDecoder à SON PROPRE chargement
// — l'ordre d'exécution doit être garanti, ce que le hoisting des `import` casse.
const { TextDecoder, TextEncoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')
const { Blob, File } = require('buffer')
const { MessageChannel, MessagePort } = require('worker_threads')

Object.assign(global, {
    TextDecoder,
    TextEncoder,
    ReadableStream,
    WritableStream,
    TransformStream,
    Blob,
    File,
    MessageChannel,
    MessagePort,
})

const { Request, Response, Headers, FormData } = require('undici')

Object.assign(global, { Request, Response, Headers, FormData })
