// "My Pokémon": import a Poke Genie CSV, clean it up, keep it on this device only.
// Needs types.js, gamedata.js and battle.js loaded first.

const MY_KEY = "my-pokemon", HIDDEN_KEY = "my-hidden", CUTOFF_KEY = "my-cutoff";
const nrm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/* ---------- Match a Poke Genie row to an entry in the game data ---------- */
const BASE_BY_DEX = new Map();
MONS.forEach((m, i) => {
  if (m[9] & 3) return;                    // skip Shadow / Mega entries; stats come from the base form
  if (!BASE_BY_DEX.has(m[1])) BASE_BY_DEX.set(m[1], []);
  BASE_BY_DEX.get(m[1]).push(i);
});
const REGION = { alola: "alolan", galar: "galarian", hisui: "hisuian", paldea: "paldean" };
function matchMon(dex, form) {
  const c = BASE_BY_DEX.get(dex);
  if (!c) return -1;
  const f = nrm(form);
  const plain = c.find(i => !/[(_]/.test(MONS[i][0]));
  if (!f || f === "normal") return plain ?? c[0];
  const w = REGION[f] || f;
  const paren = i => nrm((MONS[i][0].match(/\((.*)\)/) || [, ""])[1]);
  return c.find(i => paren(i).startsWith(w)) ?? c.find(i => nrm(MONS[i][0]).includes(w)) ?? plain ?? c[0];
}

/* ---------- Import + clean-up ---------- */
// Same species/form/gender/IVs/shadow/lucky (+ catch date when known) = the same Pokémon.
// Keep its most recent scan, filling in moves from older scans if the newest one missed them.
function importPokeGenie(text) {
  const rows = parseCSV(text);
  const need = ["Pokemon", "CP", "Atk IV", "Level Min", "Scan Date"];
  if (!rows.length || need.some(h => !(h in rows[0])))
    throw new Error("This doesn't look like a Poke Genie export (missing columns like “Pokemon”, “Atk IV”, “Scan Date”).");

  const report = { rows: rows.length, unmatched: 0, partial: 0, merged: 0, unknownIv: 0, noMoves: 0 };
  const parsed = [];
  for (const r of rows) {
    const dex = +r["Pokemon"];
    const mi = matchMon(dex, r["Form"]);
    if (mi < 0) { report.unmatched++; continue; }
    const iv = r["Atk IV"] === "" ? null : [+r["Atk IV"], +r["Def IV"], +r["Sta IV"]];
    parsed.push({
      mon: MONS[mi][0], dex, form: r["Form"] || "", g: r["Gender"] || "",
      sh: +r["Shadow/Purified"] || 0, lu: +r["Lucky"] || 0, iv,
      lv: +r["Level Min"] || +r["Level Max"] || 20,
      cp: +r["CP"] || 0, hp: +r["HP"] || 0,
      fast: r["Quick Move"] || "", ch: [r["Charge Move"], r["Charge Move 2"]].filter(Boolean),
      scan: r["Scan Date"] || "", cat: r["Catch Date"] || "",
    });
  }
  parsed.sort((a, b) => b.scan.localeCompare(a.scan));   // newest scan first

  // Scans without IVs that match an appraised scan (same CP and HP) are the same Pokémon.
  const sig = p => [p.dex, p.form, p.cp, p.hp, p.sh].join("|");
  const appraised = new Set(parsed.filter(p => p.iv).map(sig));

  const groups = new Map();   // key -> list of Pokémon (each a list of scans, newest first)
  for (const p of parsed) {
    if (!p.iv) {
      if (appraised.has(sig(p))) { report.partial++; continue; }
      p.k = "u|" + sig(p);
    } else {
      p.k = [p.dex, p.form, p.g, p.iv.join("/"), p.sh, p.lu].join("|");
    }
    if (!groups.has(p.k)) groups.set(p.k, []);
    const list = groups.get(p.k);
    // A blank catch date joins the newest Pokémon in the group; a known one must match.
    const same = list.find(x => !p.cat || !x[0].cat || x[0].cat === p.cat);
    if (same) { same.push(p); report.merged++; }
    else list.push([p]);
  }

  const records = [];
  for (const list of groups.values()) {
    for (const scans of list) {
      const r = { ...scans[0] };
      if (!r.fast) r.fast = scans.find(s => s.fast)?.fast || "";
      if (!r.ch.length) r.ch = scans.find(s => s.ch.length)?.ch || [];
      if (!r.cat) r.cat = scans.find(s => s.cat)?.cat || "";
      r.k = r.k + (r.cat ? "|" + r.cat : "");
      if (!r.iv) report.unknownIv++;
      if (!r.fast && !r.ch.length) report.noMoves++;
      records.push(r);
    }
  }
  report.kept = records.length;
  return { records, report };
}

/* ---------- Storage (this device only) ---------- */
// Saved compactly (one short array per Pokémon) so even big collections fit.
const pack = r => [r.k, r.mon, r.sh, r.lu, r.iv, r.lv, r.cp, r.fast, r.ch, r.scan, r.cat];
const unpack = a => ({ k: a[0], mon: a[1], sh: a[2], lu: a[3], iv: a[4], lv: a[5], cp: a[6], fast: a[7], ch: a[8], scan: a[9], cat: a[10] });
let myCache;
const myStore = {
  load() {
    if (myCache !== undefined) return myCache;
    const d = store.get(MY_KEY, null);
    return (myCache = d && { ...d, records: d.records.map(unpack) });
  },
  save(records, report) {
    const data = { imported: new Date().toISOString(), report, records: records.map(pack) };
    try { localStorage.setItem("gotools:" + MY_KEY, JSON.stringify(data)); }
    catch { throw new Error("Not enough storage space on this device to save your Pokémon."); }
    myCache = undefined;
    return this.load();
  },
  exportBackup() {
    return JSON.stringify({ app: "go-tools", version: 1, my: store.get(MY_KEY, null),
                            hidden: [...this.hidden()], cutoff: this.cutoffDays() });
  },
  importBackup(text) {
    const b = JSON.parse(text);
    if (b.app !== "go-tools" || !b.my) throw new Error("That file isn't a GO Tools backup.");
    try { localStorage.setItem("gotools:" + MY_KEY, JSON.stringify(b.my)); }
    catch { throw new Error("Not enough storage space on this device."); }
    this.setHidden(new Set(b.hidden || [])); this.setCutoffDays(b.cutoff || 0);
    myCache = undefined;
  },
  clear() { try { localStorage.removeItem("gotools:" + MY_KEY); } catch {} myCache = undefined; },
  hidden() { return new Set(store.get(HIDDEN_KEY, [])); },
  setHidden(set) { store.set(HIDDEN_KEY, [...set]); },
  cutoffDays() { return store.get(CUTOFF_KEY, 0); },
  setCutoffDays(d) { store.set(CUTOFF_KEY, d); },
};

// Records currently in play: not hidden, and scanned recently enough.
function activeRecords() {
  const data = myStore.load();
  if (!data) return null;
  const hidden = myStore.hidden();
  const days = myStore.cutoffDays();
  const since = days ? Date.now() - days * 864e5 : 0;
  return data.records.filter(r => !hidden.has(r.k) && (!since || new Date(r.scan.replace(" ", "T")) >= since));
}

/* ---------- Rank your own Pokémon against a boss ---------- */
const MON_INDEX = new Map(MONS.map((m, i) => [m[0], i]));
function bestMine(bossMon, opts) {
  const recs = activeRecords();
  if (!recs) return null;
  const boss = bossInfo(bossMon);
  const out = [];
  for (const r of recs) {
    if (r.sh === 1 && !opts.shadow) continue;
    const m = MONS[MON_INDEX.get(r.mon)];
    if (!m) continue;
    const [, , types, , , , fast, charged, elite] = m;
    const iv = r.iv || [10, 10, 10];
    const st = statsFor(m, r.lv, iv[0], iv[1], iv[2], r.sh === 1);
    const normal = i => !elite.includes(i);
    const known = name => MOVE_BY_NAME.get(moveNorm(name));
    const myFast = r.fast ? known(r.fast) : undefined;
    const myCh = r.ch.map(known).filter(i => i !== undefined);
    const guessFast = myFast === undefined, guessCh = !myCh.length;
    const fastC = guessFast ? fast.filter(normal) : [myFast];
    const chC = guessCh ? charged.filter(normal) : myCh;
    const best = bestCycle(types, st.atk, boss, fastC, chC);
    if (!best) continue;
    // Could a regular TM do better? (Elite moves need an Elite TM, so they are not suggested.)
    let tm = null;
    if (!guessFast || !guessCh) {
      const pot = bestCycle(types, st.atk, boss,
        [...new Set([...fastC, ...fast.filter(normal)])], [...new Set([...chC, ...charged.filter(normal)])]);
      if (pot && pot.dps > best.dps * 1.05) tm = { ...pot, gain: pot.dps / best.dps - 1 };
    }
    out.push({ ...best, m, r, st, guessFast, guessCh, tm, score: rankScore(best.dps, st) });
  }
  return out.sort((x, y) => y.score - x.score);
}
