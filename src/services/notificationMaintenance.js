import { Notification, AppSetting } from "../database/models";

const LAST_CLEANUP_KEY = "notif-last-cleanup-month";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24h
const STARTUP_DELAY_MS = 5000;

let timer = null;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}`;
}

async function getLastCleanupMonth() {
  const row = await AppSetting.findOne({ where: { key: LAST_CLEANUP_KEY } });
  return row?.value || null;
}

async function setLastCleanupMonth(key) {
  const row = await AppSetting.findOne({ where: { key: LAST_CLEANUP_KEY } });
  if (row) {
    await row.update({ value: key });
  } else {
    await AppSetting.create({ key: LAST_CLEANUP_KEY, value: key });
  }
}

// Clear the ENTIRE notifications table once per calendar month.
export async function runMonthlyCleanup(force = false) {
  try {
    const nowKey = currentMonthKey();
    const lastKey = await getLastCleanupMonth();

    // Skip unless forced or a new calendar month has begun.
    if (!force && lastKey === nowKey) {
      return 0;
    }

    const deleted = await Notification.destroy({ where: {} });
    await setLastCleanupMonth(nowKey);

    console.log(
      `[notif-monthly-cleanup] Cleared ${deleted} notification(s) for month ${nowKey}`,
    );
    return deleted;
  } catch (err) {
    console.error(
      "[notif-monthly-cleanup] Failed to clear notifications:",
      err.message,
    );
    return 0;
  }
}

// Starts the daily checker. On the first run of a new month, the table is wiped.
export function startNotificationMaintenance() {
  if (timer) return;

  // Run shortly after startup to catch up if the month just turned.
  setTimeout(() => runMonthlyCleanup(), STARTUP_DELAY_MS);

  // Then check daily.
  timer = setInterval(() => runMonthlyCleanup(), CHECK_INTERVAL_MS);
}
