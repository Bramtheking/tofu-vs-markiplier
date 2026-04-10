// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// DOM Elements
const scoreDisplay = document.getElementById('score-display');
const highScoreDisplay = document.getElementById('high-score-display');
const livesIcons = document.getElementById('lives-icons');
const livesCount = document.getElementById('lives-count');
const startScreen = document.getElementById('start-screen');
const startTitle = document.getElementById('start-title');
const gameOverScreen = document.getElementById('game-over-screen');
const biteBackText = document.getElementById('bite-back');

// Dimensions and Grid
let COLS = 19;
let ROWS = 21;
let CELL_SIZE = 24;

// 1: Wall, 0: Empty, 2: Mustache, 4: Pen Gate
const initialMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,1,2,2,1,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,0,1,0,1,1,2,1,1,1,1,1], // 6
    [0,0,0,0,1,2,0,0,0,0,0,0,0,2,1,0,0,0,0], // 7 (open corridor around pen)
    [1,1,1,1,1,2,0,1,1,4,1,1,0,2,1,1,1,1,1], // 8 (pen top wall, gate at x=9)
    [0,0,0,0,0,2,0,1,0,0,0,1,0,2,0,0,0,0,0], // 9 (pen interior x=8,9,10)
    [1,1,1,1,1,2,0,1,1,1,1,1,0,2,1,1,1,1,1], // 10 (pen bottom wall)
    [0,0,0,0,1,2,0,0,0,0,0,0,0,2,1,0,0,0,0], // 11
    [1,1,1,1,1,2,1,2,1,1,1,2,1,2,1,1,1,1,1], // 12
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1], // 13
    [1,2,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,2,1], // 14
    [1,2,2,2,1,2,2,2,2,0,2,2,2,2,1,2,2,2,1], // 15
    [1,1,1,2,1,2,1,2,1,1,1,2,1,2,1,2,1,1,1],
    [1,2,2,2,2,2,1,2,2,1,2,2,1,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

let grid = [];
let totalMustaches = 0;

// Game State
let state = 'START'; // START, PLAYING, DEATH, GAME_OVER, WIN
let lastTime = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('markiplierVsTofuHighScore') || '0');
let lives = 3;
let level = 1;
let scaredTimer = 0;
let flashTimer = 0;

// Entities
let player = { x: 0, y: 0, dir: 'LEFT', nextDir: 'LEFT', speed: 2.42 };
let ghosts = [];

const spawnPlayer = () => { player.x = 9 * CELL_SIZE; player.y = 15 * CELL_SIZE; player.dir = 'RIGHT'; player.nextDir = 'RIGHT'; };
const initGhosts = () => {
    ghosts = [
        { x: 9 * CELL_SIZE, y: 9 * CELL_SIZE, dir: 'UP', wait: 0, mode: 'PEN', respawning: false, speed: 2.0, inPen: true, personality: 'CHASER' }, // Direct chaser like Blinky
        { x: 8 * CELL_SIZE, y: 9 * CELL_SIZE, dir: 'UP', wait: 5000, mode: 'PEN', respawning: false, speed: 2.0, inPen: true, personality: 'AMBUSHER' }, // Ambusher like Pinky
        { x: 10 * CELL_SIZE, y: 9 * CELL_SIZE, dir: 'UP', wait: 10000, mode: 'PEN', respawning: false, speed: 2.0, inPen: true, personality: 'COWARD' } // Coward like Clyde
    ];
};

// Audio Setup (Synthesized Fallbacks + Real Files attempt)
let audioCtx;
const sfx = {
    waka: 'waka.wav', powerup: 'powerup.wav', vulnerable: 'vulnerable.wav',
    bite: 'bite.wav', caught: 'caught.wav', start: 'start.wav', gameover: 'gameover.wav'
};
const audioElements = {};
for (let k in sfx) {
    let a = new Audio('assets/sounds/' + sfx[k]);
    a.preload = 'auto';
    audioElements[k] = a;
}

function playSound(key, synthCallback) {
    let a = audioElements[key];
    if (a.readyState >= 2) { // 2 = HAVE_CURRENT_DATA
        a.currentTime = 0;
        a.play().catch(() => synthCallback && synthCallback());
    } else {
        if (synthCallback) synthCallback();
    }
}

