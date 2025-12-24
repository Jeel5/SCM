const listSlaPolicies = (req, res) => {
  res.status(200).json({ ok: true, route: 'sla:list' });
};

const getEta = (req, res) => {
  res.status(200).json({ ok: true, route: 'eta:get' });
};

export { listSlaPolicies, getEta };
