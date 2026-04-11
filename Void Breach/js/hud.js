/* ============================================================
   VOID BREACH — HUD Manager
   All DOM-based HUD updates, screen transitions, overlays
   ============================================================ */

'use strict';

const HUD = (() => {

  /* ── Element refs ───────────────────────────────────────── */
  let healthFill, shieldFill, energyFill;
  let scoreDisplay, waveDisplay, livesDisplay;
  let weaponSlots;
  let waveAnnounce, waveAnnounceNum;
  let killfeed;
  let damageFlash;
  let powerupNotify, powerupTimer;
  let comboCount, comboLabel;
  let bossBarContainer, bossBarFill, bossName;
  let minimapCanvas, minimapCtx;
  let achievementToast;
  let screenFlash;

  // Screens
  let screens = {};

  function init() {
    healthFill    = document.getElementById('health-fill');
    shieldFill    = document.getElementById('shield-fill');
    energyFill    = document.getElementById('energy-fill');
    scoreDisplay  = document.getElementById('score-display');
    waveDisplay   = document.getElementById('wave-display');
    livesDisplay  = document.getElementById('lives-display');
    killfeed      = document.getElementById('killfeed');
    damageFlash   = document.getElementById('damage-flash');
    powerupNotify = document.getElementById('powerup-notify');
    waveAnnounce  = document.getElementById('wave-announce');
    waveAnnounceNum = document.getElementById('wave-num');
    comboCount    = document.getElementById('combo-count');
    comboLabel    = document.getElementById('combo-label');
    bossBarContainer = document.getElementById('boss-bar-container');
    bossBarFill   = document.getElementById('boss-bar-fill');
    bossName      = document.getElementById('boss-name');
    achievementToast = document.getElementById('achievement-toast');
    screenFlash   = document.getElementById('screen-flash');

    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) minimapCtx = minimapCanvas.getContext('2d');

    weaponSlots = {
      laser:   document.getElementById('slot-laser'),
      missile: document.getElementById('slot-missile'),
      spread:  document.getElementById('slot-spread')
    };

    screens = {
      title:    document.getElementById('screen-title'),
      playing:  null,
      paused:   document.getElementById('screen-pause'),
      gameover: document.getElementById('screen-gameover'),
      victory:  document.getElementById('screen-victory'),
      upgrade:  document.getElementById('screen-upgrade')
    };

    setState('title');
  }

  /* ── State / screen management ───────────────────────────── */
  function setState(state) {
    // Hide all screens
    Object.values(screens).forEach(s => s && s.classList.remove('active'));

    if (state === 'playing') {
      document.getElementById('hud').style.display = '';
    } else if (state === 'title') {
      document.getElementById('hud').style.display = 'none';
      screens.title && screens.title.classList.add('active');
    } else if (state === 'paused') {
      screens.paused && screens.paused.classList.add('active');
    } else if (state === 'gameover') {
      document.getElementById('hud').style.display = 'none';
      screens.gameover && screens.gameover.classList.add('active');
    } else if (state === 'victory') {
      document.getElementById('hud').style.display = 'none';
      screens.victory && screens.victory.classList.add('active');
    } else if (state === 'upgrade') {
      screens.upgrade && screens.upgrade.classList.add('active');
      buildUpgradeScreen();
    }
  }

  /* ── HUD bar updates ─────────────────────────────────────── */
  function updateBars(player) {
    if (!player) return;

    const hp = (player.health / player.maxHealth) * 100;
    const sh = (player.shields / player.maxShields) * 100;
    const en = (player.energy / player.maxEnergy) * 100;

    if (healthFill) {
      healthFill.style.width = `${Math.max(0, hp)}%`;
      healthFill.classList.toggle('critical', hp < 25);
    }
    if (shieldFill) shieldFill.style.width = `${Math.max(0, sh)}%`;
    if (energyFill) energyFill.style.width = `${Math.max(0, en)}%`;
    if (livesDisplay) livesDisplay.textContent = '♦'.repeat(Math.max(0, player.lives));
  }

  /* ── Score ───────────────────────────────────────────────── */
  function updateScore(score) {
    if (!scoreDisplay) return;
    scoreDisplay.textContent = score.toLocaleString();
    scoreDisplay.classList.remove('pop');
    void scoreDisplay.offsetWidth;
    scoreDisplay.classList.add('pop');
    setTimeout(() => scoreDisplay.classList.remove('pop'), 300);
  }

  /* ── Wave display ────────────────────────────────────────── */
  function showWaveAnnounce(waveNum) {
    if (!waveAnnounce) return;
    if (waveAnnounceNum) waveAnnounceNum.textContent = waveNum;
    if (waveDisplay) waveDisplay.textContent = `WAVE ${waveNum}`;
    waveAnnounce.classList.add('show');
    setTimeout(() => waveAnnounce.classList.remove('show'), 2500);
  }

  function showWaveComplete(waveNum) {
    // Brief flash before upgrade screen
    if (screenFlash) {
      screenFlash.className = 'white-flash';
      setTimeout(() => screenFlash.className = '', 500);
    }
  }

  /* ── Kill feed ───────────────────────────────────────────── */
  function addKillFeed(label) {
    if (!killfeed) return;
    const el = document.createElement('div');
    el.className = 'killfeed-entry';
    el.textContent = `✕ ${label} DESTROYED`;
    killfeed.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2500);
    // Keep max 4
    while (killfeed.children.length > 4) killfeed.removeChild(killfeed.firstChild);
  }

  /* ── Damage flash ────────────────────────────────────────── */
  function triggerDamageFlash() {
    if (!damageFlash) return;
    damageFlash.classList.add('flash');
    setTimeout(() => damageFlash.classList.remove('flash'), 150);
  }

  /* ── Powerup notify ──────────────────────────────────────── */
  let powerupHideTimer = null;
  function showPowerupNotify(text, color) {
    if (!powerupNotify) return;
    powerupNotify.textContent = text;
    powerupNotify.style.color = color || '#00ff88';
    powerupNotify.style.textShadow = `0 0 8px ${color}, 0 0 20px ${color}44`;
    powerupNotify.classList.add('show');
    if (powerupHideTimer) clearTimeout(powerupHideTimer);
    powerupHideTimer = setTimeout(() => powerupNotify.classList.remove('show'), 2000);
  }

  /* ── Weapon selector ─────────────────────────────────────── */
  function updateWeapons(current) {
    Object.entries(weaponSlots).forEach(([w, el]) => {
      if (!el) return;
      el.classList.toggle('active', w === current);
    });
  }

  /* ── Combo ───────────────────────────────────────────────── */
  function updateCombo(n) {
    if (!comboCount || !comboLabel) return;
    if (n < 2) {
      comboCount.classList.remove('visible');
      comboLabel.classList.remove('visible');
    } else {
      comboCount.textContent  = `${n}x`;
      comboCount.classList.add('visible', 'bump');
      comboLabel.classList.add('visible');
      setTimeout(() => comboCount.classList.remove('bump'), 200);
    }
  }

  /* ── Boss bar ────────────────────────────────────────────── */
  function showBossBar(name, hp, maxHp) {
    if (!bossBarContainer) return;
    if (bossName) bossName.textContent = name;
    updateBossBar(hp, maxHp);
    bossBarContainer.classList.add('visible');
  }

  function updateBossBar(hp, maxHp) {
    if (!bossBarFill) return;
    bossBarFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
  }

  function hideBossBar() {
    if (bossBarContainer) bossBarContainer.classList.remove('visible');
  }

  /* ── Damage numbers ──────────────────────────────────────── */
  function showDamageNumber(x, y, dmg, color) {
    const el = document.createElement('div');
    el.className = 'damage-number';
    el.style.left    = `${x}px`;
    el.style.top     = `${y - 20}px`;
    el.style.fontSize = `${Math.min(24, 10 + dmg / 3)}px`;
    el.style.color   = color || '#ffffff';
    el.textContent   = Math.round(dmg);
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1300);
  }

  /* ── Minimap ─────────────────────────────────────────────── */
  function renderMinimap(enemies, player) {
    if (!minimapCtx || !player) return;
    const mw = minimapCanvas.width  = 100;
    const mh = minimapCanvas.height = 100;
    const ctx = minimapCtx;

    ctx.clearRect(0, 0, mw, mh);

    // BG
    ctx.fillStyle = 'rgba(0,20,40,0.5)';
    ctx.beginPath();
    ctx.arc(mw/2, mh/2, mw/2, 0, Math.PI*2);
    ctx.fill();

    // Grid
    ctx.strokeStyle = 'rgba(0,229,255,0.1)';
    ctx.lineWidth = 0.5;
    [mw*0.25, mw*0.5, mw*0.75].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(mw, x); ctx.stroke();
    });

    const scaleX = mw / Renderer.W;
    const scaleY = mh / Renderer.H;

    // Enemies
    enemies.forEach(e => {
      const mx = e.x * scaleX;
      const my = e.y * scaleY;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI*2);
      ctx.fillStyle = e.color;
      ctx.fill();
    });

    // Player
    const px = player.x * scaleX;
    const py = player.y * scaleY;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI*2);
    ctx.fillStyle = '#00e5ff';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00e5ff';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Circle border
    ctx.beginPath();
    ctx.arc(mw/2, mh/2, mw/2 - 1, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(0,229,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ── Achievement toast ───────────────────────────────────── */
  let achTimer = null;
  function showAchievement(name, desc, reward) {
    if (!achievementToast) return;
    achievementToast.querySelector('.ach-name').textContent = name;
    achievementToast.querySelector('.ach-desc').textContent = `${desc} (+${reward} credits)`;
    achievementToast.classList.add('show');
    if (achTimer) clearTimeout(achTimer);
    achTimer = setTimeout(() => achievementToast.classList.remove('show'), 3500);
  }

  /* ── Game Over screen ────────────────────────────────────── */
  function showGameOver(score, kills, combo, wave, time) {
    const el = document.getElementById('screen-gameover');
    if (!el) return;
    safeSet('go-score',  score.toLocaleString());
    safeSet('go-kills',  kills);
    safeSet('go-combo',  `${combo}x`);
    safeSet('go-wave',   wave);
    safeSet('go-time',   formatTime(time));
  }

  /* ── Victory screen ──────────────────────────────────────── */
  function showVictory(score, kills, combo, time) {
    safeSet('v-score',  score.toLocaleString());
    safeSet('v-kills',  kills);
    safeSet('v-combo',  `${combo}x`);
    safeSet('v-time',   formatTime(time));
  }

  /* ── Upgrade screen ──────────────────────────────────────── */
  function buildUpgradeScreen() {
    const el = document.getElementById('upgrade-grid');
    if (!el) return;

    const data   = Game.getUpgradesData();
    const levels = Game.getUpgradeLevels();
    const creds  = Game.getCredits();

    document.getElementById('up-credits-val') &&
      (document.getElementById('up-credits-val').textContent = creds.toLocaleString());

    if (!data) return;

    el.innerHTML = '';
    data.upgrades.forEach(upg => {
      const curLevel = levels[upg.id] || 0;
      const cost     = upg.cost * (curLevel + 1);
      const maxed    = curLevel >= upg.maxLevel;
      const affordable = creds >= cost;

      const card = document.createElement('div');
      card.className = 'upgrade-card' +
        (maxed ? ' maxed' : '') +
        (!affordable && !maxed ? ' cant-afford' : '');

      card.innerHTML = `
        <div class="uc-level">LV <span>${curLevel}</span>/${upg.maxLevel}</div>
        <div class="uc-icon">${upg.icon}</div>
        <div class="uc-name">${upg.name}</div>
        <div class="uc-desc">${upg.description}</div>
        <div class="uc-cost">${maxed ? 'MAX' : `${cost.toLocaleString()} CREDITS`}</div>
      `;

      if (!maxed) {
        card.addEventListener('click', () => {
          if (Game.purchaseUpgrade(upg.id)) {
            AudioEngine.sfxPowerup();
            buildUpgradeScreen();
          }
        });
      }
      el.appendChild(card);
    });
  }

  /* ── Utils ───────────────────────────────────────────────── */
  function safeSet(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  return {
    init, setState,
    updateBars, updateScore, updateWeapons, updateCombo,
    showWaveAnnounce, showWaveComplete, addKillFeed,
    triggerDamageFlash, showPowerupNotify, showDamageNumber,
    showBossBar, updateBossBar, hideBossBar,
    renderMinimap, showAchievement,
    showGameOver, showVictory, buildUpgradeScreen
  };

})();
