export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    throw new Error(
      "Enter a valid time zone, such as Asia/Karachi or America/New_York.",
    );
  }
}

export function storeHoursToday(
  hours: Record<string, string>,
  specialHours: Record<string, string>,
  timezone: string,
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const special = Object.prototype.hasOwnProperty.call(specialHours, date);
  return {
    date,
    special,
    hours: special
      ? specialHours[date]
      : hours[get("weekday").toLowerCase()] || "Not provided",
  };
}

export function parseSpecialHours(text: string): Record<string, string> {
  const output: Record<string, string> = {};
  if (!text.trim()) return output;
  let entries: unknown;
  try {
    entries = JSON.parse(text);
  } catch {
    throw new Error("Special hours must be a JSON object of dates and hours.");
  }
  if (!entries || typeof entries !== "object" || Array.isArray(entries))
    throw new Error("Special hours must be an object.");
  if (Object.keys(entries).length > 366)
    throw new Error("Use at most 366 special dates.");
  for (const [date, hours] of Object.entries(entries)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new Error(`Invalid special date: ${date}`);
    if (
      typeof hours !== "string" ||
      !/^(Closed|\d{2}:\d{2}-\d{2}:\d{2})$/i.test(hours)
    )
      throw new Error(`Use Closed or HH:MM-HH:MM for ${date}.`);
    if (hours.toLowerCase() !== "closed") {
      const parts = hours.split(/[:-]/).map(Number);
      if (parts[0] > 23 || parts[2] > 23 || parts[1] > 59 || parts[3] > 59)
        throw new Error(`Invalid hours for ${date}.`);
    }
    output[date] = hours;
  }
  return output;
}

type HealthLocation = {
  id: string;
  name: string;
  address1: string;
  city: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  email: string;
  website: string;
  geocodeStatus: string;
};
export function locationHealth(locations: HealthLocation[]) {
  const addresses = new Map<string, number>();
  const key = (l: HealthLocation) =>
    [l.address1, l.city, l.postalCode, l.country]
      .join("|")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  for (const l of locations)
    if (l.address1.trim())
      addresses.set(key(l), (addresses.get(key(l)) || 0) + 1);
  return locations
    .map((location) => {
      const issues: string[] = [];
      if (location.lat === null || location.lng === null)
        issues.push("Missing map coordinates");
      if (location.geocodeStatus === "failed")
        issues.push("Address lookup failed");
      if (
        !location.address1.trim() ||
        !location.city.trim() ||
        !location.country.trim()
      )
        issues.push("Incomplete address");
      if (
        !location.phone.trim() &&
        !location.email.trim() &&
        !location.website.trim()
      )
        issues.push("Missing contact details");
      if (location.address1.trim() && (addresses.get(key(location)) || 0) > 1)
        issues.push("Possible duplicate address");
      return { id: location.id, name: location.name, issues };
    })
    .filter((item) => item.issues.length);
}
