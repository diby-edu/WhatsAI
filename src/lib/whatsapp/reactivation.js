function shouldRequestWhatsAppReconnect(agent) {
    return agent?.is_active === false && (
        agent?.whatsapp_connected === true ||
        agent?.whatsapp_status === 'connected'
    )
}

function collectReconnectableAgentIds(agents) {
    if (!Array.isArray(agents)) {
        return []
    }

    return agents
        .filter(shouldRequestWhatsAppReconnect)
        .map(agent => agent.id)
}

module.exports = {
    collectReconnectableAgentIds,
    shouldRequestWhatsAppReconnect,
}
