# go-tools

Mobile-friendly Pokémon GO tools, hosted with GitHub Pages at
https://honeycrisp2.github.io/go-tools/

| Page | What it does |
| --- | --- |
| `boss.html` | Search a raid boss: weaknesses, resistances and best attackers |
| `type-chart.html` | Full type chart with pinned headers, Fit mode for landscape / pop-up windows |
| `dual-type.html` | Combined weaknesses for one or two types |
| `search.html` | Build, save and copy Pokémon storage search strings |

Everything is plain HTML/CSS/JS with no build step. Shared pieces: `styles.css`,
`types.js` (type chart + helpers), `gamedata.js` (generated), `sw.js` (offline cache),
`manifest.webmanifest` (install as an app).

## Updating the Pokémon / move data

When new Pokémon, forms or moves arrive in GO, refresh the data Boss Lookup uses:

```bash
python tools/update_data.py
```

It downloads the latest data, rebuilds `gamedata.js`, and bumps the cache version in
`sw.js` so installed copies of the app pick up the change. Then commit and push.
It needs only Python 3, no extra packages.

Data sources: [PvPoke](https://github.com/pvpoke/pvpoke) (Pokémon, GO stats, movesets)
and [PokeMiners game master](https://github.com/PokeMiners/game_masters) (raid move stats).

## Other notes

- **Adding or renaming a page:** add it to the `FILES` list in `sw.js` and bump `VERSION`
  there, so it works offline.
- **Changing the icon:** edit `tools/make_icons.py`, then run `python tools/make_icons.py icons`.
