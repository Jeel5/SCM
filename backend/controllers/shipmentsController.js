const listShipments = (req, res) => {
  res.status(200).json({ ok: true, route: 'shipments:list' });
};

const getShipmentTimeline = (req, res) => {
  res.status(200).json({ ok: true, route: 'shipments:timeline', id: req.params.id });
};

export { listShipments, getShipmentTimeline };
