const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let gameState = {
    players: [],
    turnIndex: 0,
    tablePile: [],
    lastPlay: null
};

function generateDominoDeck() {
    let deck = [];
    for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) {
            deck.push([i, j]);
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

function startNewGame() {
    const deck = generateDominoDeck();
    const tilesPerPlayer = Math.floor(deck.length / gameState.players.length);
    
    gameState.players.forEach((player, index) => {
        player.hand = deck.slice(index * tilesPerPlayer, (index + 1) * tilesPerPlayer);
    });

    gameState.turnIndex = 0;
    gameState.tablePile = [];
    gameState.lastPlay = null;
}

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>لعبة أشك - دومينو أونلاين</title>
    <style>
        * { box-sizing: border-box; font-family: sans-serif; }
        body { background-color: #1e272e; color: #fff; margin: 0; padding: 15px; text-align: center; }
        h1 { color: #fbc531; }
        .card-box { background: #2f3640; padding: 20px; border-radius: 12px; margin: 15px auto; max-width: 500px; }
        input[type="text"] { width: 80%; padding: 10px; border-radius: 6px; border: none; font-size: 16px; margin-bottom: 10px; text-align: center; }
        button { background: #44bd32; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin: 5px; }
        .btn-bluff { background: #e84118; font-size: 18px; padding: 12px 25px; }
        .table-area { background: #079992; border-radius: 12px; padding: 20px; margin: 20px auto; max-width: 500px; }
        .tiles-container { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 15px; }
        .tile { background: #f5f6fa; color: #2f3640; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 18px; cursor: pointer; }
        .player-list { list-style: none; padding: 0; text-align: right; }
        .player-item { background: #353b48; padding: 8px 12px; margin: 5px 0; border-radius: 6px; display: flex; justify-content: space-between; }
        .turn-active { border: 2px solid #fbc531; }
    </style>
</head>
<body>
    <h1>🎲 لعبة أشك (Bluff Domino)</h1>

    <div id="loginSection" class="card-box">
        <h3>ادخل اسمك للانضمام</h3>
        <input type="text" id="username" placeholder="اكتب اسمك هنا...">
        <br>
        <button onclick="joinGame()">دخول اللعبة</button>
    </div>

    <div id="gameSection" style="display: none;">
        <div class="card-box">
            <h4>اللاعبون (<span id="playerCount">0</span>)</h4>
            <ul id="playersList" class="player-list"></ul>
            <button id="startBtn" onclick="startGame()" style="display:none; background:#0097e6;">ابدأ اللعبة 🚀</button>
        </div>

        <div class="table-area">
            <h3>الترابيزة 🟢</h3>
            <p style="font-size: 20px;">القطع المرمية: <b id="pileCount" style="color:#fbc531;">0</b></p>
            <div id="turnNotice" style="color:#fbc531;">في انتظار بدء اللعبة...</div>
            <br>
            <button class="btn-bluff" onclick="callBluff()">أشــــك! 🤨</button>
        </div>

        <div class="card-box">
            <h3>قطعك</h3>
            <div id="myHand" class="tiles-container"></div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let myId = null;

        socket.on('connect', () => { myId = socket.id; });

        function joinGame() {
            const name = document.getElementById('username').value.trim();
            if (name) {
                socket.emit('joinGame', name);
                document.getElementById('loginSection').style.display = 'none';
                document.getElementById('gameSection').style.display = 'block';
            }
        }

        function startGame() { socket.emit('startGame'); }

        function playTile(index) {
            const claimed = prompt("هتقول إن دي فيها رقم كام؟ (من 0 لـ 6):");
            if (claimed !== null && claimed !== "") {
                const val = parseInt(claimed);
                if (val >= 0 && val <= 6) {
                    socket.emit('playTile', { tileIndex: index, claimedValue: val });
                }
            }
        }

        function callBluff() { socket.emit('callBluff'); }

        socket.on('updateState', (state) => {
            document.getElementById('playerCount').innerText = state.players.length;
            document.getElementById('pileCount').innerText = state.tablePile.length;

            const list = document.getElementById('playersList');
            list.innerHTML = '';
            state.players.forEach((p, idx) => {
                const isCurrentTurn = idx === state.turnIndex;
                const li = document.createElement('li');
                li.className = 'player-item ' + (isCurrentTurn ? 'turn-active' : '');
                li.innerHTML = \`<span>\${p.name} \${p.id === myId ? '(أنت)' : ''}</span> <span>\${p.hand ? p.hand.length + ' قطع' : ''} \${isCurrentTurn ? '👈 دوروه' : ''}</span>\`;
                list.appendChild(li);
            });

            if (state.players.length >= 2 && state.players[0].id === myId && (!state.players[0].hand || state.players[0].hand.length === 0)) {
                document.getElementById('startBtn').style.display = 'inline-block';
            } else {
                document.getElementById('startBtn').style.display = 'none';
            }

            const me = state.players.find(p => p.id === myId);
            const handDiv = document.getElementById('myHand');
            handDiv.innerHTML = '';
            
            if (me && me.hand) {
                me.hand.forEach((tile, index) => {
                    const btn = document.createElement('div');
                    btn.className = 'tile';
                    btn.innerText = \`[\${tile[0]} | \${tile[1]}]\`;
                    btn.onclick = () => playTile(index);
                    handDiv.appendChild(btn);
                });
            }

            if (state.players.length > 0 && state.players[state.turnIndex]) {
                const currentPlayer = state.players[state.turnIndex];
                document.getElementById('turnNotice').innerText = (currentPlayer.id === myId) ? "🎯 الدور عليك!" : \`الدور على: \${currentPlayer.name}\`;
            }
        });

        socket.on('bluffResult', (res) => {
            let msg = \`نتيجة الشك:\nاللاعب: \${res.blufferName}\nالقطعة كانت: [\${res.revealedTile[0]} | \${res.revealedTile[1]}]\n\`;
            msg += res.wasLying ? "🤥 كشفناه بيكدب!" : "😇 طلع صادق!";
            alert(msg);
        });

        socket.on('errorMsg', (msg) => alert(msg));
    </script>
</body>
</html>
    `);
});

io.on('connection', (socket) => {
    socket.on('joinGame', (playerName) => {
        if (gameState.players.length < 4) {
            gameState.players.push({ id: socket.id, name: playerName, hand: [] });
            io.emit('updateState', gameState);
        }
    });

    socket.on('startGame', () => {
        if (gameState.players.length >= 2) {
            startNewGame();
            io.emit('updateState', gameState);
        }
    });

    socket.on('playTile', ({ tileIndex, claimedValue }) => {
        const player = gameState.players[gameState.turnIndex];
        if (player && player.id === socket.id && player.hand[tileIndex]) {
            const playedTile = player.hand.splice(tileIndex, 1)[0];
            gameState.tablePile.push(playedTile);
            gameState.lastPlay = { playerId: socket.id, playerName: player.name, actualTile: playedTile, claimedValue: claimedValue };
            gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
            io.emit('updateState', gameState);
        }
    });

    socket.on('callBluff', () => {
        if (!gameState.lastPlay) return;

        const blufferId = gameState.lastPlay.playerId;
        const actualTile = gameState.lastPlay.actualTile;
        const claimedValue = gameState.lastPlay.claimedValue;

        const isTruth = (actualTile[0] === claimedValue || actualTile[1] === claimedValue);
        const loserId = isTruth ? socket.id : blufferId;
        const loser = gameState.players.find(p => p.id === loserId);

        if (loser) loser.hand.push(...gameState.tablePile);

        io.emit('bluffResult', {
            blufferName: gameState.lastPlay.playerName,
            wasLying: !isTruth,
            revealedTile: actualTile
        });

        gameState.tablePile = [];
        gameState.lastPlay = null;
        io.emit('updateState', gameState);
    });

    socket.on('disconnect', () => {
        gameState.players = gameState.players.filter(p => p.id !== socket.id);
        io.emit('updateState', gameState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running...'));
