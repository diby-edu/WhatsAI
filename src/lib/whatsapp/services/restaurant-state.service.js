'use strict'

const { RESTAURANT_STAGE, getRestaurantState, setRestaurantState, clearRestaurantState, hasRestaurantStateData } = require('./restaurant-state/persistence')
const { updateRestaurantStateFromUserMessage } = require('./restaurant-state/stage')
const { inferRestaurantStateFromAssistantMessage } = require('./restaurant-state/inference')
const { buildRestaurantStateGuidance, mergeRestaurantStateIntoToolArgs } = require('./restaurant-state/guidance')

module.exports = {
    RESTAURANT_STAGE,
    buildRestaurantStateGuidance,
    clearRestaurantState,
    getRestaurantState,
    hasRestaurantStateData,
    inferRestaurantStateFromAssistantMessage,
    mergeRestaurantStateIntoToolArgs,
    setRestaurantState,
    updateRestaurantStateFromUserMessage,
}
