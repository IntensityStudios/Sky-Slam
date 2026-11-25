// Sky Slam tuning panel.
// Change a number, save, and refresh the browser. No build step.

export const CONFIG = {
  arena: {
    radius: 11.2,
    // Outer band that starts shoving the slammer off the island.
    edgeBand: 1.25,
    edgePush: 18,
    edgePushPerLevel: 1.35,
    edgePushMax: 30,
  },

  lives: 3,

  player: {
    radius: 0.7,
    maxSpeed: 14,
    accel: 160,
    drag: 6,
    dashSpeed: 23,
    dashTime: 0.18,
    // Hitting a crate stretches the dash so a lined-up row pops.
    dashExtendOnHit: 0.075,
    dashMaxHits: 6,
    dashCooldown: 0.4,
    dashCooldownMin: 0.24,
    dashCooldownPerLevel: 0.012,
    slamRadius: 4.15,
    slamRadiusPerCombo: 0.055,
    slamRadiusMax: 6.9,
    feverSlamBonus: 0.75,
    slamCooldown: 0.96,
    slamAnim: 0.16,
    iFrames: 1.15,
    knockback: 14,
  },

  combo: {
    // Seconds to land another smash before the chain drops.
    timeout: 2.55,
    // Hits needed to climb one multiplier step.
    step: 3,
    maxMultiplier: 8,
    // Multiplier at which FEVER starts (magnet gems, bigger slam).
    feverAt: 4,
  },

  score: {
    crate: 100,
    pinata: 350,
    gem: 50,
    mite: 250,
    levelBonus: 250,
  },

  spawn: {
    interval: 1.0,
    intervalMin: 0.38,
    // Multiplied into the interval each level. Lower = faster ramp.
    intervalDecay: 0.9,
    maxCrates: 12,
    maxGems: 8,
    maxMites: 6,
    // Chance a new crate pops up next to an existing one (dash lines).
    clusterChance: 0.48,
  },

  difficulty: {
    secondsPerLevel: 14,
    // Quiet seconds at the start of a real run before mites appear.
    miteGrace: 5,
    miteSpeed: 3.05,
    miteSpeedPerLevel: 0.4,
    miteSpeedMax: 8.4,
    miteBase: 1,
    // +1 mite cap every this many levels.
    mitesPerLevels: 2,
    pinataStartLevel: 3,
    pinataChance: 0.3,
    zapStartLevel: 2,
    zapEvery: 8.0,
    zapEveryMin: 4.2,
    zapEveryDecay: 0.93,
    zapWarn: 0.92,
    zapRadius: 3.2,
    // From this level, a second zap can exist at once.
    zapDoubleLevel: 6,
  },

  juice: {
    hitstopSmash: 0.042,
    hitstopBig: 0.072,
    hitstopHurt: 0.08,
    shakeSmash: 0.3,
    shakeBig: 0.5,
    shakeHurt: 0.64,
  },

  camera: {
    fov: 42,
    // View width as a multiple of the arena radius. Smaller = tighter framing.
    span: 2.28,
    height: 0.42,
    back: 0.9,
    side: 0.48,
    follow: 5.2,
  },
};
