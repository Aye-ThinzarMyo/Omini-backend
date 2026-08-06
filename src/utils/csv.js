function escapeCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  return (
    "\uFEFF" + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")
  );
}

export function sendCsv(res, rows, filename) {
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  res.send(toCsv(rows));
}
