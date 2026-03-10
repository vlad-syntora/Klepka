const APPEXCHANGE_API = 'https://api.appexchange.salesforce.com/partners/experience/listings';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing id' });
  }

  const upstream = await fetch(`${APPEXCHANGE_API}/${id}`);

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: `Upstream error: ${upstream.status}` });
  }

  const data = await upstream.json();

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json(data);
}
