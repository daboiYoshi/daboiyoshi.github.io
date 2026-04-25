
(function() {
    console.log("Snake Arcade Autopilot Engaged!");

    setInterval(() => {
        if (typeof snake === 'undefined' || !snake.length) return;

        const head = snake[0];
        const target = food;
        let possibleMoves = [
            { name: 'arrowup', dx: 0, dy: -1 },
            { name: 'arrowdown', dx: 0, dy: 1 },
            { name: 'arrowleft', dx: -1, dy: 0 },
            { name: 'arrowright', dx: 1, dy: 0 }
        ];

        // 1. Filter out moves that result in immediate death (Walls and Body)
        let safeMoves = possibleMoves.filter(move => {
            const newX = head.x + move.dx;
            const newY = head.y + move.dy;

            // Wall check
            if (newX < 0 || newX >= tileCount || newY < 0 || newY >= tileCount) return false;

            // Body check
            return !snake.some(segment => segment.x === newX && segment.y === newY);
        });

        if (safeMoves.length === 0) return; // No safe moves, death is inevitable

        // 2. Rank safe moves by distance to the apple (Manhattan Distance)
        safeMoves.sort((a, b) => {
            const distA = Math.abs((head.x + a.dx) - target.x) + Math.abs((head.y + a.dy) - target.y);
            const distB = Math.abs((head.x + b.dx) - target.x) + Math.abs((head.y + b.dy) - target.y);
            return distA - distB;
        });

        // 3. Execute the best move
        const bestMove = safeMoves[0];
        
        // Prevent 180-degree turns (the game logic already handles this, but good for safety)
        if (bestMove.dx === -dx && bestMove.dy === -dy) {
             if (safeMoves.length > 1) handleInput(safeMoves[1].name);
        } else {
             handleInput(bestMove.name);
        }

    }, 50); // Checks 20 times per second
})();