function synthWaka() { 
    if(!audioCtx) return;
    let t = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.1);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(t + 0.1);
}
function synthPowerUp() {
    if(!audioCtx) return;
    let t = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(t + 0.3);
}
function synthVulnerable() {
    if(!audioCtx) return;
    let t = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.6);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(t + 0.6);
}
function synthBite() {
    if(!audioCtx) return;
    let t = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.2);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(t + 0.2);
}
function synthCaught() {
    if(!audioCtx) return;
    let t = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.8);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.8);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(t + 0.8);
}
function synthStart() {
    if(!audioCtx) return;
    let notes = [440, 554, 659, 880, 659, 554];
    let t = audioCtx.currentTime;
    notes.forEach((n, i) => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = n;
        gain.gain.setValueAtTime(0.1, t + i * 0.1);
        gain.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.1);
    });
}
function synthGameOver() {
    if(!audioCtx) return;
    let notes = [300, 250, 200, 150];
    let t = audioCtx.currentTime;
    notes.forEach((n, i) => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = n;
        gain.gain.setValueAtTime(0.2, t + i * 0.4);
        gain.gain.linearRampToValueAtTime(0, t + i * 0.4 + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t + i * 0.4); osc.stop(t + i * 0.4 + 0.4);
    });
}

// Assets Management
const images = {
    markiplier: new Image(),
    tofuNormal: new Image(),
    tofuScared: new Image()
};
let loadedSprites = 0;
let spritesReady = false;

function removeCyanBackground(img) {
    try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width; tempCanvas.height = img.height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(img, 0, 0);
        const idata = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = idata.data;
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i+1], b = data[i+2];
            if (r < 50 && g > 200 && b > 200) data[i+3] = 0;
        }
        tCtx.putImageData(idata, 0, 0);
        return tempCanvas; 
    } catch(err) {
        // Fallback for strict browser CORS when opening via directly filesystem 'file://' 
        return img;
    }
}

function checkSpritesLoaded() {
    loadedSprites++;
    console.log('Sprite loaded:', loadedSprites, 'of 3');
    if (loadedSprites === 3) {
        console.log('All sprites loaded! Processing...');
        images.markiplier = removeCyanBackground(images.markiplier);
        images.tofuNormal = removeCyanBackground(images.tofuNormal);
        images.tofuScared = removeCyanBackground(images.tofuScared);
        spritesReady = true;
        console.log('Sprites ready:', spritesReady);
        console.log('Tofu image dimensions:', images.tofuNormal.width, 'x', images.tofuNormal.height);
        updateLivesIcons();
        resize(); // initial setup
    }
}

const checkImageState = () => {
    let loaded = 0;
    if (images.markiplier.complete) loaded++;
    if (images.tofuNormal.complete) loaded++;
    if (images.tofuScared.complete) loaded++;
    
    if (loaded >= 2 && !spritesReady) {
        console.log('Force activating sprites from cache...');
        images.markiplier = removeCyanBackground(images.markiplier);
        images.tofuNormal = removeCyanBackground(images.tofuNormal);
        images.tofuScared = removeCyanBackground(images.tofuScared);
        spritesReady = true;
    }
};

images.markiplier.onload = checkSpritesLoaded;
images.tofuNormal.onload = checkSpritesLoaded;
images.tofuScared.onload = checkSpritesLoaded;

images.markiplier.onerror = () => { checkSpritesLoaded(); };
images.tofuNormal.onerror = () => { checkSpritesLoaded(); };
images.tofuScared.onerror = () => { checkSpritesLoaded(); };

// Set sources to initiate load
images.markiplier.src = 'assets/sprites/markiplier.png';
images.tofuNormal.src = 'assets/sprites/tofu-normal.png';
images.tofuScared.src = 'assets/sprites/tofu-scared.png';

// Double-check cache completion instantly and with backup timers
checkImageState();
setTimeout(checkImageState, 500);
setTimeout(checkImageState, 2000);


