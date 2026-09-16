import env from "../../config/env.js";
import AppError from "../../errors/AppError.js";

export const NOMINATIM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const NOMINATIM_CACHE_MAX_ENTRIES = 500;
export const NOMINATIM_MIN_INTERVAL_MS = 1100;

const unavailable = () => new AppError(
  503,
  "El servicio de geolocalización no está disponible en este momento.",
);

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeKeyPart(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function parseCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function parseBoundingBox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const south = parseCoordinate(value[0], -90, 90);
  const north = parseCoordinate(value[1], -90, 90);
  const west = parseCoordinate(value[2], -180, 180);
  const east = parseCoordinate(value[3], -180, 180);
  if ([south, north, west, east].some((coordinate) => coordinate === null) || south > north || west > east) {
    return null;
  }
  return { south, north, west, east };
}

function normalizeMatches(payload) {
  if (!Array.isArray(payload)) throw unavailable();
  return payload.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const latitude = parseCoordinate(item.lat, -90, 90);
    const longitude = parseCoordinate(item.lon, -180, 180);
    if (latitude === null || longitude === null) return [];
    return [{
      latitude,
      longitude,
      displayName: typeof item.display_name === "string" ? item.display_name : "",
      boundingBox: parseBoundingBox(item.boundingbox),
    }];
  });
}

export class MemoryGeocodingCache {
  constructor({ ttlMs = NOMINATIM_CACHE_TTL_MS, maxEntries = NOMINATIM_CACHE_MAX_ENTRIES, clock = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.clock = clock;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.clock()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return structuredClone(entry.value);
  }

  set(key, value) {
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, { value: structuredClone(value), expiresAt: this.clock() + this.ttlMs });
  }
}

export class GlobalRequestScheduler {
  constructor({ intervalMs = NOMINATIM_MIN_INTERVAL_MS, clock = Date.now, sleep = defaultSleep } = {}) {
    this.intervalMs = intervalMs;
    this.clock = clock;
    this.sleep = sleep;
    this.nextStart = 0;
    this.tail = Promise.resolve();
  }

  schedule(task) {
    const run = this.tail.then(async () => {
      const delay = Math.max(0, this.nextStart - this.clock());
      if (delay > 0) await this.sleep(delay);
      this.nextStart = this.clock() + this.intervalMs;
      return task();
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
}

export function createNominatimClient({
  baseUrl = env.NOMINATIM_BASE_URL,
  userAgent = env.NOMINATIM_USER_AGENT,
  timeoutMs = env.NOMINATIM_TIMEOUT_MS,
  fetchImpl = (...args) => globalThis.fetch(...args),
  cache = new MemoryGeocodingCache(),
  scheduler = new GlobalRequestScheduler(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const inFlight = new Map();

  async function request(address) {
    const url = new URL(`${baseUrl.replace(/\/+$/, "")}/search`);
    const addressLine = [address.streetNumber, address.street].filter(Boolean).join(" ");
    url.searchParams.set("q", [addressLine, address.city, address.province, address.country].join(", "));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "ar");

    return scheduler.schedule(async () => {
      const controller = new AbortController();
      const timer = setTimer(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Accept-Language": "es",
            "User-Agent": userAgent,
          },
          signal: controller.signal,
        });
        if (!response?.ok) throw unavailable();
        return normalizeMatches(await response.json());
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw unavailable();
      } finally {
        clearTimer(timer);
      }
    });
  }

  return {
    async geocode(address) {
      const key = [address.cityId, address.street, address.streetNumber].map(normalizeKeyPart).join("|");
      const cached = cache.get(key);
      if (cached !== undefined) return { matches: cached };
      if (inFlight.has(key)) return inFlight.get(key);

      const pending = request(address)
        .then((matches) => {
          cache.set(key, matches);
          return { matches };
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
      return pending;
    },
  };
}

export default createNominatimClient();
