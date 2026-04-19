function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getMessageSource(metadata) {
    if (!isObject(metadata)) return null
    return typeof metadata.source === 'string' ? metadata.source : null
}

function getMessageDeliveryVia(metadata) {
    if (!isObject(metadata)) return null
    return typeof metadata.delivery_via === 'string' ? metadata.delivery_via : null
}

function isExternallyTransportedAssistantMessage(message) {
    const metadata = message?.metadata
    const source = getMessageSource(metadata)
    const deliveryVia = getMessageDeliveryVia(metadata)

    return (
        deliveryVia === 'outbound_messages' ||
        source === 'api' ||
        source === 'trigger' ||
        source === 'internal_send_api'
    )
}

module.exports = {
    isExternallyTransportedAssistantMessage,
}
