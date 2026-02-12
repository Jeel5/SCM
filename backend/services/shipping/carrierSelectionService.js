/**
 * Carrier Selection Service
 * 
 * Responsibility: Select the best carrier from available quotes
 * - Compare quotes based on price, speed, and reliability
 * - Calculate weighted scores
 * - Apply selection criteria
 * - Get carrier reliability metrics
 */

import logger from '../../utils/logger.js';

/**
 * Compare quotes and select the best one based on criteria
 * 
 * @param {Array} quotes - Array of quotes from carriers
 * @param {Object} criteria - Selection criteria
 * @param {Number} criteria.prioritizePrice - Weight for price (default 0.5)
 * @param {Number} criteria.prioritizeSpeed - Weight for speed (default 0.3)
 * @param {Number} criteria.reliabilityWeight - Weight for reliability (default 0.2)
 * @returns {Object} Best quote with scores
 */
export function selectBestQuote(quotes, criteria = {}) {
  if (quotes.length === 0) {
    throw new Error('No quotes available to select from');
  }

  const {
    prioritizePrice = 0.5,    // 50% weight to price
    prioritizeSpeed = 0.3,     // 30% weight to delivery speed
    reliabilityWeight = 0.2    // 20% weight to carrier reliability
  } = criteria;

  // Calculate scores for each quote
  const quotesWithScores = quotes.map(quote => {
    // Normalize price (lower is better) - inverse scoring
    const maxPrice = Math.max(...quotes.map(q => q.quotedPrice));
    const minPrice = Math.min(...quotes.map(q => q.quotedPrice));
    const priceScore = maxPrice === minPrice ? 1 : 
      (maxPrice - quote.quotedPrice) / (maxPrice - minPrice);

    // Normalize delivery days (faster is better) - inverse scoring
    const maxDays = Math.max(...quotes.map(q => q.estimatedDeliveryDays));
    const minDays = Math.min(...quotes.map(q => q.estimatedDeliveryDays));
    const speedScore = maxDays === minDays ? 1 :
      (maxDays - quote.estimatedDeliveryDays) / (maxDays - minDays);

    // Reliability score (from historical data)
    const reliabilityScore = getCarrierReliabilityScore(quote.carrierCode);

    // Calculate weighted score
    const totalScore = 
      (priceScore * prioritizePrice) +
      (speedScore * prioritizeSpeed) +
      (reliabilityScore * reliabilityWeight);

    return {
      ...quote,
      scores: {
        price: priceScore,
        speed: speedScore,
        reliability: reliabilityScore,
        total: totalScore
      }
    };
  });

  // Sort by total score (highest first)
  quotesWithScores.sort((a, b) => b.scores.total - a.scores.total);

  const bestQuote = quotesWithScores[0];
  
  logger.info('Selected best carrier quote', {
    carrier: bestQuote.carrierName,
    price: bestQuote.quotedPrice,
    days: bestQuote.estimatedDeliveryDays,
    score: bestQuote.scores.total
  });

  return bestQuote;
}

/**
 * Get carrier reliability score from historical data
 * In production, this would query actual performance metrics
 * 
 * @param {String} carrierCode - Carrier code (DHL, FEDEX, etc.)
 * @returns {Number} Reliability score between 0 and 1
 */
export function getCarrierReliabilityScore(carrierCode) {
  // Simulated reliability scores based on industry reputation
  const reliabilityMap = {
    'DHL': 0.95,
    'FEDEX': 0.92,
    'BLUEDART': 0.90,
    'DELHIVERY': 0.85,
    'DEFAULT': 0.80
  };

  return reliabilityMap[carrierCode] || reliabilityMap['DEFAULT'];
}

export default {
  selectBestQuote,
  getCarrierReliabilityScore
};
