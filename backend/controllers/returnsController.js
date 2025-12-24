const listReturns = (req, res) => {
  res.status(200).json({ ok: true, route: 'returns:list' });
};

export { listReturns };