// Maze Prerenderer
let mapCanvas;
function prerenderMap() {
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = COLS * CELL_SIZE; mapCanvas.height = ROWS * CELL_SIZE;
    let mCtx = mapCanvas.getContext('2d');
    
    mCtx.fillStyle = '#050005';
    mCtx.fillRect(0,0, mapCanvas.width, mapCanvas.height);
    
    const drawLine = (x1, y1, x2, y2) => {
        mCtx.beginPath(); mCtx.moveTo(x1, y1); mCtx.lineTo(x2, y2); mCtx.stroke();
    };
    
    // Draw neon pink boxes for walls
    for(let passes = 0; passes < 2; passes++) {
        if(passes === 0) { mCtx.strokeStyle = '#ff107a'; mCtx.lineWidth = 4; mCtx.shadowBlur = 10; mCtx.shadowColor='#ff107a'; }
        if(passes === 1) { mCtx.strokeStyle = '#ffccff'; mCtx.lineWidth = 2; mCtx.shadowBlur = 0; }
        
        for(let r=0; r<ROWS; r++){
            for(let c=0; c<COLS; c++){
                if(initialMap[r][c] === 1) {
                    let px = c*CELL_SIZE, py = r*CELL_SIZE, cs=CELL_SIZE;
                    let m = cs * 0.15;
                    // top
                    if(r===0 || initialMap[r-1][c]!==1) drawLine(px+m, py+m, px+cs-m, py+m);
                    // bottom
                    if(r===ROWS-1 || initialMap[r+1][c]!==1) drawLine(px+m, py+cs-m, px+cs-m, py+cs-m);
                    // left
                    if(c===0 || initialMap[r][c-1]!==1) drawLine(px+m, py+m, px+m, py+cs-m);
                    // right
                    if(c===COLS-1 || initialMap[r][c+1]!==1) drawLine(px+cs-m, py+m, px+cs-m, py+cs-m);
                } else if(initialMap[r][c] === 4 && passes === 0) {
                    // Pen gate
                    mCtx.strokeStyle = 'rgba(255,16,122,0.5)';
                    drawLine(c*CELL_SIZE, r*CELL_SIZE+CELL_SIZE/2, (c+1)*CELL_SIZE, r*CELL_SIZE+CELL_SIZE/2);
                }
            }
        }
    }
}

function loadMap() {
    grid = initialMap.map(row => [...row]);
    totalMustaches = 0;
    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            if(grid[r][c] === 2) totalMustaches++;
        }
    }
}

loadMap();

// Window Resize
function resize() {
    let w = canvas.parentElement.clientWidth;
    let h = canvas.parentElement.clientHeight - 90; // minus top bar
    
    let cellW = w / COLS;
    let cellH = h / ROWS;
    
    if (window.innerHeight > window.innerWidth) {
        // Portrait: guarantee it hits horizontal edges unconditionally
        CELL_SIZE = cellW;
    } else {
        // Landscape: clamp safely to viewport height
        CELL_SIZE = Math.floor(Math.min(cellW, cellH)); 
    }
    
    canvas.width = COLS * CELL_SIZE;
    canvas.height = ROWS * CELL_SIZE;
    
    prerenderMap();
}
window.addEventListener('resize', resize);
resize();

// Input
function setDir(d) { 
    console.log('Setting direction to:', d, 'Current state:', state);
    player.nextDir = d; 
}

// Mobile button controls
document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const dir = btn.getAttribute('data-dir');
        setDir(dir);
        btn.style.background = 'rgba(255, 16, 122, 0.7)';
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        btn.style.background = 'rgba(255, 16, 122, 0.3)';
    });
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const dir = btn.getAttribute('data-dir');
        setDir(dir);
    });
});

window.addEventListener('keydown', e => {
    e.preventDefault(); // Prevent page scrolling
    if(e.code === 'ArrowUp' || e.code === 'KeyW') setDir('UP');
    if(e.code === 'ArrowDown' || e.code === 'KeyS') setDir('DOWN');
    if(e.code === 'ArrowLeft' || e.code === 'KeyA') setDir('LEFT');
    if(e.code === 'ArrowRight' || e.code === 'KeyD') setDir('RIGHT');
    if(e.code === 'Space' && (state === 'START' || state === 'GAME_OVER')) startGame();
});

let touchStartX = 0, touchStartY = 0;
window.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    if(state === 'START' || state === 'GAME_OVER') startGame();
});
window.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
window.addEventListener('touchend', e => {
    let tx = e.changedTouches[0].screenX;
    let ty = e.changedTouches[0].screenY;
    let dx = tx - touchStartX;
    let dy = ty - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 20) setDir(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
        if (Math.abs(dy) > 20) setDir(dy > 0 ? 'DOWN' : 'UP');
    }
});

