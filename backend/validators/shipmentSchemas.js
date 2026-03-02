// Shipment validation schemas - defines rules for shipment operations
// IMPORTANT: Status values MUST match SHIPMENT_VALID_TRANSITIONS in services/shipmentService.js

import Joi from 'joi';

// All valid shipment statuses — keep in sync with shipmentService.SHIPMENT_VALID_TRANSITIONS
const SHIPMENT_STATUSES = [
  'pending', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'cancelled', 'exception', 'returned',
];

const locationSchema = Joi.object({
  address: Joi.string(),
  city: Joi.string().required(),
  state: Joi.string(),
  postal_code: Joi.string(),
  country: Joi.string().required()
});

export const createShipmentSchema = Joi.object({
  order_id: Joi.string().required(),
  tracking_number: Joi.string().min(5).max(100),
  carrier_id: Joi.string().required(),
  carrier_name: Joi.string().min(2).max(255).required(),
  service_type: Joi.string().valid('express', 'standard', 'economy', 'overnight', 'two_day'),
  status: Joi.string().valid(...SHIPMENT_STATUSES),
  origin: locationSchema.required(),
  destination: locationSchema.required(),
  estimated_delivery: Joi.date().iso(),
  actual_delivery: Joi.date().iso(),
  weight: Joi.number().min(0),
  dimensions: Joi.object({
    length: Joi.number().min(0),
    width: Joi.number().min(0),
    height: Joi.number().min(0),
    unit: Joi.string().valid('cm', 'in')
  }),
  cost: Joi.number().min(0)
});

export const updateShipmentStatusSchema = Joi.object({
  status: Joi.string().valid(...SHIPMENT_STATUSES).required(),
  location: Joi.object({
    city: Joi.string(),
    state: Joi.string(),
    country: Joi.string(),
    coordinates: Joi.object({
      latitude: Joi.number(),
      longitude: Joi.number()
    })
  }),
  notes: Joi.string().max(1000),
  actual_delivery: Joi.date().iso()
});

export const listShipmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...SHIPMENT_STATUSES),
  carrier_id: Joi.string(),
  search: Joi.string().max(100)
});
