type IcsEvent = {
  uid: string;
  dtstart: Date;
  dtend?: Date;
  summary: string;
  description?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toUtcBasic(d: Date) {
  // YYYYMMDDTHHMMSSZ
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(events: IcsEvent[]) {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Landlord Portfolio//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(e.uid)}`);
    lines.push(`DTSTAMP:${toUtcBasic(now)}`);
    lines.push(`DTSTART:${toUtcBasic(e.dtstart)}`);
    if (e.dtend) lines.push(`DTEND:${toUtcBasic(e.dtend)}`);
    lines.push(`SUMMARY:${escapeText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
