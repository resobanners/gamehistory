// app/api/igdb/route.js
// Next.js App Router API route — proxies IGDB requests server-side

const CLIENT_ID = '3ajvbfnv0suupl80fxwpxtv1i1z1mj';
const CLIENT_SECRET = 'zckx640ikc49cycya9gz8fpmam3x5g';

let cachedToken = null;
let tokenExpiry = 0;

async function getTwitchToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function POST(request) {
  try {
    const { endpoint, body } = await request.json();
    const token = await getTwitchToken();

    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': CLIENT_ID,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
