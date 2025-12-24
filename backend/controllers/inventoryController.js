const getInventory = (req, res) => {
  res.status(200).json({ ok: true, route: 'inventory:list' });
};

export { getInventory };
