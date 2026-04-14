const CALENDAR_MCP_URL = 'https://calendarmcp.googleapis.com/mcp/v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const eventDetails = req.body;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Create a Google Calendar event with these details: ${JSON.stringify(eventDetails)}`,
          },
        ],
        mcp_servers: [
          { type: 'url', url: CALENDAR_MCP_URL, name: 'google-calendar' },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      console.error('[schedule-investigation] Anthropic API error', anthropicRes.status, body);
      let message = body;
      try { message = JSON.parse(body)?.error?.message ?? body; } catch {}
      return res.status(anthropicRes.status).json({ error: `Anthropic ${anthropicRes.status}: ${message}` });
    }

    const data = await anthropicRes.json();
    console.log('[schedule-investigation] Success:', JSON.stringify(data).slice(0, 200));
    return res.status(200).json(data);
  } catch (err) {
    console.error('[schedule-investigation] Unexpected error:', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
}
