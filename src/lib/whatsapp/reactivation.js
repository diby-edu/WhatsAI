function hasAgentConnectedBefore(agent) {
    return agent?.whatsapp_ever_connected === true || agent?.whatsapp_connected === true || !!agent?.whatsapp_phone
}

function shouldRequestWhatsAppReconnect(agent) {
    return agent?.is_active === false && hasAgentConnectedBefore(agent)
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
