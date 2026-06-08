export async function renderWithPlaywright(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AwesomeGenieBot/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}
