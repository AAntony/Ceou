import { verify } from 'node:crypto';
import { Buffer } from 'node:buffer';

/** Preserve URL encoding and parameter order: Google signs the original query bytes. */
export function verifyAdmobQuery(query, pem) {
  const match = /^(.*)&signature=([^&]+)&key_id=(\d+)$/.exec(query);
  if (!match) throw new Error('invalid_signature');
  const params = new URLSearchParams(query);
  if (new Set(params.keys()).size!==[...params.keys()].length) throw new Error('duplicate_parameter');
  if (!verify('sha256', Buffer.from(match[1]), pem, Buffer.from(decodeURIComponent(match[2]), 'base64url'))) throw new Error('invalid_signature');
  return params;
}
