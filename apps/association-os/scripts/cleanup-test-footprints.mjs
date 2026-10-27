// 清理测试足迹
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/app.db");
const r = db.prepare("DELETE FROM contributions WHERE member = ?").run("测试同学");
console.log("清理测试数据:", r.changes, "条");

const c = db.prepare("SELECT COUNT(*) AS c FROM contributions").get();
console.log("剩余足迹:", c.c, "条");

const list = db
  .prepare("SELECT member, date, substr(content,1,20) AS c FROM contributions ORDER BY date DESC")
  .all();
for (const x of list) console.log(` - ${x.member} | ${x.date} | ${x.c}`);
