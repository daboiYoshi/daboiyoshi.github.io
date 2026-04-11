const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const overlay = document.getElementById('overlay');
const msgTitle = document.getElementById('msg-title');
const msgBody = document.getElementById('msg-body');
const startBtn = document.getElementById('start-btn');

// Game Configuration
const gridSize = 20;
const tileCount = 20;
canvas.width = gridSize * tileCount;
canvas.height = gridSize * tileCount;

let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
highScoreEl.textContent = String(highScore).padStart(3, '0');

let snake = [];
let food = { x: 5, y: 5 };
let dx = 0;
let dy = 0;
let nextDx = 1;
let nextDy = 0;
let gameLoop;
let speed = 120;
let lastTimestamp = 0;
let shakeTime = 0;

function drawApple(x, y) {
    const px = x * gridSize;
    const py = y * gridSize;
    const s = gridSize / 8;

    ctx.fillStyle = '#ef4444'; 
    ctx.fillRect(px + s*2, py + s*2, s*4, s*5);
    ctx.fillRect(px + s, py + s*3, s*6, s*3);
    
    ctx.fillStyle = '#991b1b'; 
    ctx.fillRect(px + s*4, py + s*5, s*2, s*2);

    ctx.fillStyle = '#4ade80'; 
    ctx.fillRect(px + s*4, py, s, s*2);
    ctx.fillRect(px + s*5, py, s*2, s);
}

function drawSnakeSegment(segment, index, isHead) {
    const px = segment.x * gridSize;
    const py = segment.y * gridSize;
    const s = gridSize / 8;

    ctx.fillStyle = '#166534'; 
    ctx.fillRect(px, py, gridSize, gridSize);
    ctx.fillStyle = '#4ade80'; 
    ctx.fillRect(px + s, py + s, gridSize - s*2, gridSize - s*2);

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(px + s*2, py + s*2, s*2, s*2);
    ctx.fillRect(px + s*5, py + s*5, s*2, s*2);

    if (isHead) {
        ctx.fillStyle = '#000'; 
        if (dx === 1) { 
            ctx.fillRect(px + s*5, py + s*2, s, s);
            ctx.fillRect(px + s*5, py + s*5, s, s);
        } else if (dx === -1) { 
            ctx.fillRect(px + s*2, py + s*2, s, s);
            ctx.fillRect(px + s*2, py + s*5, s, s);
        } else if (dy === 1) { 
            ctx.fillRect(px + s*2, py + s*5, s, s);
            ctx.fillRect(px + s*5, py + s*5, s, s);
        } else { 
            ctx.fillRect(px + s*2, py + s*2, s, s);
            ctx.fillRect(px + s*5, py + s*2, s, s);
        }
        
        if (Math.floor(Date.now() / 300) % 2 === 0) {
            ctx.fillStyle = '#ef4444';
            if (dx === 1) ctx.fillRect(px + gridSize, py + s*3, s*2, s*2);
            if (dx === -1) ctx.fillRect(px - s*2, py + s*3, s*2, s*2);
            if (dy === 1) ctx.fillRect(px + s*3, py + gridSize, s*2, s*2);
            if (dy === -1) ctx.fillRect(px + s*3, py - s*2, s*2, s*2);
        }
    }
}

function initGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    score = 0;
    speed = 120;
    scoreEl.textContent = '000';
    nextDx = 1;
    nextDy = 0;
    dx = 1;
    dy = 0;
    placeFood();
    overlay.classList.add('hidden');
    requestAnimationFrame(main);
}

function placeFood() {
    food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
    };
    snake.forEach(part => {
        if (part.x === food.x && part.y === food.y) placeFood();
    });
}

function handleInput(key) {
    const k = key.toLowerCase();
    switch(k) {
        case 'arrowup': case 'w': if (dy !== 1) { nextDx = 0; nextDy = -1; } break;
        case 'arrowdown': case 's': if (dy !== -1) { nextDx = 0; nextDy = 1; } break;
        case 'arrowleft': case 'a': if (dx !== 1) { nextDx = -1; nextDy = 0; } break;
        case 'arrowright': case 'd': if (dx !== -1) { nextDx = 1; nextDy = 0; } break;
    }
}

// FIXED: Added event.preventDefault() to stop page scrolling
window.addEventListener('keydown', e => {
    const keysToBlock = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "s", "a", "d"];
    if (keysToBlock.includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
    handleInput(e.key);
});

function main(timestamp) {
    if (overlay.classList.contains('hidden')) {
        const elapsed = timestamp - lastTimestamp;
        if (elapsed > speed) {
            lastTimestamp = timestamp;
            update();
        }
        draw();
        requestAnimationFrame(main);
    }
}

function update() {
    dx = nextDx;
    dy = nextDy;
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        return gameOver();
    }

    for (let i = 0; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) return gameOver();
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 1;
        shakeTime = 3; 
        scoreEl.textContent = String(score).padStart(3, '0');
        if (speed > 60) speed -= 1;
        placeFood();
    } else {
        snake.pop();
    }
}

function draw() {
    ctx.save();
    if (shakeTime > 0) {
        const dx = (Math.random() - 0.5) * 5;
        const dy = (Math.random() - 0.5) * 5;
        ctx.translate(dx, dy);
        shakeTime--;
    }

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for(let i=0; i<=canvas.width; i+=gridSize) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    drawApple(food.x, food.y);
    snake.forEach((part, index) => {
        drawSnakeSegment(part, index, index === 0);
    });

    ctx.restore();
}

function gameOver() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreEl.textContent = String(highScore).padStart(3, '0');
    }
    msgTitle.textContent = "GAME OVER";
    msgBody.textContent = `FINAL SCORE: ${score}`;
    startBtn.textContent = "RESTART";
    overlay.classList.remove('hidden');
}

startBtn.addEventListener('click', initGame);