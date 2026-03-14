import axios from 'axios';
import SalesChannelRepo from '../repositories/SalesChannelRepository.js';
import logger from '../utils/logger.js';

function parseTags(tags) {
  if (!tags) return {};
  if (typeof tags === 'object') return tags;
  try {
    return JSON.parse(tags);
  } catch {
    return {};
  }
}

export async function sendShipmentCallback({ order, shipment, status, location }) {
  const tags = parseTags(order?.tags);
  const sourceChannelId = tags?.source_channel_id;
  const organizationId = order?.organization_id;

  if (!sourceChannelId || !organizationId) return;

  const channel = await SalesChannelRepo.findByIdScoped(sourceChannelId, organizationId);
  if (!channel?.api_endpoint) return;

  const payload = {
    event_type: 'shipment.status_updated',
    occurred_at: new Date().toISOString(),
    data: {
      order_id: order.id,
      order_number: order.order_number,
      external_order_id: order.external_order_id || null,
      shipment_id: shipment.id,
      tracking_number: shipment.tracking_number,
      status,
      location: location || null,
    },
  };

  try {
    await axios.post(channel.api_endpoint, payload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Channel-Code': channel.code,
      },
    });
  } catch (error) {
    logger.warn('Channel callback failed', {
      channelId: channel.id,
      channelCode: channel.code,
      endpoint: channel.api_endpoint,
      shipmentId: shipment.id,
      message: error?.message,
    });
  }
}
