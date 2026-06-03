// Board surface — flush square tiles, minimal styling
const BoardDraw = {
    theme: {
        mat: '#1a3229',
        tileLight: '#e6dcc8',
        tileDark: '#cfc0a4',
        grid: 'rgba(26, 46, 38, 0.65)',
        number: '#2f4038',
        startTint: 'rgba(45, 106, 79, 0.35)',
        finishTint: 'rgba(201, 168, 108, 0.32)',
        startNum: '#1f5c42',
        finishNum: '#8a6420'
    },

    draw(ctx, boardSize, cellSize) {
        const size = boardSize * cellSize;
        ctx.fillStyle = BoardDraw.theme.mat;
        ctx.fillRect(0, 0, size, size);
        BoardDraw.drawTiles(ctx, boardSize, cellSize);
        BoardDraw.drawTileNumbers(ctx, boardSize, cellSize);
    },

    drawTiles(ctx, boardSize, cellSize) {
        const t = BoardDraw.theme;
        const gridW = Math.max(1, cellSize * 0.012);

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const num = Utils.getCellNumber(row, col);
                const x = col * cellSize;
                const y = row * cellSize;
                const isLight = (row + col) % 2 === 0;

                ctx.fillStyle = isLight ? t.tileLight : t.tileDark;
                ctx.fillRect(x, y, cellSize, cellSize);

                if (num === 1) {
                    ctx.fillStyle = t.startTint;
                    ctx.fillRect(x, y, cellSize, cellSize);
                } else if (num === 100) {
                    ctx.fillStyle = t.finishTint;
                    ctx.fillRect(x, y, cellSize, cellSize);
                }

                ctx.strokeStyle = t.grid;
                ctx.lineWidth = gridW;
                ctx.strokeRect(
                    x + gridW / 2,
                    y + gridW / 2,
                    cellSize - gridW,
                    cellSize - gridW
                );
            }
        }
    },

    drawTileNumbers(ctx, boardSize, cellSize) {
        const t = BoardDraw.theme;

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const num = Utils.getCellNumber(row, col);
                const x = col * cellSize;
                const y = row * cellSize;
                const cx = x + cellSize / 2;
                const cy = num === 100 ? y + cellSize * 0.36 : y + cellSize / 2;
                const fontSize = cellSize * (num >= 100 ? 0.2 : 0.24);

                ctx.font = `600 ${fontSize}px "DM Sans", system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (num === 100) {
                    ctx.fillStyle = t.finishNum;
                } else if (num === 1) {
                    ctx.fillStyle = t.startNum;
                } else {
                    ctx.fillStyle = t.number;
                }
                ctx.fillText(String(num), cx, cy);

                if (num === 100) {
                    ctx.font = `${cellSize * 0.3}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                    ctx.fillText('🏆', cx, y + cellSize * 0.68);
                }
            }
        }
    }
};