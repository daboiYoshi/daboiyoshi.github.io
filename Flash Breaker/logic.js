const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");

canvas.width = 800;
canvas.height = 500;

let score = 0;
let lives = 3;
let paused = true;

const paddle = { width: 100, height: 15, x: 350, speed: 9, dx: 0 };
const ball = { x: 400, y: 450, radius: 6, dx: 4, dy: -4, speed: 5 };

const brickRows = 5;
const brickCols = 9;
const bricks = [];
for (let c = 0; c < brickCols; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRows; r++) {
        bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
}

// --- SHEPARD TONE AUDIO ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Game Sound Effects
function playTone(freq, type, duration, vol = 0.1) {
    if (audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// The Shepard Tone Music Loop
let shepardPosition = 0;
function startShepardMusic() {
    setInterval(() => {
        if (!paused) {
            // We play 5 octaves simultaneously
            for (let i = -2; i <= 2; i++) {
                const baseFreq = 440 * Math.pow(2, shepardPosition); // Rising frequency
                const freq = baseFreq * Math.pow(2, i);
                
                // Gaussian-like envelope to fade in/out at the frequency extremes
                const loudness = Math.exp(-Math.pow(i + shepardPosition, 2) / 0.8);
                
                playTone(freq, 'sine', 0.6, loudness * 0.05);
            }
            
            shepardPosition += 0.02; // How fast the pitch rises
            if (shepardPosition >= 1) shepardPosition = 0; // Reset octave loop
        }
    }, 150); 
}

// --- GAME FUNCTIONS (Kept the same) ---
function move() {
    paddle.x += paddle.dx;
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.dx *= -1;
        playTone(800, 'square', 0.05, 0.02);
    }
    if (ball.y - ball.radius < 0) {
        ball.dy *= -1;
        playTone(800, 'square', 0.05, 0.02);
    }

    if (ball.y + ball.radius > canvas.height - paddle.height) {
        if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
            ball.dy = -ball.speed;
            playTone(150, 'square', 0.1, 0.1);
        } else if (ball.y + ball.radius > canvas.height) {
            lives--;
            livesEl.innerText = lives;
            playTone(50, 'sawtooth', 0.5, 0.2);
            if (lives <= 0) location.reload();
            else { ball.x = 400; ball.y = 400; ball.dy = -4; }
        }
    }
}

function collision() {
    for (let c = 0; c < brickCols; c++) {
        for (let r = 0; r < brickRows; r++) {
            let b = bricks[c][r];
            if (b.status === 1) {
                let bx = c * 85 + 25;
                let by = r * 25 + 50;
                if (ball.x > bx && ball.x < bx + 80 && ball.y > by && ball.y < by + 20) {
                    ball.dy *= -1;
                    b.status = 0;
                    score += 10;
                    scoreEl.innerText = score;
                    playTone(600 + (r * 100), 'square', 0.1, 0.05);
                }
            }
        }
    }
}

function draw() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let c = 0; c < brickCols; c++) {
        for (let r = 0; r < brickRows; r++) {
            if (bricks[c][r].status === 1) {
                const colors = ["#ff0044", "#00ffff", "#ffcc00", "#ff00ff", "#00ff00"];
                ctx.fillStyle = colors[r];
                ctx.fillRect(c * 85 + 25, r * 25 + 50, 80, 20);
                ctx.fillStyle = "rgba(255,255,255,0.3)";
                ctx.fillRect(c * 85 + 25, r * 25 + 50, 80, 4);
            }
        }
    }
    
    ctx.fillStyle = "#fff";
    ctx.fillRect(ball.x - 5, ball.y - 5, 10, 10);

    ctx.fillStyle = "#fff";
    ctx.fillRect(paddle.x, canvas.height - paddle.height, paddle.width, paddle.height);
}

function loop() {
    if (!paused) {
        move();
        collision();
        draw();
        requestAnimationFrame(loop);
    }
}

function startGame() {
    audioCtx.resume().then(() => {
        overlay.style.display = "none";
        paused = false;
        startShepardMusic();
        loop();
    });
}

startBtn.addEventListener("click", startGame);
window.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") paddle.dx = paddle.speed;
    if (e.key === "ArrowLeft") paddle.dx = -paddle.speed;
});
window.addEventListener("keyup", () => paddle.dx = 0);