/**
 * Analyze Sentiment of a message
 * @param {Object} openai OpenAI Instance
 * @param {string} text Message text
 * @returns {Promise<Object>} { sentiment, is_urgent }
 */
async function analyzeSentiment(openai, text) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Analyze the sentiment of this message. Return JSON: { \"sentiment\": \"positive\"|\"neutral\"|\"negative\"|\"angry\", \"is_urgent\": boolean }" },
                { role: "user", content: text }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (e) {
        console.error("Sentiment Analysis Error:", e);
        return { sentiment: "neutral", is_urgent: false };
    }
}

module.exports = { analyzeSentiment }
