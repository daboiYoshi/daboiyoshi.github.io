/* ============================================================
   VOID BREACH — Game Engine
   Entities, physics, collision detection, wave management
   ============================================================ */

'use strict';

const Game = (() => {

  /* ═══════════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════════ */
  let config = null;
  let upgradesData = null;
  let state  = 'title';  // title | playing | paused | gameover | victory | upgrade

  // Game-play data
  let score  = 0;
  let credits= 0;
  let wave   = 0;
  let kills  = 0;
  let damageThisWave = 0;

  // Stats for game-over screen
  let totalKills    = 0;
  let bestCombo     = 0;
  let shotsFired    = 0;
  let shotsHit      = 0;
  let playTime      = 0;
  let playStart     = 0;

  // Player upgrades purchased
  let upgradeLevels = {};

  // Earned achievements
  let earnedAchievements = new Set();

  // Entities
  let player      = null;
  let enemies     = [];
  let projectiles = [];
  let explosions  = [];
  let particles   = [];
  let powerups    = [];
  let waveQueue   = [];

  // Combo
  let combo       = 0;
  let comboTimer  = 0;
  const COMBO_TIMEOUT = 2500;

  // Starfield layers
  let starLayers  = [];

  // Nebula BG
  let nebulae     = [];

  // Spawn timers
  let spawnQueue  = [];

  // Active powerup effects
  let activePowerups = {};

  // Wave state
  let waveActive   = false;
  let waveComplete = false;

  // Input
  const keys = {};
  let   mouseX = 0, mouseY = 0;
  let   mouseDown = false;
  let   lastMouseX = 0, lastMouseY = 0;

  // Frame timing
  let lastTime  = 0;
  let deltaTime = 0;
  let time      = 0;   // seconds since game start

  let animFrame = null;

  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */
  async function init() {
    // Load config & upgrade data — with inline fallback for file:// protocol
    try {
      const [cfgRes, ugRes] = await Promise.all([
        fetch('data/config.json'),
        fetch('data/upgrades.json')
      ]);
      config       = await cfgRes.json();
      upgradesData = await ugRes.json();
    } catch(e) {
      console.warn('Fetch failed, using inline config fallback.', e);
      config       = window.INLINE_CONFIG || null;
      upgradesData = window.INLINE_UPGRADES || null;
    }

    initStarfield();
    initNebulae();
    setupInput();
  }

  function initStarfield() {
    starLayers = config.starfield.layers.map(layer => {
      const stars = [];
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random() * Renderer.W,
          y: Math.random() * Renderer.H,
          size:    layer.size * (0.5 + Math.random()),
          opacity: layer.opacity * (0.5 + Math.random() * 0.5),
          twinkle: Math.random() * Math.PI * 2
        });
      }
      return { stars, speed: layer.speed, size: layer.size, opacity: layer.opacity };
    });
  }

  function initNebulae() {
    nebulae = [
      { x: Renderer.W*0.2, y: Renderer.H*0.3, rx:300, ry:200, colorA:'rgb(30,0,60)', colorB:'rgb(0,20,80)', op:0.4 },
      { x: Renderer.W*0.8, y: Renderer.H*0.7, rx:250, ry:350, colorA:'rgb(0,30,60)', colorB:'rgb(40,0,40)', op:0.35 },
      { x: Renderer.W*0.5, y: Renderer.H*0.5, rx:400, ry:250, colorA:'rgb(10,0,30)', colorB:'rgb(0,10,40)', op:0.3 }
    ];
  }

  /* ═══════════════════════════════════════════════════════════
     PLAYER
  ═══════════════════════════════════════════════════════════ */
  function createPlayer() {
    const pc = config.player;
    // Apply upgrades
    const hpBonus      = (upgradeLevels['hull_plating']     || 0) * 25;
    const shBonus      = (upgradeLevels['shield_capacitor'] || 0) * 20;
    const spdBonus     = (upgradeLevels['engine_boost']     || 0) * 30;
    const enBonus      = (upgradeLevels['energy_cell']      || 0) * 20;
    const srBonus      = (upgradeLevels['shield_regen']     || 0) * 1;

    player = {
      x: Renderer.W / 2,
      y: Renderer.H * 0.78,
      vx: 0, vy: 0,
      roll: 0,
      targetX: Renderer.W / 2,
      targetY: Renderer.H * 0.78,
      health:    pc.health + hpBonus,
      maxHealth: pc.health + hpBonus,
      shields:   pc.shields + shBonus,
      maxShields:pc.shields + shBonus,
      shieldRegen: (pc.shieldRegenRate || 2) + srBonus,
      shieldRegenDelay: pc.shieldRegenDelay || 3000,
      shieldRegenTimer: 0,
      energy: 100 + enBonus,
      maxEnergy: 100 + enBonus,
      energyRegen: 15,
      speed: pc.speed + spdBonus,
      lives: pc.lives,
      invincible: false,
      invincibleTimer: 0,
      fireTimers: { laser: 0, missile: 0, spread: 0 },
      weapon: 'laser',
      thrustLevel: 0,
      radius: 18,
      // per-frame
      dmgBonus: (upgradeLevels['cannon_overcharge'] || 0) * 5
    };
  }

  /* ═══════════════════════════════════════════════════════════
     GAME FLOW
  ═══════════════════════════════════════════════════════════ */
  function startGame() {
    score    = 0;
    credits  = 0;
    wave     = 0;
    kills    = 0;
    totalKills = 0;
    shotsFired = 0;
    shotsHit   = 0;
    bestCombo  = 0;
    combo      = 0;
    comboTimer = 0;
    damageThisWave = 0;
    activePowerups = {};
    enemies     = [];
    projectiles = [];
    explosions  = [];
    particles   = [];
    powerups    = [];
    spawnQueue  = [];
    waveActive  = false;
    time        = 0;
    playStart   = performance.now();

    createPlayer();
    AudioEngine.resume();
    AudioEngine.startMusic();
    setState('playing');
    nextWave();
  }

  function nextWave() {
    wave++;
    damageThisWave = 0;
    waveActive  = false;
    waveComplete = false;

    HUD.showWaveAnnounce(wave);

    const waveData = config.waves[(wave - 1) % config.waves.length];
    const scaleFactor = 1 + Math.floor((wave - 1) / config.waves.length) * 0.3;

    spawnQueue = [];
    waveData.enemies.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        spawnQueue.push({
          type: group.type,
          delay: i * (waveData.spawnDelay || 1000) + Math.random() * 300,
          scaleFactor
        });
      }
    });

    // Sort by delay
    spawnQueue.sort((a, b) => a.delay - b.delay);

    // Start spawning after announcement
    setTimeout(() => {
      waveActive = true;
      AudioEngine.sfxWarpIn();
    }, 3000);
  }

  /* ═══════════════════════════════════════════════════════════
     ENEMIES
  ═══════════════════════════════════════════════════════════ */
  function spawnEnemy(type, scaleFactor) {
    const ec = config.enemies[type];
    if (!ec) return;

    const margin = 80;
    const side   = Math.floor(Math.random() * 3); // 0=top, 1=left, 2=right

    let x, y, vx, vy;
    if (side === 0) {
      x = margin + Math.random() * (Renderer.W - margin*2);
      y = -50;
      vx = (Math.random() - 0.5) * ec.speed * 0.5;
      vy = ec.speed * 0.7;
    } else if (side === 1) {
      x = -50;
      y = Math.random() * Renderer.H * 0.6;
      vx = ec.speed * 0.8;
      vy = ec.speed * 0.3;
    } else {
      x = Renderer.W + 50;
      y = Math.random() * Renderer.H * 0.6;
      vx = -ec.speed * 0.8;
      vy = ec.speed * 0.3;
    }

    const hp = ec.health * scaleFactor;

    enemies.push({
      type, x, y, vx, vy,
      health:  hp,
      maxHealth: hp,
      speed:   ec.speed * (0.8 + Math.random() * 0.4),
      damage:  ec.damage,
      score:   Math.floor(ec.score * scaleFactor),
      fireRate: ec.fireRate,
      fireTimer: Math.random() * ec.fireRate,
      color:   ec.color,
      scale:   ec.scale,
      radius:  ec.scale * 20,
      moveCycle: Math.random() * Math.PI * 2,
      moveAmp:   40 + Math.random() * 60,
      dead: false,
      deathTimer: 0,
      // Capital ship rotation
      angle: 0,
      // Homing target lock
      targetLock: null
    });

    AudioEngine.sfxWarpIn();
  }

  function updateEnemies(dt) {
    const cx = Renderer.cx, cy = Renderer.cy;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dead) { enemies.splice(i, 1); continue; }

      e.moveCycle += dt * 1.2;

      // Movement AI by type
      if (e.type === 'fighter') {
        // Dive toward player with sinusoidal weave
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) {
          e.vx += (dx / dist) * e.speed * 0.8 * dt;
          e.vy += (dy / dist) * e.speed * 0.8 * dt;
        }
        // Weave
        const perp = { x: -dy/dist, y: dx/dist };
        e.vx += perp.x * Math.sin(e.moveCycle * 1.5) * 80 * dt;
        e.vy += perp.y * Math.sin(e.moveCycle * 1.5) * 80 * dt;
        // Dampen
        e.vx *= 0.92;
        e.vy *= 0.92;

      } else if (e.type === 'bomber') {
        // Slow, steady descent with occasional strafe
        e.vy = e.speed * 0.5;
        e.vx = Math.sin(e.moveCycle * 0.5) * e.speed * 0.4;

      } else if (e.type === 'scout') {
        // Fast, erratic
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
        if (dist > 200) {
          e.vx += (dx / dist) * e.speed * dt * 2;
          e.vy += (dy / dist) * e.speed * dt * 2;
        } else {
          // Strafe
          e.vx += (dy / dist) * e.speed * dt;
          e.vy -= (dx / dist) * e.speed * dt;
        }
        e.vx *= 0.88;
        e.vy *= 0.88;

      } else if (e.type === 'capital') {
        // Slow, powerful, moves down screen
        e.angle += dt * 0.3;
        e.vy = e.speed * 0.3;
        e.vx = Math.sin(e.moveCycle * 0.3) * e.speed * 0.3;
        e.vx *= 0.97;
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Keep on screen (x only)
      if (e.x < -100) { e.x = -100; e.vx = Math.abs(e.vx); }
      if (e.x > Renderer.W + 100) { e.x = Renderer.W + 100; e.vx = -Math.abs(e.vx); }

      // Off screen (bottom)
      if (e.y > Renderer.H + 150) {
        enemies.splice(i, 1);
        continue;
      }

      // Fire
      e.fireTimer -= dt * 1000;
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireRate + Math.random() * 400;
        enemyFire(e);
      }
    }
  }

  function enemyFire(e) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
    const speed = 350;

    if (e.type === 'capital') {
      // Multi-shot spread
      for (let a = -2; a <= 2; a++) {
        const angle = Math.atan2(dy, dx) + a * 0.2;
        projectiles.push({
          x: e.x, y: e.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          damage: e.damage,
          owner: 'enemy',
          color: e.color,
          radius: 4,
          length: 14
        });
      }
    } else {
      // Aim at player with slight spread
      const spread = (Math.random() - 0.5) * 0.15;
      const angle  = Math.atan2(dy, dx) + spread;
      projectiles.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: e.damage,
        owner: 'enemy',
        color: e.color,
        radius: 3,
        length: 10
      });
    }
    AudioEngine.sfxEnemyFire();
  }

  /* ═══════════════════════════════════════════════════════════
     PLAYER UPDATE
  ═══════════════════════════════════════════════════════════ */
  function updatePlayer(dt) {
    if (!player) return;

    const speed = player.speed;
    let mx = 0, my = 0;

    // WASD movement
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) mx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) my -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) my += 1;

    // Mouse influence (pull toward mouse)
    const mdx = mouseX - player.x;
    const mdy = mouseY - player.y;
    const mdist = Math.sqrt(mdx*mdx + mdy*mdy);
    if (mdist > 30) {
      mx += (mdx / mdist) * 0.5;
      my += (mdy / mdist) * 0.5;
    }

    if (mx !== 0 || my !== 0) {
      const len = Math.sqrt(mx*mx + my*my);
      player.vx += (mx / len) * speed * 3 * dt;
      player.vy += (my / len) * speed * 3 * dt;
    }

    // Dampen
    player.vx *= 0.85;
    player.vy *= 0.85;

    // Clamp velocity
    const spd = Math.sqrt(player.vx*player.vx + player.vy*player.vy);
    if (spd > speed) { player.vx = player.vx/spd*speed; player.vy = player.vy/spd*speed; }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Roll based on horizontal velocity
    player.roll = player.vx * 0.006;

    // Thrust
    player.thrustLevel = Math.min(1, (Math.abs(player.vx) + Math.abs(player.vy)) / (speed * 0.5));

    // Bounds (with padding)
    const pad = 30;
    player.x = Math.max(pad, Math.min(Renderer.W - pad, player.x));
    player.y = Math.max(pad, Math.min(Renderer.H - pad, player.y));

    // Shooting
    if (mouseDown || keys[' '] || keys['z'] || keys['Z']) {
      playerFire(dt);
    }

    // Weapon switch
    if (keys['1']) player.weapon = 'laser';
    if (keys['2']) player.weapon = 'missile';
    if (keys['3']) player.weapon = 'spread';

    // Fire timers
    Object.keys(player.fireTimers).forEach(w => {
      if (player.fireTimers[w] > 0) player.fireTimers[w] -= dt * 1000;
    });

    // Shield regen
    if (!player.invincible) {
      if (player.shieldRegenTimer > 0) {
        player.shieldRegenTimer -= dt * 1000;
      } else if (player.shields < player.maxShields) {
        player.shields = Math.min(player.maxShields, player.shields + player.shieldRegen * dt);
      }
    }

    // Energy regen
    player.energy = Math.min(player.maxEnergy, player.energy + player.energyRegen * dt);

    // Invincibility timer
    if (player.invincible) {
      player.invincibleTimer -= dt * 1000;
      if (player.invincibleTimer <= 0) player.invincible = false;
    }

    // Combo decay
    if (comboTimer > 0) {
      comboTimer -= dt * 1000;
      if (comboTimer <= 0) { combo = 0; HUD.updateCombo(0); }
    }

    // Active powerup timers
    Object.keys(activePowerups).forEach(type => {
      activePowerups[type] -= dt * 1000;
      if (activePowerups[type] <= 0) delete activePowerups[type];
    });

    // Update HUD bars
    HUD.updateBars(player);
    HUD.updateWeapons(player.weapon);
  }

  function playerFire(dt) {
    const w  = player.weapon;
    const wc = config.weapons[w];
    if (!wc) return;

    const fireRate = activePowerups['rapidfire'] ? wc.fireRate * 0.4 : wc.fireRate;
    if (player.fireTimers[w] > 0) return;
    if (player.energy < wc.energyCost) return;

    player.fireTimers[w] = fireRate;
    player.energy -= wc.energyCost;
    shotsFired++;

    const angle = -Math.PI / 2; // straight up

    if (w === 'laser') {
      const spd = wc.speed;
      const shots = activePowerups['tripleshot'] ? 3 : 1;
      for (let i = 0; i < shots; i++) {
        const spread = shots > 1 ? (i - 1) * 0.18 : 0;
        projectiles.push({
          x: player.x + (i-Math.floor(shots/2))*12, y: player.y - 10,
          vx: Math.sin(spread) * spd,
          vy: -Math.cos(spread) * spd,
          damage: wc.damage + player.dmgBonus,
          owner: 'player',
          color: wc.color,
          radius: 3,
          length: 18,
          weapon: 'laser'
        });
      }
      AudioEngine.sfxLaser();

    } else if (w === 'missile') {
      // Find nearest enemy
      let target = null;
      let minDist = Infinity;
      enemies.forEach(e => {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < minDist) { minDist = d; target = e; }
      });
      projectiles.push({
        x: player.x, y: player.y - 10,
        vx: 0, vy: -wc.speed,
        damage: wc.damage,
        owner: 'player',
        color: wc.color,
        radius: 5,
        length: 12,
        weapon: 'missile',
        target,
        homingStrength: wc.homingStrength
      });
      AudioEngine.sfxMissile();

    } else if (w === 'spread') {
      const pellets     = wc.pellets;
      const spreadAngle = wc.spreadAngle;
      for (let i = 0; i < pellets; i++) {
        const a = angle + (i - Math.floor(pellets/2)) * spreadAngle;
        projectiles.push({
          x: player.x, y: player.y - 8,
          vx: Math.cos(a + Math.PI/2) * wc.speed,
          vy: Math.sin(a + Math.PI/2) * wc.speed - wc.speed,
          damage: wc.damage,
          owner: 'player',
          color: wc.color,
          radius: 3,
          length: 12,
          weapon: 'spread'
        });
      }
      AudioEngine.sfxSpread();
    }
  }

  /* ═══════════════════════════════════════════════════════════
     PROJECTILES
  ═══════════════════════════════════════════════════════════ */
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      // Homing
      if (p.weapon === 'missile' && p.target && !p.target.dead) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
        const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        p.vx += (dx / dist) * p.homingStrength * speed * dt * 2;
        p.vy += (dy / dist) * p.homingStrength * speed * dt * 2;
        // Re-normalize speed
        const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        if (spd > 0) { p.vx = p.vx/spd * speed; p.vy = p.vy/spd * speed; }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Off-screen
      if (p.x < -20 || p.x > Renderer.W+20 || p.y < -50 || p.y > Renderer.H+50) {
        projectiles.splice(i, 1);
        continue;
      }

      // Collision: player projectile → enemies
      if (p.owner === 'player') {
        let hit = false;
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
            hit = true;
            shotsHit++;
            damageEnemy(e, p.damage);
            spawnHitParticles(p.x, p.y, e.color);
            HUD.showDamageNumber(p.x, p.y, p.damage, e.color);
            break;
          }
        }
        if (hit) { projectiles.splice(i, 1); continue; }
      }

      // Collision: enemy projectile → player
      if (p.owner === 'enemy' && !player.invincible && !activePowerups['invincible']) {
        if (Math.hypot(player.x - p.x, player.y - p.y) < player.radius + p.radius) {
          damagePlayer(p.damage);
          spawnHitParticles(p.x, p.y, '#ff2d78');
          projectiles.splice(i, 1);
          continue;
        }
      }
    }
  }

  function damageEnemy(e, dmg) {
    e.health -= dmg;
    if (e.health <= 0) {
      killEnemy(e);
    }
  }

  function killEnemy(e) {
    e.dead = true;
    kills++;
    totalKills++;

    // Combo
    combo++;
    comboTimer = COMBO_TIMEOUT;
    if (combo > bestCombo) bestCombo = combo;
    HUD.updateCombo(combo);

    // Score
    const multiplier = 1 + (combo > 1 ? (combo - 1) * 0.1 : 0);
    const pts = Math.floor(e.score * multiplier);
    score += pts;
    credits += Math.floor(pts * 0.4);
    HUD.updateScore(score);
    HUD.addKillFeed(e.type.toUpperCase());

    // Explosion size based on type
    const radius = e.type === 'capital' ? 140 :
                   e.type === 'bomber'  ? 80  :
                   e.type === 'fighter' ? 55  : 40;
    addExplosion(e.x, e.y, radius, e.color);

    // SFX
    if (e.type === 'capital')     AudioEngine.sfxExplosionCapital();
    else if (e.type === 'bomber') AudioEngine.sfxExplosionLarge();
    else                          AudioEngine.sfxExplosionSmall();

    // Chance to drop powerup
    const dropRoll = Math.random();
    if (dropRoll < 0.22) spawnPowerup(e.x, e.y);

    // Achievement checks
    checkAchievement('first_kill', () => kills >= 1);
    checkAchievement('ace', () => totalKills >= 50);
    if (e.type === 'capital') checkAchievement('capital_killer', () => true);
  }

  function damagePlayer(dmg) {
    if (!player || player.invincible) return;

    if (player.shields > 0) {
      const absorbed = Math.min(player.shields, dmg);
      player.shields -= absorbed;
      dmg -= absorbed;
      AudioEngine.sfxShieldHit();
      player.shieldRegenTimer = player.shieldRegenDelay;
    }

    if (dmg > 0) {
      player.health -= dmg;
      damageThisWave += dmg;
      AudioEngine.sfxHit();
      HUD.triggerDamageFlash();
    }

    if (player.health <= 0) {
      player.lives--;
      if (player.lives <= 0) {
        endGame(false);
      } else {
        // Respawn
        player.health = player.maxHealth * 0.6;
        player.shields = 0;
        player.invincible = true;
        player.invincibleTimer = 3000;
        addExplosion(player.x, player.y, 60, '#00e5ff');
      }
    }

    HUD.updateBars(player);
  }

  /* ═══════════════════════════════════════════════════════════
     EXPLOSIONS & PARTICLES
  ═══════════════════════════════════════════════════════════ */
  function addExplosion(x, y, radius, color) {
    explosions.push({ x, y, radius, color, progress: 0, duration: 0.7 });
    spawnExplosionParticles(x, y, radius, color);
  }

  function spawnExplosionParticles(x, y, radius, color) {
    const count = Math.floor(radius * 0.5) + 5;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = (0.3 + Math.random() * 0.7) * radius * 2;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 0.8 + Math.random() * 0.6,
        size: 1.5 + Math.random() * 3,
        color
      });
    }
  }

  function spawnHitParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 100 + Math.random() * 150;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.4,
        size: 1 + Math.random() * 2,
        color
      });
    }
  }

  function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.progress += dt / e.duration;
      if (e.progress >= 1) explosions.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt; // slight gravity
      p.vx *= 0.97;
      p.vy *= 0.97;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     POWERUPS
  ═══════════════════════════════════════════════════════════ */
  const POWERUP_TYPES = ['health','shield','energy','rapidfire','tripleshot','invincible'];
  const POWERUP_SYMBOLS = { health:'❤️', shield:'🛡️', energy:'⚡', rapidfire:'🔥', tripleshot:'✨', invincible:'⭐' };

  function spawnPowerup(x, y) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    const pc   = config.powerups[type];
    powerups.push({ x, y, type, color: pc.color, vy: 60, life: 12, radius: 15, pulse: 0 });
  }

  function updatePowerups(dt) {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;
      p.life -= dt;
      p.pulse = Math.sin(time * 5) * 0.5 + 0.5;

      if (p.life <= 0 || p.y > Renderer.H + 50) {
        powerups.splice(i, 1);
        continue;
      }

      // Pickup
      if (Math.hypot(player.x - p.x, player.y - p.y) < player.radius + p.radius + 10) {
        collectPowerup(p);
        powerups.splice(i, 1);
      }
    }
  }

  function collectPowerup(p) {
    const pc = config.powerups[p.type];
    AudioEngine.sfxPowerup();

    switch (p.type) {
      case 'health':
        player.health = Math.min(player.maxHealth, player.health + pc.value);
        break;
      case 'shield':
        player.shields = Math.min(player.maxShields, player.shields + pc.value);
        break;
      case 'energy':
        player.energy = Math.min(player.maxEnergy, player.energy + pc.value);
        break;
      default:
        activePowerups[p.type] = pc.duration;
        break;
    }

    const label = { health:'HEALTH +30', shield:'SHIELD +50', energy:'ENERGY +60',
                    rapidfire:'RAPID FIRE', tripleshot:'TRIPLE SHOT', invincible:'INVINCIBLE' };
    HUD.showPowerupNotify(label[p.type], pc.color);
    HUD.updateBars(player);
  }

  /* ═══════════════════════════════════════════════════════════
     STARFIELD
  ═══════════════════════════════════════════════════════════ */
  function updateStarfield(dt) {
    starLayers.forEach((layer, li) => {
      layer.stars.forEach(star => {
        star.y += layer.speed * 60 * dt;
        star.twinkle += dt * 2;
        if (star.y > Renderer.H + 5) {
          star.y = -5;
          star.x = Math.random() * Renderer.W;
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     WAVE MANAGEMENT
  ═══════════════════════════════════════════════════════════ */
  let spawnTimers = [];

  function updateWave(dt) {
    if (!waveActive) return;

    // Process spawn queue
    const now = time * 1000;
    const waveStartTime = (time - dt) * 1000; // approximate

    // Use a different approach: track elapsed wave time
    if (!Game._waveElapsed) Game._waveElapsed = 0;
    Game._waveElapsed += dt * 1000;

    while (spawnQueue.length > 0 && spawnQueue[0].delay <= Game._waveElapsed) {
      const item = spawnQueue.shift();
      spawnEnemy(item.type, item.scaleFactor);
    }

    // Wave complete?
    if (!waveComplete && spawnQueue.length === 0 && enemies.length === 0) {
      waveComplete = true;
      Game._waveElapsed = 0;

      // Check achievement
      if (damageThisWave === 0) checkAchievement('no_damage', () => true);
      checkAchievement('wave5', () => wave >= 5);
      checkAchievement('wave10', () => wave >= 10);
      checkAchievement('score10k', () => score >= 10000);

      if (wave >= config.waves.length) {
        setTimeout(() => endGame(true), 2000);
      } else {
        // Show upgrade screen between waves
        setState('upgrade');
        HUD.showWaveComplete(wave);
        AudioEngine.sfxLevelUp();
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     MAIN LOOP
  ═══════════════════════════════════════════════════════════ */
  function gameLoop(timestamp) {
    deltaTime = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime  = timestamp;

    if (state !== 'playing') {
      animFrame = requestAnimationFrame(gameLoop);
      return;
    }

    time += deltaTime;

    // Updates
    updateStarfield(deltaTime);
    if (player) {
      updatePlayer(deltaTime);
      updateEnemies(deltaTime);
      updateProjectiles(deltaTime);
      updateExplosions(deltaTime);
      updateParticles(deltaTime);
      updatePowerups(deltaTime);
      updateWave(deltaTime);
    }

    // Render
    render();

    animFrame = requestAnimationFrame(gameLoop);
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  function render() {
    Renderer.clear();

    // Nebulae
    nebulae.forEach(n => Renderer.drawNebula(n.x, n.y, n.rx, n.ry, n.colorA, n.colorB, n.op));

    // Grid
    Renderer.drawGrid(time * 60, 60);

    // Starfield
    starLayers.forEach(layer => {
      layer.stars.forEach(star => {
        const twinkle = 0.7 + Math.sin(star.twinkle) * 0.3;
        Renderer.drawStar(star.x, star.y, star.size, star.opacity * twinkle);
      });
    });

    // Powerups
    powerups.forEach(p => {
      const sym = POWERUP_SYMBOLS[p.type] || '?';
      Renderer.drawPowerup(p.x, p.y, p.color, sym, p.pulse);
    });

    // Particles
    particles.forEach(p => {
      const opacity = p.life / p.maxLife;
      Renderer.drawParticle(p.x, p.y, p.size, p.color, opacity);
    });

    // Explosions
    explosions.forEach(e => {
      Renderer.drawExplosion(e.x, e.y, e.progress, e.radius, e.color);
    });

    // Enemies
    enemies.forEach(e => {
      switch (e.type) {
        case 'fighter': Renderer.drawFighter(e.x, e.y, e.scale, e.color, e.health, e.maxHealth); break;
        case 'bomber':  Renderer.drawBomber (e.x, e.y, e.scale, e.color, e.health, e.maxHealth); break;
        case 'scout':   Renderer.drawScout  (e.x, e.y, e.scale, e.color, e.health, e.maxHealth); break;
        case 'capital': Renderer.drawCapital(e.x, e.y, e.scale, e.color, e.health, e.maxHealth, time); break;
      }
    });

    // Enemy projectiles
    projectiles.filter(p => p.owner === 'enemy').forEach(p => {
      const angle = Math.atan2(p.vy, p.vx) + Math.PI/2;
      Renderer.drawProjectile(p.x, p.y, angle, p.length, p.color, '#ff8800');
    });

    // Player
    if (player) {
      // Invincibility flicker
      if (!player.invincible || Math.sin(time * 20) > 0) {
        Renderer.drawPlayerShip(player.x, player.y, player.roll, player.thrustLevel);
      }
    }

    // Player projectiles (drawn on top)
    projectiles.filter(p => p.owner === 'player').forEach(p => {
      if (p.weapon === 'missile') {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI/2;
        Renderer.drawMissile(p.x, p.y, angle);
      } else {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI/2;
        const glow  = p.weapon === 'spread' ? '#ff00ff' : p.weapon === 'laser' ? '#00ffff' : '#ff6600';
        Renderer.drawProjectile(p.x, p.y, angle, p.length, p.color, glow);
      }
    });

    // Minimap
    HUD.renderMinimap(enemies, player);
  }

  /* ═══════════════════════════════════════════════════════════
     STATE & GAME OVER
  ═══════════════════════════════════════════════════════════ */
  function setState(s) {
    state = s;
    HUD.setState(s);
  }

  function endGame(victory) {
    playTime = (performance.now() - playStart) / 1000;
    AudioEngine.stopMusic();

    if (victory) {
      setState('victory');
      AudioEngine.sfxVictory();
      HUD.showVictory(score, totalKills, bestCombo, Math.round(playTime));
    } else {
      setState('gameover');
      AudioEngine.sfxGameOver();
      HUD.showGameOver(score, totalKills, bestCombo, wave, Math.round(playTime));
    }
  }

  function continueAfterUpgrade() {
    setState('playing');
    nextWave();
  }

  /* ═══════════════════════════════════════════════════════════
     UPGRADES
  ═══════════════════════════════════════════════════════════ */
  function getUpgradesData() { return upgradesData; }
  function getCredits() { return credits; }
  function getUpgradeLevels() { return upgradeLevels; }

  function purchaseUpgrade(id) {
    if (!upgradesData) return false;
    const upg = upgradesData.upgrades.find(u => u.id === id);
    if (!upg) return false;

    const curLevel = upgradeLevels[id] || 0;
    if (curLevel >= upg.maxLevel) return false;

    const cost = upg.cost * (curLevel + 1);
    if (credits < cost) return false;

    credits -= cost;
    upgradeLevels[id] = curLevel + 1;

    // Apply upgrade to player immediately if in game
    if (player && upg.effect) {
      const { stat, value } = upg.effect;
      if (stat === 'health')      { player.maxHealth += value; player.health = Math.min(player.health + value, player.maxHealth); }
      if (stat === 'shields')     { player.maxShields += value; }
      if (stat === 'speed')       { player.speed += value; }
      if (stat === 'laserDamage') { player.dmgBonus += value; }
      if (stat === 'energy')      { player.maxEnergy += value; }
      if (stat === 'shieldRegen') { player.shieldRegen += value; }
    }

    return true;
  }

  /* ═══════════════════════════════════════════════════════════
     ACHIEVEMENTS
  ═══════════════════════════════════════════════════════════ */
  function checkAchievement(id, condFn) {
    if (earnedAchievements.has(id)) return;
    if (!condFn()) return;
    earnedAchievements.add(id);

    if (!upgradesData) return;
    const ach = upgradesData.achievements.find(a => a.id === id);
    if (!ach) return;

    credits += ach.reward;
    HUD.showAchievement(ach.name, ach.description, ach.reward);
  }

  /* ═══════════════════════════════════════════════════════════
     INPUT
  ═══════════════════════════════════════════════════════════ */
  function setupInput() {
    window.addEventListener('keydown', e => {
      keys[e.key] = true;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (state === 'playing') setState('paused');
        else if (state === 'paused') setState('playing');
      }
      if (e.key === '1') player && (player.weapon = 'laser');
      if (e.key === '2') player && (player.weapon = 'missile');
      if (e.key === '3') player && (player.weapon = 'spread');
      e.preventDefault();
    });

    window.addEventListener('keyup', e => {
      keys[e.key] = false;
    });

    window.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    window.addEventListener('mousedown', e => {
      if (e.button === 0) mouseDown = true;
      AudioEngine.resume();
    });

    window.addEventListener('mouseup', e => {
      if (e.button === 0) mouseDown = false;
    });
  }

  /* ═══════════════════════════════════════════════════════════
     START
  ═══════════════════════════════════════════════════════════ */
  function start() {
    lastTime = performance.now();
    animFrame = requestAnimationFrame(gameLoop);
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════════ */
  return {
    init, start, startGame, continueAfterUpgrade,
    setState,
    getState: () => state,
    getUpgradesData, getCredits, getUpgradeLevels, purchaseUpgrade,
    getScore:   () => score,
    getWave:    () => wave,
    _waveElapsed: 0
  };

})();
