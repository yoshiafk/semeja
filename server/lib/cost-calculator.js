const { convertToWeight } = require('./units');

/**
 * Calculates the estimated cost for a single meal based on its ingredients and participants.
 * 
 * @param {object} meal - Meal object (must have requires_rice flag)
 * @param {Array} ingredients - List of ingredients for this meal (each must have quantity_per_person, price_per_unit, name, possibly unit/base_unit)
 * @param {number} participantCount - Number of participants
 * @param {number} ricePricePerUnit - Price per kg of rice (optional, from ingredients table)
 * @returns {number} - Total estimated cost for the meal
 */
function calculateMealEstimate(meal, ingredients, participantCount, ricePricePerUnit = 0) {
  if (participantCount === 0) return 0;
  
  let totalCost = 0;
  
  // 1. Process standard ingredients
  ingredients.forEach(ing => {
    // If we're handling rice separately, skip 'Beras' if it's already in the ingredients list
    if (ing.name === 'Beras') return;

    const qty = (parseFloat(ing.quantity_per_person) || 0) * participantCount;
    // convertToWeight handles unit matching and ingredient context
    const weight = convertToWeight(qty, ing.unit || ing.base_unit || 'secukupnya', ing.name);
    totalCost += weight * (parseFloat(ing.price_per_unit) || 0);
  });
  
  // 2. Add Rice (Beras) if required for this meal
  if (meal.requires_rice && ricePricePerUnit > 0) {
    // 150g (0.15kg) is the standard dry weight per person
    totalCost += 0.15 * participantCount * ricePricePerUnit;
  }
  
  return Math.round(totalCost);
}

module.exports = { calculateMealEstimate };