function startGame() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    if(state === 'GAME_OVER') {
        score = 0; lives = 3; level = 1; loadMap();
        updateLivesIcons();
    }
    
    playSound('start', synthStart);
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    biteBackText.classList.add('hidden');
    
    spawnPlayer();
    initGhosts();
    scaredTimer = 0;
    
    state = 'PLAYING';
    lastTime = performance.now(); // Reset timing
    requestAnimationFrame(gameLoop);
}

function updateLivesIcons() {
    livesCount.innerText = lives;
    livesIcons.innerHTML = '';
    for(let i=0; i<Math.min(lives, 5); i++) {
        let img = document.createElement('img');
        img.className = 'life-icon';
        if (images.markiplier.src) img.src = images.markiplier.src;
        livesIcons.appendChild(img);
    }
    scoreDisplay.innerText = 'SCORE: ' + score.toString().padStart(6, '0');
    
    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('markiplierVsTofuHighScore', highScore.toString());
    }
    highScoreDisplay.innerText = 'HIGH: ' + highScore.toString().padStart(6, '0');
}

// Logic Helpers
const dirs = {
    'UP': {x:0, y:-1},
    'DOWN': {x:0, y:1},
    'LEFT': {x:-1, y:0},
    'RIGHT': {x:1, y:0}
};

function getGridPoint(x, y) { return { c: Math.floor(x / CELL_SIZE), r: Math.floor(y / CELL_SIZE) }; }
function getGridCenter(c, r) { return { x: c * CELL_SIZE + CELL_SIZE/2, y: r * CELL_SIZE + CELL_SIZE/2 }; }
function isWall(c, r, isGhost=false) {
    // Specifically allow tunnel maps to wrap infinitely on proper rows horizontally
    if ((r === 7 || r === 11) && (c < 0 || c >= COLS)) return false; 
    // Anything else strictly out of bounds is treated as an infinite solid wall to prevent falling out!
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
    
    if (grid[r][c] === 1) return true;
    if (grid[r][c] === 4 && (!isGhost || state !== 'PLAYING')) return true; // Pen blocks player normally. Ghost can go thru 4 when navigating it out/in.
    return false;
}

function moveEntity(ent, isGhost, dtTimer) {
    let d = dirs[ent.dir];
    if (!d) return; // Safety check
    
    let nextD = dirs[ent.nextDir];
    if (!nextD) nextD = d; // Safety check
    
    let spd = isGhost && ent.mode === 'SCARED' ? ent.speed * 0.5 : (isGhost && ent.mode === 'RETREATING' ? ent.speed * 2 : ent.speed);
    
    let cx = ent.x + CELL_SIZE/2;
    let cy = ent.y + CELL_SIZE/2;
    let gp = getGridPoint(cx, cy);
    let cCenter = getGridCenter(gp.c, gp.r);

    let distToCenter = Math.hypot(cx - cCenter.x, cy - cCenter.y);
    
    // Can we turn? More lenient turning
    if (distToCenter < CELL_SIZE * 0.4) {
        if (ent.nextDir !== ent.dir) {
            if (!isWall(gp.c + nextD.x, gp.r + nextD.y, isGhost)) {
                ent.x = gp.c * CELL_SIZE; ent.y = gp.r * CELL_SIZE;
                ent.dir = ent.nextDir;
                d = nextD;
            }
        }
        
        if (isWall(gp.c + d.x, gp.r + d.y, isGhost)) {
            ent.x = gp.c * CELL_SIZE; ent.y = gp.r * CELL_SIZE;
            return;
        }
    }
    
    ent.x += d.x * spd;
    ent.y += d.y * spd;
    
    // Map Wrap
    if (ent.x < -CELL_SIZE) ent.x = COLS * CELL_SIZE;
    if (ent.x > COLS * CELL_SIZE) ent.x = -CELL_SIZE;
}

