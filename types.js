// Shared type data + helpers for every page.
const TYPES = ["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground",
               "Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
const ABBR = {Normal:"NOR",Fire:"FIR",Water:"WAT",Electric:"ELE",Grass:"GRA",Ice:"ICE",
  Fighting:"FIG",Poison:"POI",Ground:"GRO",Flying:"FLY",Psychic:"PSY",Bug:"BUG",Rock:"ROC",
  Ghost:"GHO",Dragon:"DRA",Dark:"DAR",Steel:"STE",Fairy:"FAI"};

// Attacking type -> { defending type: tier }  (2 = super effective, 0.5 = resisted, 0 = "immune")
const EFF = {
  Normal:   {Rock:.5, Ghost:0, Steel:.5},
  Fire:     {Fire:.5, Water:.5, Grass:2, Ice:2, Bug:2, Rock:.5, Dragon:.5, Steel:2},
  Water:    {Fire:2, Water:.5, Grass:.5, Ground:2, Rock:2, Dragon:.5},
  Electric: {Water:2, Electric:.5, Grass:.5, Ground:0, Flying:2, Dragon:.5},
  Grass:    {Fire:.5, Water:2, Grass:.5, Poison:.5, Ground:2, Flying:.5, Bug:.5, Rock:2, Dragon:.5, Steel:.5},
  Ice:      {Fire:.5, Water:.5, Grass:2, Ice:.5, Ground:2, Flying:2, Dragon:2, Steel:.5},
  Fighting: {Normal:2, Ice:2, Poison:.5, Flying:.5, Psychic:.5, Bug:.5, Rock:2, Ghost:0, Dark:2, Steel:2, Fairy:.5},
  Poison:   {Grass:2, Poison:.5, Ground:.5, Rock:.5, Ghost:.5, Steel:0, Fairy:2},
  Ground:   {Fire:2, Electric:2, Grass:.5, Poison:2, Flying:0, Bug:.5, Rock:2, Steel:2},
  Flying:   {Electric:.5, Grass:2, Fighting:2, Bug:2, Rock:.5, Steel:.5},
  Psychic:  {Fighting:2, Poison:2, Psychic:.5, Dark:0, Steel:.5},
  Bug:      {Fire:.5, Grass:2, Fighting:.5, Poison:.5, Flying:.5, Psychic:2, Ghost:.5, Dark:2, Steel:.5, Fairy:.5},
  Rock:     {Fire:2, Ice:2, Fighting:.5, Ground:.5, Flying:2, Bug:2, Steel:.5},
  Ghost:    {Normal:0, Psychic:2, Ghost:2, Dark:.5},
  Dragon:   {Dragon:2, Steel:.5, Fairy:0},
  Dark:     {Fighting:.5, Psychic:2, Ghost:2, Dark:.5, Fairy:.5},
  Steel:    {Fire:.5, Water:.5, Electric:.5, Ice:2, Rock:2, Steel:.5, Fairy:2},
  Fairy:    {Fire:.5, Fighting:2, Poison:.5, Dragon:2, Dark:2, Steel:.5},
};
const tier = (atk, def) => EFF[atk][def] ?? 1;

// In GO every step is a power of 1.6: super effective +1, resisted -1, "immune" -2.
const STEP = { 2: 1, 1: 0, 0.5: -1, 0: -2 };
const steps = (atk, defTypes) => defTypes.reduce((s, d) => s + STEP[tier(atk, d)], 0);
const STEP_LABEL = { 2: "2.56×", 1: "1.6×", 0: "1×", "-1": "0.625×", "-2": "0.39×", "-3": "0.244×" };

const pill = (t, extra = "") =>
  `<span class="pill t-${t.toLowerCase()}${extra}">${t}</span>`;

// HTML block listing weaknesses / resistances of a defender with the given types.
function matchupHTML(defTypes) {
  const groups = {};
  TYPES.forEach(a => { const s = steps(a, defTypes); (groups[s] ||= []).push(a); });
  const row = (s, label, cls) => groups[s]
    ? `<div class="mu-row ${cls}"><div class="mu-mult">${STEP_LABEL[s]}</div>
         <div class="mu-types">${groups[s].map(t => pill(t)).join("")}</div>
         <div class="mu-label">${label}</div></div>` : "";
  const weak = row(2, "double weak", "mu-se2") + row(1, "weak", "mu-se");
  const resist = row(-1, "resists", "mu-nve") + row(-2, "double resists", "mu-nve2") + row(-3, "triple resists", "mu-nve3");
  return `<h3 class="mu-h">Weak to</h3>${weak || `<p class="muted">No weaknesses</p>`}
          <h3 class="mu-h">Resists</h3>${resist || `<p class="muted">No resistances</p>`}`;
}

// Small localStorage wrapper that never throws.
const store = {
  get(k, d) { try { const v = localStorage.getItem("gotools:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("gotools:" + k, JSON.stringify(v)); } catch {} },
};

// Offline support: register the service worker on every page.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
