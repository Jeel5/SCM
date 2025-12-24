const listWarehouses = (req, res) => {
  res.status(200).json({ ok: true, route: 'mdm:warehouses:list' });
};

const listCarriers = (req, res) => {
  res.status(200).json({ ok: true, route: 'mdm:carriers:list' });
};

const listProducts = (req, res) => {
  res.status(200).json({ ok: true, route: 'mdm:products:list' });
};

export { listWarehouses, listCarriers, listProducts };
