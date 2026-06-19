

interface NativeCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expires?: string;
}

let cookieManager: any = null;
export const getCookieManager = () => {
  if (cookieManager) {
    return cookieManager;
  }
  try {
    cookieManager = require('@preeternal/react-native-cookie-manager').default;
  } catch (e) {
    console.warn('[cookieManager] native module unavailable', e);
    cookieManager = null;
  }
  return cookieManager;
};

// Case-insensitive lookup of the User-Agent from a headers object.
export const pickUserAgent = (
  h?: Record<string, string>,
): string | undefined => {
  if (!h) {
    return undefined;
  }
  const key = Object.keys(h).find(k => k.toLowerCase() === 'user-agent');
  return key ? h[key] : undefined;
};


export const getCookieObjects = async (
  url: string,
): Promise<NativeCookie[]> => {
  const CookieManager = getCookieManager();
  if (!CookieManager) {
    return [];
  }
  try {
    await CookieManager.flush();
  } catch {}
  const stores = await Promise.all([
    CookieManager.get(url, true).catch(() => ({})),
    CookieManager.get(url, false).catch(() => ({})),
  ]);
  const byName: Record<string, NativeCookie> = {};
  for (const store of stores) {
    for (const key of Object.keys(store)) {
      const cookie = store[key] as NativeCookie;
      if (cookie?.name) {
        byName[cookie.name] = cookie;
      }
    }
  }
  return Object.values(byName);
};

// Reads cookies for `url` as a name -> value map.
export const getCookies = async (
  url: string,
): Promise<Record<string, string>> => {
  const objects = await getCookieObjects(url);
  const map: Record<string, string> = {};
  for (const cookie of objects) {
    map[cookie.name] = cookie.value;
  }
  return map;
};

// Builds a Cookie header value from a name -> value map.
export const buildCookieString = (map: Record<string, string>): string =>
  Object.entries(map)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

