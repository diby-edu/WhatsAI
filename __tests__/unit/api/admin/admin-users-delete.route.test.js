const { TextDecoder, TextEncoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')
const { Blob, File } = require('buffer')
const { MessageChannel, MessagePort } = require('worker_threads')

global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder
global.ReadableStream = ReadableStream
global.WritableStream = WritableStream
global.TransformStream = TransformStream
global.Blob = Blob
global.File = File
global.MessageChannel = MessageChannel
global.MessagePort = MessagePort

const { Request, Response, Headers, FormData } = require('undici')

global.Request = Request
global.Response = Response
global.Headers = Headers
global.FormData = FormData

const { NextRequest } = require('next/server')

const mockCreateApiClient = jest.fn()
const mockCreateAdminClient = jest.fn()
const mockGetAuthUser = jest.fn()
const mockLogAdminAction = jest.fn()

jest.mock('@/lib/api-utils', () => ({
    createApiClient: (...args) => mockCreateApiClient(...args),
    createAdminClient: (...args) => mockCreateAdminClient(...args),
    getAuthUser: (...args) => mockGetAuthUser(...args),
    errorResponse: (message, status = 400) => Response.json({ error: message }, { status }),
    successResponse: (data, status = 200) => Response.json({ success: true, data }, { status }),
    logAdminAction: (...args) => mockLogAdminAction(...args),
}))

const { DELETE } = require('@/app/api/admin/users/[id]/route')

function buildAdminClient() {
    const deleteUser = jest.fn(async () => ({ error: null }))

    const from = jest.fn((table) => {
        if (table !== 'profiles') {
            throw new Error(`Unexpected table: ${table}`)
        }

        return {
            select: jest.fn(() => ({
                eq: jest.fn((column, value) => ({
                    single: jest.fn(async () => {
                        if (column !== 'id') {
                            throw new Error(`Unexpected column: ${column}`)
                        }

                        if (value === 'admin-1') {
                            return { data: { role: 'superadmin' }, error: null }
                        }

                        if (value === 'target-1') {
                            return {
                                data: { id: 'target-1', email: 'client@example.com', role: 'user' },
                                error: null,
                            }
                        }

                        return { data: null, error: { message: 'not found' } }
                    }),
                })),
            })),
        }
    })

    return {
        from,
        auth: {
            admin: {
                deleteUser,
            },
        },
        deleteUser,
    }
}

describe('DELETE /api/admin/users/[id]', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockCreateApiClient.mockResolvedValue({})
        mockGetAuthUser.mockResolvedValue({ user: { id: 'admin-1' }, error: null })
    })

    test('hard deletes the auth user so cascades can remove agents', async () => {
        const adminClient = buildAdminClient()
        mockCreateAdminClient.mockReturnValue(adminClient)

        const request = new NextRequest('http://localhost/api/admin/users/target-1', { method: 'DELETE' })
        const response = await DELETE(request, { params: Promise.resolve({ id: 'target-1' }) })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(adminClient.deleteUser).toHaveBeenCalledWith('target-1')
        expect(json).toEqual({
            success: true,
            data: {
                message: 'Utilisateur et donnees liees supprimes',
                deleted_user_id: 'target-1',
            },
        })
        expect(mockLogAdminAction).toHaveBeenCalledWith(
            'admin-1',
            'delete_user',
            'target-1',
            'profile',
            expect.objectContaining({
                email: 'client@example.com',
                deleted_via: 'auth.admin.deleteUser',
            })
        )
    })

    test('refuses deleting the current admin account', async () => {
        const adminClient = buildAdminClient()
        mockCreateAdminClient.mockReturnValue(adminClient)

        const request = new NextRequest('http://localhost/api/admin/users/admin-1', { method: 'DELETE' })
        const response = await DELETE(request, { params: Promise.resolve({ id: 'admin-1' }) })
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json).toEqual({ error: 'Impossible de supprimer votre propre compte' })
        expect(adminClient.deleteUser).not.toHaveBeenCalled()
    })
})
