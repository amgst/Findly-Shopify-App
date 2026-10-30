const MAX_SHEET_BYTES = 5 * 1024 * 1024;

export function normalizeSheetUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password ||
      !/^\/spreadsheets\/d\/(?:e\/)?[a-zA-Z0-9_-]+(?:\/|$)/.test(url.pathname)) {
    throw new Error("Use an HTTPS Google Sheets link from docs.google.com/spreadsheets/d/.");
  }
  const id = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)![1];
  if (id !== "e") {
    const gid = url.searchParams.get("gid") || new URLSearchParams(url.hash.slice(1)).get("gid");
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid && /^\d+$/.test(gid) ? `&gid=${gid}` : ""}`;
  }
  url.searchParams.set("output", "csv");
  url.hash = "";
  return url.toString();
}

/** Follow only Google-owned download hosts; never follow redirects to arbitrary URLs. */
export async function fetchSheetCsv(raw: string) {
  let url = new URL(normalizeSheetUrl(raw));
  const signal = AbortSignal.timeout(15_000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    if (url.protocol !== "https:" || url.port || url.username || url.password ||
        !(url.hostname === "docs.google.com" || url.hostname === "googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com"))) {
      throw new Error("The sheet redirected to an unsupported host.");
    }
    const response = await fetch(url, { redirect: "manual", signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!next) throw new Error("The sheet returned an invalid redirect.");
      url = new URL(next, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Couldn't read the sheet (HTTP ${response.status}). Share it as anyone with the link can view.`);
    }
    if (Number(response.headers.get("content-length")) > MAX_SHEET_BYTES) {
      await response.body?.cancel();
      throw new Error("Sheets are limited to 5 MB.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The sheet returned no data.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_SHEET_BYTES) throw new Error("Sheets are limited to 5 MB.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("The sheet returned too many redirects.");
}
