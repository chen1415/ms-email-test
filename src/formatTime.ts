const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDisplayTime(iso: string | undefined | null): string {
  if (!iso || !iso.trim()) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const day = pad2(d.getDate());
  const mon = MONTHS[d.getMonth()] ?? "???";
  const year = d.getFullYear();
  const hms = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return `${day}${mon}${year} ${hms}`;
}
