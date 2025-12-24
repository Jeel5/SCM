const listUsers = (req, res) => {
  res.status(200).json({ ok: true, route: 'users:list' });
};

const listRoles = (req, res) => {
  res.status(200).json({ ok: true, route: 'roles:list' });
};

export { listUsers, listRoles };
