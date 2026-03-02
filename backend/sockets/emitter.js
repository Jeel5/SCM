/**
 * Socket.IO emitter — thin singleton wrapper so any controller/service can
 * fire events without importing the full io instance.
 *
 * Usage:
 *   import { emitToOrg, emitToShipment } from '../sockets/emitter.js';
 *   emitToOrg(organizationId, 'order:created', order);
 *   emitToShipment(shipmentId, 'shipment:location', locationData);
 */

let _io = null;

/** Called once from server.js after Socket.IO is initialised. */
export function setIo(io) {
  _io = io;
}

/**
 * Emit an event to every socket in an organisation's room.
 * Silently no-ops when _io is not yet set or orgId is falsy (e.g. superadmin-only requests).
 */
export function emitToOrg(orgId, event, data) {
  if (!_io || !orgId) return;
  _io.to(`org:${orgId}`).emit(event, data);
}

/**
 * Emit an event to every socket subscribed to a specific shipment room.
 * Used for per-shipment live tracking events.
 */
export function emitToShipment(shipmentId, event, data) {
  if (!_io || !shipmentId) return;
  _io.to(`shipment:${shipmentId}`).emit(event, data);
}