function ghostAI(g) {
    if (g.wait > 0) return;
    
    let cx = g.x + CELL_SIZE/2;
    let cy = g.y + CELL_SIZE/2;
    let gp = getGridPoint(cx, cy);
    let cC = getGridCenter(gp.c, gp.r);
    
    // Handle leaving pen
    if (g.inPen) {
        g.mode = 'PEN';
        // Move to center column first
        if (gp.c < 9) {
            g.nextDir = 'RIGHT';
        } else if (gp.c > 9) {
            g.nextDir = 'LEFT';
        } else {
            // At center, move up to exit
            g.nextDir = 'UP';
            // Check if we've left the pen
            if (gp.r <= 7) {
                g.inPen = false;
                g.mode = 'NORMAL';
            }
        }
        return;
    }
    
    if (!g.inPen) {
        g.mode = 'NORMAL';
    }
    
    if (Math.hypot(cx - cC.x, cy - cC.y) < g.speed * 2) {
        let possible = [];
        ['UP','DOWN','LEFT','RIGHT'].forEach(nd => {
            // No 180 degree turns (Pac-Man rule!)
            if (nd === (g.dir==='UP'?'DOWN':g.dir==='DOWN'?'UP':g.dir==='LEFT'?'RIGHT':'LEFT')) return;
            let nV = dirs[nd];
            if (!isWall(gp.c + nV.x, gp.r + nV.y, true)) possible.push(nd);
        });
        if(possible.length === 0) possible.push((g.dir==='UP'?'DOWN':g.dir==='DOWN'?'UP':g.dir==='LEFT'?'RIGHT':'LEFT'));
        
        if (g.mode === 'NORMAL') {
            let pGp = getGridPoint(player.x+CELL_SIZE/2, player.y+CELL_SIZE/2);
            let targetC = pGp.c;
            let targetR = pGp.r;
            
            // Apply personality-based targeting
            if (g.personality === 'CHASER') {
                // Direct chaser - targets player's exact position (like Blinky)
                targetC = pGp.c;
                targetR = pGp.r;
            } else if (g.personality === 'AMBUSHER') {
                // Ambusher - targets 4 tiles ahead of player (like Pinky)
                let pDir = dirs[player.dir];
                targetC = pGp.c + pDir.x * 4;
                targetR = pGp.r + pDir.y * 4;
            } else if (g.personality === 'COWARD') {
                // Coward - chases player but runs away when close (like Clyde)
                let dist = Math.hypot(gp.c - pGp.c, gp.r - pGp.r);
                if (dist < 8) {
                    // Too close! Run to corner
                    targetC = 0;
                    targetR = ROWS - 1;
                } else {
                    // Far enough, chase
                    targetC = pGp.c;
                    targetR = pGp.r;
                }
            }
            
            // Choose direction that gets closest to target
            possible.sort((a,b) => {
                let pa = {c: gp.c + dirs[a].x, r: gp.r + dirs[a].y};
                let pb = {c: gp.c + dirs[b].x, r: gp.r + dirs[b].y};
                return Math.hypot(pa.c-targetC, pa.r-targetR) - Math.hypot(pb.c-targetC, pb.r-targetR);
            });
            g.nextDir = possible[0] || g.dir;
        } else {
            // Random movement for other modes
            g.nextDir = possible[Math.floor(Math.random()*possible.length)] || g.dir;
        }
    }
}

// Update Loop
function update(dt) {
    if (state !== 'PLAYING') return;
    
    // Ghost timers
    ghosts.forEach(g => { if(g.wait > 0) g.wait -= dt; });
    
    // Scared timer
    if (scaredTimer > 0) {
        scaredTimer -= dt;
        if (scaredTimer <= 0) {
            biteBackText.classList.add('hidden');
        }
    }
    
    moveEntity(player, false, dt);
    
    ghosts.forEach(g => {
        ghostAI(g);
        moveEntity(g, true, dt);
    });
    
    // Player - Item Interaction
    let pc = Math.floor((player.x + CELL_SIZE/2) / CELL_SIZE);
    let pr = Math.floor((player.y + CELL_SIZE/2) / CELL_SIZE);
    
    if (pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS) {
        if (grid[pr][pc] === 2) {
            grid[pr][pc] = 0;
            score += 10;
            totalMustaches--;
            playSound('waka', synthWaka);
            updateLivesIcons();
            if (totalMustaches <= 0) {
                level++;
                loadMap();
                spawnPlayer();
                initGhosts();
            }
        }
    }
    
    // Collision
    let hitRad = CELL_SIZE * 0.4;
    ghosts.forEach(g => {
        if (g.wait <= 0 && Math.hypot(player.x - g.x, player.y - g.y) < hitRad) {
            if (g.mode === 'NORMAL' || g.mode === 'PEN') {
                playSound('caught', synthCaught);
                state = 'DEATH';
                setTimeout(() => {
                    lives--;
                    updateLivesIcons();
                    if (lives > 0) {
                        spawnPlayer();
                        initGhosts();
                        state = 'PLAYING';
                    } else {
                        state = 'GAME_OVER';
                        document.getElementById('final-score').innerText = 'FINAL SCORE: ' + score.toString().padStart(6, '0');
                        gameOverScreen.classList.remove('hidden');
                        playSound('gameover', synthGameOver);
                    }
                }, 1500);
            }
        }
    });
}

