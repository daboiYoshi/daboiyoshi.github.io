/* ============================================================
   VOID BREACH — Audio Engine (Web Audio API procedural SFX)
   ============================================================ */

'use strict';

const AudioEngine = (() => {

  let ctx = null;
  let masterGain, sfxGain, musicGain;
  let musicOscillators = [];
  let musicPlaying = false;
  let initialized = false;

  function init() {
    if (initialized) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.7;
      sfxGain.connect(masterGain);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.18;
      musicGain.connect(masterGain);

      initialized = true;
    } catch(e) {
      console.warn('Audio not available', e);
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /* ── Noise buffer ───────────────────────────────────────── */
  function createNoise(dur, type) {
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (type === 'pink') {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i=0; i<bufLen; i++) {
        const w = Math.random()*2-1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
        b6 = w * 0.115926;
      }
    } else {
      for (let i=0; i<bufLen; i++) data[i] = Math.random()*2-1;
    }
    return buf;
  }

  /* ── SFX helpers ────────────────────────────────────────── */
  function playTone(freq, type, dur, gainVal, detune, when) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type      = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (detune) osc.detune.value = detune;
    g.gain.setValueAtTime(gainVal || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function playNoise(dur, gainVal, lowFreq, highFreq) {
    if (!ctx) return;
    const buf  = createNoise(dur, 'white');
    const src  = ctx.createBufferSource();
    const g    = ctx.createGain();
    const flt  = ctx.createBiquadFilter();
    src.buffer = buf;
    flt.type   = 'bandpass';
    flt.frequency.value = (lowFreq + highFreq) / 2;
    flt.Q.value = 0.5;
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(sfxGain);
    src.start(); src.stop(ctx.currentTime + dur + 0.05);
  }

  /* ── SFX ────────────────────────────────────────────────── */
  function sfxLaser() {
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone(1200, 'sawtooth', 0.08, 0.25, 0, t);
    playTone(800,  'square',   0.12, 0.15, 100, t);
    // Sweep down
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type  = 'sawtooth';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.15);
  }

  function sfxMissile() {
    if (!ctx) return;
    const t = ctx.currentTime;
    playNoise(0.2, 0.4, 200, 800);
    playTone(180, 'sawtooth', 0.3, 0.2, 0, t);
  }

  function sfxSpread() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        playTone(900 + Math.random()*200, 'square', 0.07, 0.15, Math.random()*200-100);
      }, i * 15);
    }
  }

  function sfxExplosionSmall() {
    if (!ctx) return;
    playNoise(0.4, 0.5, 100, 600);
    playTone(120, 'sawtooth', 0.3, 0.2);
  }

  function sfxExplosionLarge() {
    if (!ctx) return;
    playNoise(0.8, 0.8, 40, 400);
    playTone(60,  'sawtooth', 0.5, 0.3);
    playTone(90,  'square',   0.4, 0.2, 0, ctx.currentTime + 0.1);
  }

  function sfxExplosionCapital() {
    if (!ctx) return;
    playNoise(1.5, 1.0, 20, 300);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        playTone(50 + Math.random()*40, 'sawtooth', 0.6, 0.4);
        playNoise(0.4, 0.5, 30, 200);
      }, i * 150);
    }
  }

  function sfxHit() {
    if (!ctx) return;
    playTone(300, 'square', 0.06, 0.3, 0);
    playNoise(0.05, 0.3, 400, 1200);
  }

  function sfxShieldHit() {
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone(800, 'sine', 0.15, 0.4, 0, t);
    playTone(600, 'sine', 0.12, 0.2, 0, t + 0.05);
    playNoise(0.08, 0.2, 600, 2000);
  }

  function sfxPowerup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      playTone(f, 'sine', 0.15, 0.25, 0, t + i * 0.06);
    });
  }

  function sfxWarpIn() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.7);
  }

  function sfxGameOver() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [440, 330, 220, 165].forEach((f, i) => {
      playTone(f, 'sawtooth', 0.4, 0.3, 0, t + i * 0.2);
    });
  }

  function sfxVictory() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const melody = [523, 659, 784, 659, 784, 1047];
    melody.forEach((f, i) => {
      playTone(f, 'sine', 0.25, 0.4, 0, t + i * 0.12);
      playTone(f*0.5, 'triangle', 0.25, 0.2, 0, t + i * 0.12);
    });
  }

  function sfxEnemyFire() {
    if (!ctx) return;
    playTone(600 + Math.random()*200, 'sawtooth', 0.07, 0.12, 200);
  }

  function sfxLevelUp() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [262, 330, 392, 523].forEach((f, i) => {
      playTone(f, 'triangle', 0.2, 0.35, 0, t + i * 0.08);
    });
  }

  /* ── Ambient music ──────────────────────────────────────── */
  // Simple procedural synth ambient loop
  function startMusic() {
    if (!ctx || musicPlaying) return;
    musicPlaying = true;

    const chords = [
      [65, 82, 110],  // F2
      [55, 69, 92],   // A1
      [49, 62, 82],   // B1
      [58, 73, 98]    // Bb1
    ];

    let step = 0;

    function playChord() {
      if (!musicPlaying) return;
      const chord = chords[step % chords.length];
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        const flt = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        flt.type = 'lowpass';
        flt.frequency.value = 400;
        flt.Q.value = 1;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.4);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.8);
        osc.connect(flt); flt.connect(g); g.connect(musicGain);
        osc.start(); osc.stop(ctx.currentTime + 4.2);
        musicOscillators.push(osc);
      });
      step++;
      setTimeout(playChord, 4000);
    }

    // Pulse bass
    function playBass() {
      if (!musicPlaying) return;
      const freqs = [55, 55, 49, 58];
      const f = freqs[step % freqs.length];
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type  = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(g); g.connect(musicGain);
      osc.start(); osc.stop(ctx.currentTime + 1);
      setTimeout(playBass, 1000);
    }

    playChord();
    setTimeout(playBass, 500);
  }

  function stopMusic() {
    musicPlaying = false;
    musicOscillators.forEach(o => { try { o.stop(); } catch(e){} });
    musicOscillators = [];
  }

  function setVolumes(master, sfx, music) {
    if (!ctx) return;
    if (masterGain) masterGain.gain.value = master;
    if (sfxGain)    sfxGain.gain.value    = sfx;
    if (musicGain)  musicGain.gain.value  = music * 0.3;
  }

  return {
    init, resume, startMusic, stopMusic, setVolumes,
    sfxLaser, sfxMissile, sfxSpread, sfxExplosionSmall, sfxExplosionLarge,
    sfxExplosionCapital, sfxHit, sfxShieldHit, sfxPowerup, sfxWarpIn,
    sfxGameOver, sfxVictory, sfxEnemyFire, sfxLevelUp
  };
})();
