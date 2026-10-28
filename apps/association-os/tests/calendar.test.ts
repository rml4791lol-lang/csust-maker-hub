import assert from "node:assert/strict";
import test from "node:test";
import { activityDay, shanghaiToday, shiftDay, weekDays } from "../src/lib/calendar.ts";

test("calendar rejects yearless and impossible civil dates rather than scheduling guessed events", () => {
  for (const input of ["10-28 14:00", "2026-02-29", "2026-13-01", "2026-10-28 24:00", "2026-10-28 12:60", "2026-10-28 extra"]) assert.equal(activityDay(input), null);
  assert.equal(activityDay("2024-02-29 09:30"), "2024-02-29");
});
test("calendar week crosses year boundaries and uses Shanghai civil today", () => {
  assert.equal(shanghaiToday(new Date("2026-12-31T16:05:00Z")), "2027-01-01");
  assert.deepEqual(weekDays("2027-01-03"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  assert.equal(shiftDay("2024-03-01", -1), "2024-02-29");
});
