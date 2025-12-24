const listJobs = (req, res) => {
  res.status(200).json({ ok: true, route: 'jobs:list' });
};

export { listJobs };
