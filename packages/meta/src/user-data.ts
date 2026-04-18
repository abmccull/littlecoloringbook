import type { NormalizedUserData, RawUserData } from "./types";
import { normalizeEmail, normalizeGender, normalizeLocation, normalizeDob, normalizeName, normalizePhone } from "./pii";

function toArray<T>(value: T | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return [value];
}

export function buildNormalizedUserData(raw: RawUserData): NormalizedUserData {
  const em = toArray(normalizeEmail(raw.email)).filter(Boolean) as string[];
  const ph = toArray(normalizePhone(raw.phone)).filter(Boolean) as string[];
  const fn = toArray(normalizeName(raw.firstName)).filter(Boolean) as string[];
  const ln = toArray(normalizeName(raw.lastName)).filter(Boolean) as string[];
  const db = toArray(normalizeDob(raw.dateOfBirth)).filter(Boolean) as string[];
  const ge = toArray(normalizeGender(raw.gender)).filter(Boolean) as string[];
  const ct = toArray(normalizeLocation(raw.city)).filter(Boolean) as string[];
  const st = toArray(normalizeLocation(raw.state)).filter(Boolean) as string[];
  const zp = toArray(normalizeLocation(raw.zip)).filter(Boolean) as string[];
  const country = toArray(normalizeLocation(raw.country)).filter(Boolean) as string[];
  const external_id = toArray(raw.externalId).filter(Boolean) as string[];

  const result: NormalizedUserData = {};
  if (em.length > 0) result.em = em;
  if (ph.length > 0) result.ph = ph;
  if (fn.length > 0) result.fn = fn;
  if (ln.length > 0) result.ln = ln;
  if (db.length > 0) result.db = db;
  if (ge.length > 0) result.ge = ge;
  if (ct.length > 0) result.ct = ct;
  if (st.length > 0) result.st = st;
  if (zp.length > 0) result.zp = zp;
  if (country.length > 0) result.country = country;
  if (external_id.length > 0) result.external_id = external_id;
  if (raw.fbp) result.fbp = raw.fbp;
  if (raw.fbc) result.fbc = raw.fbc;
  if (raw.clientIpAddress) result.client_ip_address = raw.clientIpAddress;
  if (raw.clientUserAgent) result.client_user_agent = raw.clientUserAgent;

  return result;
}