// Rendering
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(mapCanvas) ctx.drawImage(mapCanvas, 0, 0);
    
    // Draw items
    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            let px = c*CELL_SIZE, py = r*CELL_SIZE, cs=CELL_SIZE;
            if (grid[r][c] === 2) {
                // Mustache
                ctx.fillStyle = '#ffb6c1';
                ctx.beginPath();
                ctx.arc(px + cs/2 - cs*0.15, py + cs/2, cs*0.15, 0, Math.PI, true);
                ctx.arc(px + cs/2 + cs*0.15, py + cs/2, cs*0.15, 0, Math.PI, true);
                ctx.fill();
                ctx.fillStyle = '#ff69b4';
                ctx.fillRect(px + cs/2 - cs*0.25, py + cs/2 - cs*0.05, cs*0.5, cs*0.1);
            }
        }
    }
    
    let dtScale = CELL_SIZE / Math.max(images.markiplier.width || 1, 1);
    let drawScale = CELL_SIZE * 2.2; // Enlarged heavily so they look massive and correct to original vibes
    
    // Draw player
    if(state !== 'DEATH' || Math.floor(Date.now() / 150) % 2 !== 0) {
        if(spritesReady && images.markiplier.width > 0) {
            ctx.drawImage(images.markiplier, player.x - (drawScale-CELL_SIZE)/2, player.y - (drawScale-CELL_SIZE)/2, drawScale, drawScale);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.beginPath(); ctx.arc(player.x+CELL_SIZE/2, player.y+CELL_SIZE/2, CELL_SIZE*0.4, 0, Math.PI*2); ctx.fill();
        }
    }
    
    // Draw ghosts
    ghosts.forEach((g, idx) => {
        if (g.wait > 0) {
            // Draw ghosts in pen even when waiting
            let img = images.tofuNormal;
            if(spritesReady && img.width > 0) {
                ctx.globalAlpha = 0.5; // Make waiting ghosts semi-transparent
                ctx.drawImage(img, g.x - (drawScale-CELL_SIZE)/2, g.y - (drawScale-CELL_SIZE)/2, drawScale, drawScale);
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(g.x, g.y, CELL_SIZE, CELL_SIZE);
            }
            return;
        }
        
        let img = images.tofuNormal;
        
        if(spritesReady && img.width > 0) {
            ctx.drawImage(img, g.x - (drawScale-CELL_SIZE)/2, g.y - (drawScale-CELL_SIZE)/2, drawScale, drawScale);
        } else {
            // Fallback if sprites don't load
            ctx.fillStyle = 'white';
            ctx.fillRect(g.x, g.y, CELL_SIZE, CELL_SIZE);
        }
    });
}

function gameLoop(time) {
    let dt = time - lastTime;
    lastTime = time;
    if(dt > 50) dt = 16; // prevent spikes and cap at ~60fps
    update(dt);
    draw();
    if(state === 'PLAYING' || state === 'DEATH') requestAnimationFrame(gameLoop);
}

// Ensure rendering even before play
setInterval(() => { if(state === 'START') draw(); }, 100);

// Fix timing issues when returning to tab
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state === 'PLAYING') {
        lastTime = performance.now(); // Reset timing to prevent speed issues
    }
});

// Also handle page focus
window.addEventListener('focus', () => {
    if (state === 'PLAYING') {
        lastTime = performance.now();
    }
});
