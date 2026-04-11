/* ============================================================
   VOID BREACH — main.js  (Boot & Glue)
   Initializes all modules and wires up UI buttons
   ============================================================ */

'use strict';

window.addEventListener('DOMContentLoaded', async () => {

  /* ── 1. Init renderer ───────────────────────────────────── */
  const canvas = document.getElementById('gameCanvas');
  Renderer.init(canvas);

  /* ── 2. Init audio ──────────────────────────────────────── */
  AudioEngine.init();

  /* ── 3. Init HUD ────────────────────────────────────────── */
  HUD.init();

  /* ── 4. Init game logic ─────────────────────────────────── */
  await Game.init();

  /* ── 5. Wire up buttons ─────────────────────────────────── */

  // Title
  document.getElementById('btn-start')?.addEventListener('click', () => {
    AudioEngine.resume();
    Game.startGame();
  });

  document.getElementById('btn-controls')?.addEventListener('click', () => {
    const cp = document.getElementById('controls-panel');
    if (cp) cp.style.display = cp.style.display === 'none' ? 'block' : 'none';
  });

  // Pause
  document.getElementById('btn-resume')?.addEventListener('click', () => {
    Game.setState('playing');
  });

  document.getElementById('btn-quit-pause')?.addEventListener('click', () => {
    AudioEngine.stopMusic();
    Game.setState('title');
  });

  // Game Over
  document.getElementById('btn-retry')?.addEventListener('click', () => {
    Game.startGame();
  });

  document.getElementById('btn-menu-go')?.addEventListener('click', () => {
    Game.setState('title');
  });

  // Victory
  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    Game.startGame();
  });

  document.getElementById('btn-menu-v')?.addEventListener('click', () => {
    Game.setState('title');
  });

  // Upgrade
  document.getElementById('btn-continue')?.addEventListener('click', () => {
    Game.continueAfterUpgrade();
  });

  document.getElementById('btn-skip-upgrade')?.addEventListener('click', () => {
    Game.continueAfterUpgrade();
  });

  /* ── 6. Background canvas (title screen particles) ──────── */
  startTitleParticles();

  /* ── 7. Start game loop ─────────────────────────────────── */
  Game.start();
});

/* ── Title screen animated starfield ───────────────────── */
function startTitleParticles() {
  // The main canvas already runs the game loop; when state=title
  // we just render the starfield continuously.
  // This is handled by Game.start() + game loop checking state.
}

