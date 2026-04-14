export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { summary, start, end, description, attendees = [] } = req.body;

    // Convert ISO datetime (YYYY-MM-DDTHH:MM:00) → GCal format (YYYYMMDDTHHMMSS)
    function toGCalDate(iso) {
      return iso.replace(/[-:]/g, '').slice(0, 15);
    }

    const params = new URLSearchParams({
      action:  'TEMPLATE',
      text:    summary,
      dates:   `${toGCalDate(start.dateTime)}/${toGCalDate(end.dateTime)}`,
      details: description,
      ctz:     start.timeZone ?? 'Europe/London',
    });

    if (attendees.length > 0) {
      params.set('add', attendees.map(a => a.email).join(','));
    }

    const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
    return res.status(200).json({ url });
  } catch (err) {
    console.error('[schedule-investigation]', err);
    return res.status(500).json({ error: err.message ?? 'Failed to build calendar URL' });
  }
}
