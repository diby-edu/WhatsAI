function buildInboundTextVariants(text = '', quotedText = null) {
    const structuredText = String(text || '').trim()
    let aiText = structuredText

    if (quotedText) {
        const quotedPreview = String(quotedText).trim().slice(0, 300)
        aiText = `[En réponse à: "${quotedPreview}"]\n${structuredText}`
    }

    return {
        structuredText,
        aiText,
    }
}

module.exports = { buildInboundTextVariants }
