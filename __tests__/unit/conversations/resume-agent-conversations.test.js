const { resumeActiveConversationsForAgents } = require('../../../src/lib/conversations/resume-agent-conversations')

describe('resumeActiveConversationsForAgents', () => {
    test('returns zero when no valid agent ids are provided', async () => {
        const adminSupabase = {
            from: jest.fn()
        }

        await expect(
            resumeActiveConversationsForAgents(adminSupabase, [null, undefined, '', '   '])
        ).resolves.toEqual({ resumedCount: 0 })

        expect(adminSupabase.from).not.toHaveBeenCalled()
    })

    test('unpauses active paused conversations for the provided agents', async () => {
        const selectEqBotPaused = jest.fn().mockResolvedValue({
            data: [{ id: 'conv-1' }, { id: 'conv-2' }],
            error: null
        })
        const selectEqStatus = jest.fn(() => ({
            eq: selectEqBotPaused
        }))
        const selectInAgent = jest.fn(() => ({
            eq: selectEqStatus
        }))
        const selectSelect = jest.fn(() => ({
            in: selectInAgent
        }))

        const updateInIds = jest.fn().mockResolvedValue({ error: null })
        const updateUpdate = jest.fn(() => ({
            in: updateInIds
        }))

        const adminSupabase = {
            from: jest.fn()
                .mockImplementationOnce(() => ({
                    select: selectSelect
                }))
                .mockImplementationOnce(() => ({
                    update: updateUpdate
                }))
        }

        await expect(
            resumeActiveConversationsForAgents(adminSupabase, ['agent-1', 'agent-1', 'agent-2'])
        ).resolves.toEqual({ resumedCount: 2 })

        expect(selectSelect).toHaveBeenCalledWith('id')
        expect(selectInAgent).toHaveBeenCalledWith('agent_id', ['agent-1', 'agent-2'])
        expect(selectEqStatus).toHaveBeenCalledWith('status', 'active')
        expect(selectEqBotPaused).toHaveBeenCalledWith('bot_paused', true)
        expect(updateUpdate).toHaveBeenCalledWith({ bot_paused: false })
        expect(updateInIds).toHaveBeenCalledWith('id', ['conv-1', 'conv-2'])
    })

    test('does not issue an update when no paused conversations are found', async () => {
        const selectEqBotPaused = jest.fn().mockResolvedValue({
            data: [],
            error: null
        })
        const selectEqStatus = jest.fn(() => ({
            eq: selectEqBotPaused
        }))
        const selectInAgent = jest.fn(() => ({
            eq: selectEqStatus
        }))
        const selectSelect = jest.fn(() => ({
            in: selectInAgent
        }))

        const adminSupabase = {
            from: jest.fn().mockImplementationOnce(() => ({
                select: selectSelect
            }))
        }

        await expect(
            resumeActiveConversationsForAgents(adminSupabase, ['agent-1'])
        ).resolves.toEqual({ resumedCount: 0 })

        expect(adminSupabase.from).toHaveBeenCalledTimes(1)
    })
})
