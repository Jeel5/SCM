// PostalZoneRepository — lookup helpers for postal_zones and zone_distances tables.
import BaseRepository from './BaseRepository.js';

class PostalZoneRepository extends BaseRepository {
  constructor() {
    super('postal_zones');
  }

  /**
   * Fetch zone records for an array of pincode strings.
   * Returns rows with { pincode, zone_code, lat, lon }.
   *
   * @param {string[]} pincodes
   * @param {object|null} client
   * @returns {Promise<Array>}
   */
  async findByPincodes(pincodes, client = null) {
    const result = await this.query(
      `SELECT pincode, zone_code, lat, lon
       FROM postal_zones
       WHERE pincode = ANY($1)`,
      [pincodes], client
    );
    return result.rows;
  }

  /**
   * Return the road distance (km) between two zone codes, or null when unknown.
   *
   * @param {string} fromZone
   * @param {string} toZone
   * @param {object|null} client
   * @returns {Promise<number|null>}
   */
  async findZoneDistance(fromZone, toZone, client = null) {
    const result = await this.query(
      `SELECT distance_km
       FROM zone_distances
       WHERE from_zone = $1 AND to_zone = $2`,
      [fromZone, toZone], client
    );
    return result.rows.length > 0 ? result.rows[0].distance_km : null;
  }
}

export default new PostalZoneRepository();
