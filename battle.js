// Raid damage estimates shared by Boss Lookup (overall and "My Pokémon").
// Needs types.js and gamedata.js loaded first.
//
// Model, in the style of common raid calculators: no weather, no dodging.
// Damage per hit = floor(0.5 × power × atk/def × STAB × effectiveness) + 1.
// DPS uses a fast-move/charged-move cycle. Ranking weighs damage speed and bulk
// (DPS³ × TDO, where TDO grows with DPS × HP × DEF), so glass cannons do not dominate.

const BOSS_CPM = 0.79;
const SHADOW_ATK = 1.2, SHADOW_DEF = 5 / 6;

// Combat power multiplier for any level (half levels sit between whole ones).
function cpmAt(level) {
  const lo = Math.floor(level), a = CPM[lo - 1];
  if (level === lo) return a;
  const b = CPM[lo] ?? a;
  return Math.sqrt((a * a + b * b) / 2);
}

const moveNorm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const MOVE_BY_NAME = new Map(MOVES.map((m, i) => [moveNorm(m[0]), i]));

function bossInfo(boss) {
  return { types: boss[2].map(i => TYPES[i]), def: (boss[4] + 15) * BOSS_CPM };
}

// Best fast/charged pair (by DPS) from the candidate lists, for an attacker with these stats.
function bestCycle(attTypes, atk, boss, fastList, chargedList) {
  const dmg = mv => {
    const [, t, power] = MOVES[mv];
    const stab = attTypes.includes(t) ? 1.2 : 1;
    const eff = boss.mult ? boss.mult(TYPES[t]) : 1.6 ** steps(TYPES[t], boss.types);
    return Math.floor(0.5 * power * atk / boss.def * stab * eff) + 1;
  };
  let best = null;
  for (const f of fastList) {
    const fe = MOVES[f][4];
    if (fe <= 0) continue;
    const fd = dmg(f), fdur = MOVES[f][3];
    for (const c of chargedList) {
      const cost = -MOVES[c][4];
      if (cost <= 0) continue;
      const n = Math.ceil(cost / fe);
      const dps = (n * fd + dmg(c)) / ((n * fdur + MOVES[c][3]) / 1000);
      if (!best || dps > best.dps) best = { dps, f, c };
    }
  }
  return best;
}

// Stats for a Pokémon at a level with IVs. Shadow: 1.2× attack, 0.83× defense.
function statsFor(m, level, ivA, ivD, ivS, shadow) {
  const c = cpmAt(level);
  return {
    atk: (m[3] + ivA) * c * (shadow ? SHADOW_ATK : 1),
    def: (m[4] + ivD) * c * (shadow ? SHADOW_DEF : 1),
    hp: Math.floor((m[5] + ivS) * c),
  };
}
const rankScore = (dps, st) => dps ** 4 * st.hp * st.def;

// A typical raid boss that is weak (1.6×) to one attacking type and neutral to the rest.
function typeBoss(type) {
  return { types: [], def: (200 + 15) * BOSS_CPM, mult: t => (t === type ? 1.6 : 1) };
}

// Stardust / candy / XL candy to power up from one level to another.
function powerUpCost(from, to, { shadow = false, purified = false, lucky = false } = {}) {
  const U = UPGRADE;
  const dm = (shadow ? U.shadowStardustMultiplier : purified ? U.purifiedStardustMultiplier : 1) * (lucky ? 0.5 : 1);
  const cm = shadow ? U.shadowCandyMultiplier : purified ? U.purifiedCandyMultiplier : 1;
  let dust = 0, candy = 0, xl = 0;
  for (let lv = from; lv < to; lv += 0.5) {
    const i = Math.floor(lv) - 1;
    dust += Math.ceil((U.stardustCost[i] ?? 0) * dm);
    if (lv < U.xlCandyMinPokemonLevel) candy += Math.ceil((U.candyCost[i] ?? 0) * cm);
    else xl += Math.ceil((U.xlCandyCost[Math.floor(lv) - U.xlCandyMinPokemonLevel] ?? 0) * cm);
  }
  return { dust, candy, xl };
}

// Overall best: every released Pokémon at level 40 with perfect IVs, best moves.
function bestOverall(bossMon, opts) {
  const boss = bossInfo(bossMon);
  const out = [];
  for (const m of MONS) {
    const [, , types, , , , fast, charged, elite, flags] = m;
    if (!(flags & 4)) continue;
    if ((flags & 1) && !opts.shadow) continue;
    if ((flags & 2) && !opts.mega) continue;
    const ok = i => opts.elite || !elite.includes(i);
    const st = statsFor(m, 40, 15, 15, 15, flags & 1);
    const best = bestCycle(types, st.atk, boss, fast.filter(ok), charged.filter(ok));
    if (!best) continue;
    out.push({ ...best, m, score: rankScore(best.dps, st) });
  }
  return out.sort((x, y) => y.score - x.score);
}
