const listOrders = (req, res) => {
  res.status(200).json({ ok: true, route: 'orders:list' });
};

export { listOrders };
