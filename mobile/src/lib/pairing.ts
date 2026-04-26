// Parsers for the voicebox:// pair URL scheme. The desktop UI generates
// these as QR codes; the mobile app accepts them via QR scan or manual paste.

export type PairPayload = {
  host: string;
  token: string;
};

const SCHEME_RE = /^voicebox:\/\/pair\?(.+)$/;

export function parsePairUrl(input: string): PairPayload | null {
  const trimmed = input.trim();
  const match = trimmed.match(SCHEME_RE);
  if (!match) return null;
  const params = new URLSearchParams(match[1]);
  const host = params.get('host');
  const token = params.get('token');
  if (!host || !token) return null;
  return { host, token };
}
