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
import carrierRepo from '../../repositories/CarrierRepository.js';
import { AppError } from '../../errors/AppError.js';

/**
 * Compare quotes and select the best one based on criteria.
 * Fetches live carrier reliability scores from the DB (carriers.reliability_score)
 * and falls back to industry-standard defaults when no DB record exists.
 *
 * @param {Array} quotes - Array of quotes from carriers
 * @param {Object} criteria - Selection criteria
 * @returns {Object} Best quote with scores
 */
export async function selectBestQuote(quotes, criteria = {}) {
  if (quotes.length === 0) {
    throw new AppError('No quotes available to select from', 422);
  }

  const {
    prioritizePrice = 0.5,    // 50% weight to price
    prioritizeSpeed = 0.3,     // 30% weight to delivery speed
    reliabilityWeight = 0.2    // 20% weight to carrier reliability
  } = criteria;

  // Fetch carrier reliability scores from DB in one query (by code)
  const uniqueCodes = [...new Set(quotes.map(q => q.carrierCode).filter(Boolean))];
  const scoresMap = uniqueCodes.length > 0
    ? await carrierRepo.findReliabilityScoresByCode(uniqueCodes)
    : {};

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

    // Reliability score — from DB (live); fallback to industry defaults
    const FALLBACK_SCORES = { DHL: 0.95, FEDEX: 0.92, BLUEDART: 0.90, DELHIVERY: 0.85 };
    const reliabilityScore = scoresMap[quote.carrierCode]
      ?? FALLBACK_SCORES[quote.carrierCode]
      ?? 0.80;

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
 * Get carrier reliability score.
 * Queries the carriers table; falls back to industry-standard defaults.
 * Returns a Promise — await at call site.
 *
 * @param {String} carrierCode - Carrier code (DHL, FEDEX, etc.)
 * @returns {Promise<Number>} Reliability score between 0 and 1
 */
export async function getCarrierReliabilityScore(carrierCode) {
  try {
    const score = await carrierRepo.findReliabilityScoreByCode(carrierCode);
    if (score !== null) return score;
  } catch (err) {
    logger.warn('Could not fetch carrier reliability score from DB, using fallback', { carrierCode, err: err.message });
  }
  // Fallback: industry-standard estimates
  const FALLBACK = { DHL: 0.95, FEDEX: 0.92, BLUEDART: 0.90, DELHIVERY: 0.85 };
  return FALLBACK[carrierCode] ?? 0.80;
}

export default {
  selectBestQuote,
  getCarrierReliabilityScore
};
