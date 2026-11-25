# Sky Slam

Play in the browser: https://intensitystudios.github.io/Sky-Slam/

A tiny offline arcade game. You are a round slammer on a candy-colored sky island. Dash through supply crates, slam the piles, chain a combo, and do not get bumped off the rim.

No install, no build, no accounts. Three.js is vendored in this folder, so it runs with the wifi off.

## Play on Windows

Double-click **`start.bat`**.

It opens the game in your default browser and leaves a console window running. Close that window when you are done. The launcher tries, in order:

1. `py -m http.server`
2. `python -m http.server`
3. `npx serve`

If none of those exist, the window tells you how to install Python. During the Python install, check **Add python.exe to PATH**, then double-click `start.bat` again.

Do not open `index.html` by itself. Browsers block the game's modules on a `file://` page.

## Play on Mac or Linux

```bash
chmod +x start.sh
./start.sh
```

That tries `python3`, then `python`, then `npx serve`.

## Controls

| Action | Keyboard | Mouse | Touch |
| --- | --- | --- | --- |
| Move | WASD or arrows | Hold the left button and steer | Left stick |
| Dash | Space or K (hold to repeat) | Click the island | DASH button |
| Slam | F, J, or Shift | Right-click | SLAM button |
| Pause | Esc or P | Pause button | Pause button |
| Mute | M | SND button | SND button |
| Restart after a wipe | R, Space, or Enter | AGAIN | AGAIN |

You get three hearts. Mites and zap rings take one. Dashing through a mite smashes it instead. Falling off costs a heart unless you are still flashing from a hit. At zero hearts the run is over. AGAIN starts a new run immediately.

The gold ring at your feet is the slam. It is bright when ready and shrinks while it cools down. The outer rim gets slippery, then shoves you off.

Score multiplies as the combo climbs. At **x4** you hit FEVER: gems pull toward you and the slam grows. The best score is saved in this browser (`localStorage`).

## Tweak the difficulty

Everything you would want to turn is in [`js/config.js`](js/config.js). Save the file and refresh the browser.

| What you feel | Constant |
| --- | --- |
| Island size | `arena.radius` |
| How mean the rim is | `arena.edgeBand`, `arena.edgePush`, `arena.edgePushPerLevel` |
| Run speed | `player.maxSpeed`, `player.accel` |
| Dash length and recovery | `player.dashSpeed`, `player.dashTime`, `player.dashCooldown` |
| How far a slam reaches | `player.slamRadius`, `player.slamRadiusPerCombo`, `player.slamCooldown` |
| Hearts | `lives` |
| Combo window and FEVER | `combo.timeout`, `combo.step`, `combo.feverAt` |
| Points | `score.crate`, `score.pinata`, `score.gem`, `score.mite` |
| How fast new stuff appears | `spawn.interval`, `spawn.intervalDecay`, `spawn.clusterChance` |
| Seconds between level-ups | `difficulty.secondsPerLevel` |
| Quiet time before the first mite | `difficulty.miteGrace` |
| Mite speed | `difficulty.miteSpeed`, `difficulty.miteSpeedPerLevel` |
| When pinatas show up | `difficulty.pinataStartLevel` |
| When zap rings show up | `difficulty.zapStartLevel`, `difficulty.zapEvery`, `difficulty.zapWarn` |
| Camera tightness | `camera.span` (smaller fills the screen more) |

`combo.step` is how many hits it takes to gain one multiplier. With `3`, hits 1–3 are x1, 4–6 are x2, and x4 (FEVER) starts on hit 10.

## Phone on the same Wi-Fi

`start.bat` only listens on this PC. To let a phone join, open a terminal in this folder and run:

```bat
py -m http.server 8477 --bind 0.0.0.0
```

Then visit `http://YOUR-PC-IP:8477/` on the phone. Windows may ask for firewall permission.

## If the page is blank

Some Windows installs label `.js` files as plain text, and the browser refuses to load the game. `sitecustomize.py` fixes that for `py -m http.server` when this folder is the current directory. If it is still blank, run:

```bat
py serve.py 8477
```

Then open `http://127.0.0.1:8477/`.

## Files

```
index.html          page, title, pause, game over
css/style.css       sticker UI
js/config.js        difficulty and feel knobs
js/main.js          game
js/audio.js         music and hits, made with WebAudio
js/input.js         keyboard, mouse, touch
js/fx.js            particles, numbers, screen shake
start.bat           Windows launcher
start.sh            Mac / Linux launcher
serve.py            backup static server
vendor/three/       three.js r187 (MIT)
```

Three.js is included under its MIT license: `vendor/three/LICENSE`.