/* ── Inline fallback config (used if fetch fails for file://) ── */
window.INLINE_CONFIG = {"game":{"title":"VOID BREACH","version":"1.0.0"},"player":{"speed":280,"rollSpeed":3.5,"pitchSpeed":2.8,"health":100,"shields":50,"shieldRegenRate":2,"shieldRegenDelay":3000,"lives":3,"invincibilityDuration":2000},"weapons":{"laser":{"name":"Plasma Cannon","damage":10,"speed":1200,"fireRate":120,"color":"#00ffff","energyCost":5},"missile":{"name":"Seeker Missile","damage":45,"speed":600,"fireRate":800,"color":"#ff6600","energyCost":20,"homingStrength":3.5},"spread":{"name":"Scatter Burst","damage":8,"speed":900,"fireRate":350,"color":"#ff00ff","energyCost":12,"pellets":5,"spreadAngle":0.25}},"enemies":{"fighter":{"health":30,"speed":180,"score":100,"fireRate":1800,"damage":10,"color":"#ff4444","scale":1.0},"bomber":{"health":80,"speed":100,"score":250,"fireRate":2500,"damage":25,"color":"#ff8800","scale":1.8},"scout":{"health":15,"speed":320,"score":75,"fireRate":2200,"damage":8,"color":"#ffff00","scale":0.7},"capital":{"health":500,"speed":40,"score":1000,"fireRate":1000,"damage":35,"color":"#aa00ff","scale":3.5}},"powerups":{"health":{"value":30,"color":"#00ff88","duration":0},"shield":{"value":50,"color":"#4488ff","duration":0},"energy":{"value":60,"color":"#ffff00","duration":0},"rapidfire":{"value":0,"color":"#ff00ff","duration":8000},"tripleshot":{"value":0,"color":"#ff8800","duration":6000},"invincible":{"value":0,"color":"#ffffff","duration":5000}},"waves":[{"wave":1,"enemies":[{"type":"fighter","count":4}],"spawnDelay":1200},{"wave":2,"enemies":[{"type":"fighter","count":5},{"type":"scout","count":3}],"spawnDelay":1000},{"wave":3,"enemies":[{"type":"fighter","count":4},{"type":"bomber","count":2}],"spawnDelay":1000},{"wave":4,"enemies":[{"type":"scout","count":6},{"type":"fighter","count":3}],"spawnDelay":900},{"wave":5,"enemies":[{"type":"capital","count":1},{"type":"fighter","count":4}],"spawnDelay":800},{"wave":6,"enemies":[{"type":"bomber","count":3},{"type":"scout","count":5},{"type":"fighter","count":3}],"spawnDelay":800},{"wave":7,"enemies":[{"type":"capital","count":2},{"type":"fighter","count":6}],"spawnDelay":700},{"wave":8,"enemies":[{"type":"scout","count":8},{"type":"bomber","count":4},{"type":"capital","count":1}],"spawnDelay":700},{"wave":9,"enemies":[{"type":"capital","count":3},{"type":"fighter","count":8},{"type":"bomber","count":3}],"spawnDelay":600},{"wave":10,"enemies":[{"type":"capital","count":4},{"type":"bomber","count":5},{"type":"scout","count":8},{"type":"fighter","count":6}],"spawnDelay":500}],"starfield":{"layers":[{"count":200,"speed":0.3,"size":0.8,"opacity":0.5},{"count":120,"speed":0.7,"size":1.2,"opacity":0.7},{"count":60,"speed":1.4,"size":2.0,"opacity":0.9}]},"audio":{"masterVolume":0.6,"sfxVolume":0.7,"musicVolume":0.3}};

window.INLINE_UPGRADES = {"upgrades":[{"id":"hull_plating","name":"Hull Plating","description":"Increase max health by 25","cost":500,"maxLevel":5,"effect":{"stat":"health","value":25},"icon":"🛡️"},{"id":"shield_capacitor","name":"Shield Capacitor","description":"Increase max shields by 20","cost":600,"maxLevel":5,"effect":{"stat":"shields","value":20},"icon":"⚡"},{"id":"engine_boost","name":"Engine Boost","description":"Increase speed by 30","cost":400,"maxLevel":4,"effect":{"stat":"speed","value":30},"icon":"🚀"},{"id":"cannon_overcharge","name":"Cannon Overcharge","description":"Increase laser damage by 5","cost":700,"maxLevel":5,"effect":{"stat":"laserDamage","value":5},"icon":"🔫"},{"id":"energy_cell","name":"Energy Cell","description":"Increase max energy by 20","cost":350,"maxLevel":5,"effect":{"stat":"energy","value":20},"icon":"🔋"},{"id":"shield_regen","name":"Shield Regen Module","description":"Increase shield regen rate by 1/s","cost":800,"maxLevel":3,"effect":{"stat":"shieldRegen","value":1},"icon":"♻️"}],"achievements":[{"id":"first_kill","name":"First Blood","description":"Destroy your first enemy","condition":{"type":"kills","value":1},"reward":100},{"id":"ace","name":"Space Ace","description":"Destroy 50 enemies","condition":{"type":"kills","value":50},"reward":500},{"id":"wave5","name":"Halfway There","description":"Complete Wave 5","condition":{"type":"wave","value":5},"reward":750},{"id":"wave10","name":"Void Breacher","description":"Complete all 10 waves","condition":{"type":"wave","value":10},"reward":2000},{"id":"score10k","name":"High Scorer","description":"Reach 10,000 points","condition":{"type":"score","value":10000},"reward":1000},{"id":"no_damage","name":"Untouchable","description":"Complete a wave without taking damage","condition":{"type":"noDamage","value":1},"reward":600},{"id":"capital_killer","name":"Capital Punishment","description":"Destroy a Capital Ship","condition":{"type":"capitalKill","value":1},"reward":800}]};

/* ── Resize handler ─────────────────────────────────────── */
window.addEventListener('resize', () => {
  Renderer.resize();
});
