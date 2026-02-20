/* ============================================
   LI XI MAY MAN - Application Logic v4
   Firebase Auth + Realtime Database
   All events via addEventListener
   ============================================ */

const Storage = {
    ensureArray(val) { if (Array.isArray(val)) return val; if (val && typeof val === 'object') return Object.values(val); return []; },
    roomRef(code) { return db.ref('rooms/' + code); },
    userRef(uid) { return db.ref('users/' + uid); },
    async getRoom(code) {
        try { const s = await this.roomRef(code).once('value'); const d = s.val(); if (!d) return null; d.players = d.players || []; d.history = d.history || []; return d; } catch (e) { return null; }
    },
    async saveRoom(code, room) { try { await this.roomRef(code).set(room); } catch (e) { console.error(e); } },
    async deleteRoom(code) { try { await this.roomRef(code).remove(); } catch (e) { console.error(e); } },
    onRoomChange(code, cb) { this.roomRef(code).on('value', s => { const d = s.val(); if (d) { d.players = d.players || []; d.history = d.history || []; cb(d); } }); },
    offRoomChange(code) { this.roomRef(code).off('value'); },
    async getUserHistory(uid) { try { const s = await this.userRef(uid).child('history').once('value'); const d = s.val() || {}; return { created: this.ensureArray(d.created), joined: this.ensureArray(d.joined) }; } catch (e) { console.error('getUserHistory error for uid:', uid, e); return { created: [], joined: [] }; } },
    async saveCreatedRoom(uid, code, name) {
        try { const h = await this.getUserHistory(uid); if (!Array.isArray(h.created)) h.created = []; if (!h.created.find(r => r.code === code)) { h.created.unshift({ code, name, time: new Date().toISOString() }); if (h.created.length > 30) h.created = h.created.slice(0, 30); await this.userRef(uid).child('history').set(h); } } catch (e) { console.error('saveCreatedRoom error', e); }
    },
    async saveJoinedRoom(uid, code, name, playerName) {
        try {
            const h = await this.getUserHistory(uid);
            if (!Array.isArray(h.joined)) h.joined = [];
            if (!h.joined.find(r => r.code === code && r.playerName === playerName)) {
                h.joined.unshift({ code, name, playerName, time: new Date().toISOString(), wins: [] });
                if (h.joined.length > 50) h.joined = h.joined.slice(0, 50);
                await this.userRef(uid).child('history').set(h);
            }
        } catch (e) { console.error('saveJoinedRoom error', e); }
    },
    async saveWin(uid, code, roomName, playerName, prizeName, value) {
        try {
            const h = await this.getUserHistory(uid);
            if (!Array.isArray(h.joined)) h.joined = [];
            let r = h.joined.find(x => x.code === code && x.playerName === playerName);
            if (!r) {
                // Auto-join if missing
                r = { code, name: roomName, playerName, time: new Date().toISOString(), wins: [] };
                h.joined.unshift(r);
            }
            r.wins = r.wins || [];
            r.wins.unshift({ prizeName, value, time: new Date().toISOString() });
            if (h.joined.length > 50) h.joined = h.joined.slice(0, 50);
            await this.userRef(uid).child('history').set(h);
        } catch (e) { console.error('saveWin error', e); }
    }
};

const State = {
    KEY: 'lixi_state',
    save(d) { try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) { } },
    load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch (e) { return null; } },
    clear() { localStorage.removeItem(this.KEY); }
};

const Sound = {
    ctx: null, init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    play(type) {
        this.init(); const c = this.ctx, n = c.currentTime;
        if (type === 'click') { const o = c.createOscillator(), g = c.createGain(); o.connect(g).connect(c.destination); o.frequency.setValueAtTime(800, n); o.frequency.exponentialRampToValueAtTime(1200, n + 0.05); g.gain.setValueAtTime(0.15, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.1); o.start(n); o.stop(n + 0.1); }
        else if (type === 'spin') { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.connect(g).connect(c.destination); o.frequency.setValueAtTime(200, n); o.frequency.linearRampToValueAtTime(800, n + 0.5); o.frequency.linearRampToValueAtTime(100, n + 3); g.gain.setValueAtTime(0.08, n); g.gain.linearRampToValueAtTime(0.03, n + 2); g.gain.exponentialRampToValueAtTime(0.001, n + 3.5); o.start(n); o.stop(n + 3.5); }
        else if (type === 'tick') { const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.connect(g).connect(c.destination); o.frequency.setValueAtTime(1500, n); g.gain.setValueAtTime(0.06, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.03); o.start(n); o.stop(n + 0.03); }
        else if (type === 'flip') { const o = c.createOscillator(), g = c.createGain(); o.connect(g).connect(c.destination); o.frequency.setValueAtTime(400, n); o.frequency.exponentialRampToValueAtTime(1000, n + 0.15); g.gain.setValueAtTime(0.12, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.2); o.start(n); o.stop(n + 0.2); }
        else if (type === 'win') { [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g).connect(c.destination); o.frequency.setValueAtTime(f, n + i * 0.15); g.gain.setValueAtTime(0.15, n + i * 0.15); g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.15 + 0.3); o.start(n + i * 0.15); o.stop(n + i * 0.15 + 0.3); }); }
        else if (type === 'bigwin') { [523, 659, 784, 784, 1047, 1047, 1319].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = i < 4 ? 'sine' : 'triangle'; o.connect(g).connect(c.destination); o.frequency.setValueAtTime(f, n + i * 0.12); g.gain.setValueAtTime(0.15, n + i * 0.12); g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.12 + 0.35); o.start(n + i * 0.12); o.stop(n + i * 0.12 + 0.35); }); }
        else if (type === 'error') { const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.connect(g).connect(c.destination); o.frequency.setValueAtTime(200, n); o.frequency.setValueAtTime(150, n + 0.15); g.gain.setValueAtTime(0.1, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.3); o.start(n); o.stop(n + 0.3); }
    }
};

const Confetti = {
    canvas: null, ctx: null, particles: [], running: false,
    init() { this.canvas = document.getElementById('confetti-canvas'); this.ctx = this.canvas.getContext('2d'); this.resize(); window.addEventListener('resize', () => this.resize()); },
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; },
    launch(dur = 4000) {
        this.particles = []; const cols = ['#fbbf24', '#f59e0b', '#e03131', '#ff6b6b', '#ff4757', '#ffd700', '#ff8c00', '#ff1493', '#00ff88', '#fff'];
        for (let i = 0; i < 150; i++) this.particles.push({ x: Math.random() * this.canvas.width, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 8, vy: Math.random() * 4 + 2, w: Math.random() * 10 + 5, h: Math.random() * 6 + 3, color: cols[Math.floor(Math.random() * cols.length)], rot: Math.random() * 360, rs: (Math.random() - 0.5) * 10, g: 0.1 + Math.random() * 0.05, op: 1 });
        this.running = true; this.animate(); setTimeout(() => { this.running = false; }, dur);
    },
    animate() {
        if (!this.running && this.particles.every(p => p.op <= 0)) { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); return; }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach(p => {
            if (p.op <= 0) return; p.x += p.vx; p.vy += p.g; p.y += p.vy; p.rot += p.rs; p.vx *= 0.99;
            if (p.y > this.canvas.height + 20) { if (!this.running) { p.op = 0; return; } p.y = -20; p.x = Math.random() * this.canvas.width; p.vy = Math.random() * 4 + 2; }
            this.ctx.save(); this.ctx.translate(p.x, p.y); this.ctx.rotate(p.rot * Math.PI / 180); this.ctx.globalAlpha = p.op; this.ctx.fillStyle = p.color; this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); this.ctx.restore();
        });
        requestAnimationFrame(() => this.animate());
    }
};

const Wheel = {
    canvas: null, ctx: null, angle: 0, spinning: false, prizes: [],
    COLORS: ['#b91c1c', '#dc2626', '#b45309', '#d97706', '#991b1b', '#ef4444', '#92400e', '#f59e0b'],
    init(prizes) { this.canvas = document.getElementById('wheelCanvas'); this.ctx = this.canvas.getContext('2d'); this.prizes = prizes; this.angle = Math.random() * Math.PI * 2; this.draw(); },
    draw() {
        const ctx = this.ctx, cx = this.canvas.width / 2, cy = this.canvas.height / 2, r = cx - 12, n = this.prizes.length, arc = 2 * Math.PI / n;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < n; i++) {
            const sa = this.angle + i * arc, ea = sa + arc, gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r), b = this.COLORS[i % this.COLORS.length];
            gr.addColorStop(0, b + '99'); gr.addColorStop(0.5, b); gr.addColorStop(1, b + 'cc'); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, sa, ea); ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
            ctx.strokeStyle = 'rgba(251,191,36,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * Math.cos(sa), cy + r * Math.sin(sa)); ctx.stroke();
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(sa + arc / 2); ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.min(20, 160 / n) + 'px Outfit,sans-serif'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6;
            const t = this.prizes[i].name, mw = r * 0.65; ctx.fillText(ctx.measureText(t).width > mw ? t.substring(0, 7) + '…' : t, r - 22, 6); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); const cg = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy, 38); cg.addColorStop(0, '#3d0c0c'); cg.addColorStop(1, '#1a0505'); ctx.fillStyle = cg; ctx.fill();
        const lc = n * 3; for (let i = 0; i < lc; i++) { const da = (i / lc) * Math.PI * 2 + performance.now() * 0.001; ctx.beginPath(); ctx.arc(cx + (r + 3) * Math.cos(da), cy + (r + 3) * Math.sin(da), 3.5, 0, Math.PI * 2); const br = Math.sin(da * 3 + performance.now() * 0.005) > 0; ctx.fillStyle = br ? '#fbbf24' : '#d97706'; ctx.shadowColor = br ? 'rgba(251,191,36,0.8)' : 'transparent'; ctx.shadowBlur = br ? 8 : 0; ctx.fill(); ctx.shadowBlur = 0; }
    },
    spin(cb) {
        if (this.spinning) return; this.spinning = true; Sound.play('spin');
        const pi = App.getWeightedRandom(this.prizes), n = this.prizes.length, arc = 2 * Math.PI / n;
        const ta = -Math.PI / 2 - pi * arc - arc / 2 + (5 + Math.floor(Math.random() * 3)) * 2 * Math.PI, sa = this.angle, tr = ta - sa;
        const dur = 4500 + Math.random() * 1000, st = performance.now(); let ls = -1;
        const anim = (now) => {
            const p = Math.min((now - st) / dur, 1), e = 1 - Math.pow(1 - p, 4); this.angle = sa + tr * e; this.draw();
            const cs = Math.floor((((-this.angle - Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / arc) % n; if (cs !== ls) { ls = cs; if (p < 0.85) Sound.play('tick'); }
            if (p < 1) requestAnimationFrame(anim); else { this.spinning = false; cb(this.prizes[pi]); }
        };
        requestAnimationFrame(anim);
    }
};

const ScratchCard = {
    canvas: null, ctx: null, prize: null, scratching: false, revealed: false,
    renderGrid() {
        const grid = document.getElementById('scratch-grid');
        grid.innerHTML = '';
        const labels = ['MAY MẮN','PHÁT TÀI','VẠN SỰ','XUÂN VỀ','BÌNH AN','TÀI LỘC','AN KHANG','THỊNH VƯỢNG','HỶ SỰ'];
        for (let i = 0; i < 9; i++) {
            const card = document.createElement('div');
            card.className = 'scratch-card-item';
            card.dataset.index = i;
            card.innerHTML = `
                <div class="scratch-ticket">
                    <div class="ticket-top">
                        <span class="ticket-brand">LÌ XÌ</span>
                        <span class="ticket-stars">★ ★ ★</span>
                    </div>
                    <div class="ticket-main">
                        <div class="ticket-seal">福</div>
                    </div>
                    <div class="ticket-bottom">
                        <span class="ticket-num">${labels[i]}</span>
                    </div>
                </div>`;
            card.addEventListener('click', () => this.selectCard(i));
            grid.appendChild(card);
        }
    },
    selectCard(idx) {
        if (this.revealed) return;
        const cards = document.querySelectorAll('.scratch-card-item');
        cards.forEach((c, i) => { if (i !== idx) c.classList.add('disabled'); });
        cards[idx].classList.add('selected');
        Sound.play('click');
        setTimeout(() => {
            document.getElementById('scratch-overlay').classList.add('active');
            this.initCanvas();
        }, 400);
    },
    initCanvas() {
        this.canvas = document.getElementById('scratchCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.revealed = false;
        document.getElementById('scratch-prize-text').textContent = this.prize.name;

        const W = 320, H = 200;

        // Premium scratch layer — dark gradient with gold accents
        this.ctx.globalCompositeOperation = 'source-over';
        const g = this.ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#2d0a0a'); g.addColorStop(0.5, '#8b0000'); g.addColorStop(1, '#1a0505');
        this.ctx.fillStyle = g; this.ctx.fillRect(0, 0, W, H);

        // Gold foil diagonal stripes
        this.ctx.fillStyle = 'rgba(251,191,36,0.07)';
        for (let x = -H; x < W + H; x += 32) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0); this.ctx.lineTo(x + H, H);
            this.ctx.lineWidth = 14; this.ctx.strokeStyle = 'rgba(251,191,36,0.07)';
            this.ctx.stroke();
        }

        // Central gold seal on scratch layer
        this.ctx.beginPath();
        this.ctx.arc(W / 2, H / 2, 36, 0, Math.PI * 2);
        const sg = this.ctx.createRadialGradient(W/2 - 8, H/2 - 8, 0, W/2, H/2, 36);
        sg.addColorStop(0, 'rgba(255,215,0,0.35)');
        sg.addColorStop(1, 'rgba(200,150,0,0.12)');
        this.ctx.fillStyle = sg; this.ctx.fill();

        // Text on top of scratch layer
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = 'bold 20px Outfit,sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('✨ CÀO ĐỂ MỞ ✨', W / 2, H / 2 - 8);
        this.ctx.font = '500 13px Outfit,sans-serif';
        this.ctx.fillStyle = 'rgba(255,215,0,0.7)';
        this.ctx.fillText('Chà ngón tay lên đây nào!', W / 2, H / 2 + 16);

        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = 50;

        let lastX = null, lastY = null;
        let drawing = false;

        const draw = (x, y) => {
            if (!drawing) return;
            this.ctx.beginPath();
            if (lastX !== null) this.ctx.moveTo(lastX, lastY);
            else this.ctx.moveTo(x, y);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            lastX = x; lastY = y;
            this.checkReveal();
        };

        const onMove = (e) => {
            if (!this.scratching) return;
            e.preventDefault();
            const r = this.canvas.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            const x = (touch.clientX - r.left) * (W / r.width);
            const y = (touch.clientY - r.top) * (H / r.height);
            requestAnimationFrame(() => draw(x, y));
        };

        this.canvas.onmousedown = this.canvas.ontouchstart = (e) => {
            e.preventDefault();
            this.scratching = true;
            drawing = true;
            lastX = null; lastY = null;
            onMove(e);
        };
        this.canvas.onmousemove = this.canvas.ontouchmove = onMove;
        this.canvas.onmouseup = this.canvas.ontouchend =
        this.canvas.onmouseleave = this.canvas.ontouchcancel = () => {
            this.scratching = false;
            drawing = false;
        };
    },
    init(prize) { this.prize = prize; this.revealed = false; this.renderGrid(); },
    checkReveal() {
        if (this.revealed) return;
        // Sample only the center zone (x:60-260, y:20-140) where the prize text is displayed.
        // Reveal as soon as 35% of that zone is scratched — so the number is "nearly visible".
        const d = this.ctx.getImageData(60, 20, 200, 120).data;
        let t = 0, c = 0;
        for (let i = 3; i < d.length; i += 4) { t++; if (d[i] < 128) c++; }
        if (c / t > 0.35) {
            this.revealed = true;
            this.ctx.clearRect(0, 0, 320, 200); // auto-wipe remaining scratch layer
            Sound.play('win');
            setTimeout(() => {
                document.getElementById('scratch-overlay').classList.remove('active');
                App.handlePrizeWon(this.prize);
            }, 900);
        }
    },
    reset() {
        document.getElementById('scratch-overlay').classList.remove('active');
        const cards = document.querySelectorAll('.scratch-card-item');
        cards.forEach(c => { c.classList.remove('disabled', 'selected'); });
    }
};

const App = {
    currentRoom: null, currentPlayer: null, currentUser: null, selectedMode: 'wheel', dashboardListener: null, settingsPrizes: [], _lastPlayerCount: 0,
    defaultPrizes: [
        { name: '10,000d', weight: 30, value: 10000 }, { name: '20,000d', weight: 25, value: 20000 },
        { name: '50,000d', weight: 15, value: 50000 }, { name: '100,000d', weight: 8, value: 100000 },
        { name: '200,000d', weight: 5, value: 200000 }, { name: '500,000d', weight: 2, value: 500000 },
        { name: 'Chúc may mắn', weight: 10, value: 0 }, { name: 'Thêm 1 lượt', weight: 5, value: -1 }
    ],

    init() {
        Confetti.init();
        this.createBgParticles();
        this.createWheelSparkles();
        this.renderPrizeList(this.defaultPrizes);
        this.initMusic();
        this.bindEvents();
        this.initAuth();
        this.handleDeepLink();
        this.restorePreferences();
    },
    handleDeepLink() {
        const p = new URLSearchParams(window.location.search);
        const rc = p.get('room');
        if (rc && rc.length === 6) {
            const ci = document.getElementById('player-room-code');
            if (ci) ci.value = rc;
            this._deepLinkRoom = rc;
        }
    },
    isRoomExpired(r) {
        if (!r.timerHours || r.timerHours === 0) return false;
        const created = new Date(r.createdAt).getTime();
        return Date.now() > created + r.timerHours * 3600000;
    },

    // ==================== BIND ALL EVENTS ====================
    bindEvents() {
        const $ = id => document.getElementById(id);
        const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

        // Auth
        on('tab-btn-login', () => this.switchAuthTab('auth-login', $('tab-btn-login')));
        on('tab-btn-register', () => this.switchAuthTab('auth-register', $('tab-btn-register')));
        on('btn-login', () => this.loginEmail());
        on('btn-register', () => this.registerEmail());
        on('btn-google', () => this.loginGoogle());
        on('btn-logout', () => this.logout());
        on('btn-guest-play', () => this.guestPlay());

        const qrInput = $('bank-qr-upload');
        if (qrInput) qrInput.addEventListener('change', (e) => this.handleQRUpload(e));

        on('btn-remove-qr', () => {
            $('bank-qr-upload').value = '';
            $('qr-preview-wrapper').style.display = 'none';
            $('qr-upload-label').style.display = 'flex';
            this._uploadedQR = null;
            this.updateBankHint();
        });

        // Bank info live validation hint
        ['bank-name', 'bank-account', 'bank-holder'].forEach(id => {
            const el = $(id); if (el) el.addEventListener('input', () => this.updateBankHint());
        });

        // Password live check
        const pwInput = $('register-password');
        if (pwInput) pwInput.addEventListener('input', () => this.checkPasswordLive(pwInput.value));

        // Home
        on('btn-role-host', () => this.showScreen('screen-host-create'));
        on('btn-role-player', () => this.showScreen('screen-player-join'));
        on('btn-history', () => this.showScreen('screen-history'));
        on('btn-my-stats', () => { this.showScreen('screen-stats'); this.renderPersonalStats(); });
        on('back-stats', () => this.showScreen('screen-home'));

        // Theme + Music
        const themeEl = document.getElementById('theme-selector');
        if (themeEl) themeEl.addEventListener('change', () => this.applyTheme(themeEl.value));

        // Custom music picker
        const pickerBtn = document.getElementById('music-picker-btn');
        if (pickerBtn) {
            pickerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dd = document.getElementById('music-picker-dropdown');
                const arrow = document.getElementById('music-picker-arrow');
                const open = dd.classList.toggle('open');
                arrow.classList.toggle('rotated', open);
            });
            const display = pickerBtn.querySelector('.music-picker-display');
            const textEl = document.getElementById('music-picker-text');
            pickerBtn.addEventListener('mouseenter', () => this._startMarquee(textEl, display));
            pickerBtn.addEventListener('mouseleave', () => this._stopMarquee(textEl));
        }
        document.querySelectorAll('.music-option').forEach(opt => {
            const inner = opt.querySelector('.music-opt-inner');
            const box = opt.querySelector('.music-opt-textbox');
            opt.addEventListener('click', () => {
                this.changeMusic(opt.dataset.src);
                document.getElementById('music-picker-dropdown').classList.remove('open');
                document.getElementById('music-picker-arrow').classList.remove('rotated');
            });
            opt.addEventListener('mouseenter', () => this._startMarquee(inner, box));
            opt.addEventListener('mouseleave', () => this._stopMarquee(inner));
        });
        document.getElementById('music-picker')?.addEventListener('click', e => e.stopPropagation());
        document.addEventListener('click', () => {
            const dd = document.getElementById('music-picker-dropdown');
            if (dd && dd.classList.contains('open')) {
                dd.classList.remove('open');
                const arr = document.getElementById('music-picker-arrow');
                if (arr) arr.classList.remove('rotated');
            }
        });

        // History
        on('back-history', () => this.showScreen('screen-home'));
        on('htab-btn-created', () => this.switchTab('htab-my-rooms', $('htab-btn-created')));
        on('htab-btn-joined', () => this.switchTab('htab-joined', $('htab-btn-joined')));

        // Host create
        on('back-host-create', () => this.showScreen('screen-home'));
        on('mode-wheel', () => this.selectMode('wheel'));
        on('mode-envelope', () => this.selectMode('envelope'));
        on('mode-scratch', () => this.selectMode('scratch'));
        on('btn-add-prize', () => this.addPrize());
        on('btn-equal-prize', () => this.equalPrizes());
        on('btn-create-room', () => this.createRoom());

        // Dashboard
        on('btn-copy-code', () => this.copyRoomCode());
        on('btn-show-qr', () => this.showQRCode());
        on('btn-share-room', () => this.shareRoom());
        on('btn-share-native', () => this.shareRoom());
        on('btn-qr-close', () => { document.getElementById('qr-modal').classList.remove('active'); });
        on('dtab-btn-players', () => this.switchTab('tab-players', $('dtab-btn-players')));
        on('dtab-btn-leaderboard', () => this.switchTab('tab-leaderboard', $('dtab-btn-leaderboard')));
        on('dtab-btn-history', () => this.switchTab('tab-history', $('dtab-btn-history')));
        on('dtab-btn-payment', () => this.switchTab('tab-payment', $('dtab-btn-payment')));
        on('dtab-btn-settings', () => this.switchTab('tab-settings', $('dtab-btn-settings')));
        on('btn-toggle-room', () => this.toggleRoom());
        on('btn-reset-room', () => this.resetRoom());
        on('btn-delete-room', () => this.deleteRoom());
        on('btn-dashboard-home', () => this.showScreen('screen-home'));
        on('btn-export-csv', () => this.exportCSV());

        // Settings
        on('settings-mode-wheel', () => this.selectSettingsMode('wheel'));
        on('settings-mode-envelope', () => this.selectSettingsMode('envelope'));
        on('settings-mode-scratch', () => this.selectSettingsMode('scratch'));
        on('settings-btn-add-prize', () => this.addSettingsPrize());
        on('settings-btn-equal-prize', () => this.equalSettingsPrizes());
        on('btn-save-settings', () => this.saveSettings());

        // Player join
        on('back-player-join', () => this.showScreen('screen-home'));
        on('btn-join-room', () => this.joinRoom());

        // Games
        on('back-wheel', () => this.leaveGame());
        on('back-envelope', () => this.leaveGame());
        on('back-scratch', () => this.leaveGame());
        on('spinBtn', () => this.spinWheel());
        on('wheelCenterBtn', () => this.spinWheel());
        on('btn-play-again', () => this.playAgain());
        on('btn-leave-result', () => this.leaveGame());
        on('btn-send-bank-info', () => this.sendBankInfo());

        // Room code: digits only
        const codeInput = $('player-room-code');
        if (codeInput) {
            codeInput.addEventListener('input', () => {
                const clean = codeInput.value.replace(/\D/g, '').slice(0, 6);
                if (codeInput.value !== clean) codeInput.value = clean;
            });
            codeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.joinRoom();
            });
        }

        // QR modal close on overlay click
        document.getElementById('qr-modal').addEventListener('click', (e) => { if (e.target.id === 'qr-modal') e.target.classList.remove('active'); });
        // QR view modal: close on overlay click or close button
        const qrViewModal = document.getElementById('qr-view-modal');
        if (qrViewModal) {
            qrViewModal.addEventListener('click', (e) => { if (e.target === qrViewModal) qrViewModal.classList.remove('active'); });
            const closeBtn = document.getElementById('btn-qr-view-close');
            if (closeBtn) closeBtn.addEventListener('click', () => qrViewModal.classList.remove('active'));
        }
        // Escape key closes all modals and music picker
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            document.getElementById('qr-modal')?.classList.remove('active');
            document.getElementById('qr-view-modal')?.classList.remove('active');
            const dd = document.getElementById('music-picker-dropdown');
            if (dd && dd.classList.contains('open')) {
                dd.classList.remove('open');
                document.getElementById('music-picker-arrow')?.classList.remove('rotated');
            }
        });
    },

    // ==================== AUTH ====================
    initAuth() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user; this._isGuest = false; this.updateUserBar(user);
                const state = State.load();
                if (this._deepLinkRoom) {
                    this.showScreen('screen-home', true);
                    this.showScreen('screen-player-join');
                } else if (state && state.screen && state.screen !== 'screen-auth') await this.restoreState(state);
                else this.showScreen('screen-home', true);
            } else {
                if (!this._isGuest) {
                    this.currentUser = null; this.currentRoom = null; this.currentPlayer = null;
                    State.clear(); this.showScreen('screen-auth', true);
                }
            }
        });
    },

    updateUserBar(user) {
        const n = document.getElementById('user-display-name');
        const e = document.getElementById('user-email-display');
        const a = document.getElementById('user-avatar');
        const bar = document.getElementById('user-bar');
        if (this._isGuest) {
            n.textContent = '👻 Khách';
            e.textContent = 'Chơi ẩn danh';
            a.textContent = '👻'; a.style.fontSize = '1.2rem';
            if (bar) bar.style.display = 'flex';
            return;
        }
        if (bar) bar.style.display = 'flex';
        n.textContent = user.displayName || user.email.split('@')[0];
        e.textContent = user.email;
        if (user.photoURL) { a.innerHTML = '<img src="' + user.photoURL + '" alt="Avatar">'; }
        else { a.textContent = (user.displayName || user.email)[0].toUpperCase(); a.style.fontSize = '1.2rem'; a.style.fontWeight = '800'; a.style.color = '#1a0505'; }
    },

    guestPlay() {
        this._isGuest = true;
        this.currentUser = null;
        this.updateUserBar(null);
        this.showScreen('screen-player-join');
        Sound.play('click');
    },

    switchAuthTab(tabId, btnEl) {
        document.querySelectorAll('#auth-tabs .tab').forEach(t => t.classList.remove('active'));
        btnEl.classList.add('active');
        document.querySelectorAll('#screen-auth .tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        Sound.play('click');
    },

    validatePassword(pw) {
        if (pw.length < 8) return 'Mật khẩu phải ít nhất 8 ký tự';
        if (!/[A-Z]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 chữ IN HOA';
        if (!/[a-z]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 chữ thường';
        if (!/[0-9]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 chữ số';
        if (!/[^A-Za-z0-9]/.test(pw)) return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...)';
        return null;
    },

    checkPasswordLive(pw) {
        const checks = [
            { id: 'pw-len', ok: pw.length >= 8 },
            { id: 'pw-upper', ok: /[A-Z]/.test(pw) },
            { id: 'pw-lower', ok: /[a-z]/.test(pw) },
            { id: 'pw-num', ok: /[0-9]/.test(pw) },
            { id: 'pw-spec', ok: /[^A-Za-z0-9]/.test(pw) }
        ];
        checks.forEach(c => {
            const el = document.getElementById(c.id);
            if (!el) return;
            const label = el.textContent.replace(/^[✓✗]\s*/, '');
            el.textContent = (c.ok ? '✓ ' : '✗ ') + label;
            el.classList.toggle('valid', c.ok);
            el.style.color = '';
        });
    },

    getAuthErrorMessage(code) {
        const m = {
            'auth/email-already-in-use': 'Email này đã được đăng ký',
            'auth/invalid-email': 'Email không hợp lệ',
            'auth/weak-password': 'Mật khẩu không đủ mạnh',
            'auth/user-not-found': 'Không tìm thấy tài khoản',
            'auth/wrong-password': 'Sai mật khẩu',
            'auth/invalid-credential': 'Email hoặc mật khẩu không đúng',
            'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng đợi',
            'auth/popup-closed-by-user': 'Đã huỷ đăng nhập Google',
            'auth/network-request-failed': 'Lỗi mạng. Kiểm tra kết nối'
        };
        return m[code] || 'Đã có lỗi xảy ra. Vui lòng thử lại';
    },

    async loginEmail() {
        const email = document.getElementById('login-email').value.trim();
        const pw = document.getElementById('login-password').value;
        if (!email || !pw) { this.showToast('Vui lòng nhập email và mật khẩu', 'error'); Sound.play('error'); return; }
        const btn = document.getElementById('btn-login');
        btn.disabled = true; btn.textContent = '⏳ Đang đăng nhập...';
        try { await auth.signInWithEmailAndPassword(email, pw); Sound.play('win'); }
        catch (e) { this.showToast(this.getAuthErrorMessage(e.code), 'error'); Sound.play('error'); }
        finally { btn.disabled = false; btn.textContent = '🔑 Đăng nhập'; }
    },

    async registerEmail() {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const pw = document.getElementById('register-password').value;
        if (!name) { this.showToast('Vui lòng nhập tên', 'error'); Sound.play('error'); return; }
        if (!email) { this.showToast('Vui lòng nhập email', 'error'); Sound.play('error'); return; }
        if (!pw) { this.showToast('Vui lòng nhập mật khẩu', 'error'); Sound.play('error'); return; }
        const err = this.validatePassword(pw);
        if (err) { this.showToast(err, 'error'); Sound.play('error'); return; }
        const btn = document.getElementById('btn-register');
        btn.disabled = true; btn.textContent = '⏳ Đang tạo tài khoản...';
        try { const c = await auth.createUserWithEmailAndPassword(email, pw); await c.user.updateProfile({ displayName: name }); Sound.play('bigwin'); this.showToast('Chào mừng ' + name + '! 🎉', 'success'); }
        catch (e) { this.showToast(this.getAuthErrorMessage(e.code), 'error'); Sound.play('error'); }
        finally { btn.disabled = false; btn.textContent = '📝 Tạo tài khoản'; }
    },

    async loginGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        const btn = document.getElementById('btn-google');
        btn.disabled = true;
        try { await auth.signInWithPopup(provider); Sound.play('win'); }
        catch (e) { if (e.code !== 'auth/popup-closed-by-user') { this.showToast(this.getAuthErrorMessage(e.code), 'error'); Sound.play('error'); } }
        finally { btn.disabled = false; }
    },

    async logout() {
        if (this._isGuest) {
            this._isGuest = false; this.currentRoom = null; this.currentPlayer = null; State.clear();
            this.showScreen('screen-auth', true); return;
        }
        if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
        if (this.dashboardListener) { Storage.offRoomChange(this.dashboardListener); this.dashboardListener = null; }
        this.currentRoom = null; this.currentPlayer = null; State.clear();
        await auth.signOut(); this.showToast('Đã đăng xuất');
    },

    applyTheme(name) {
        const themes = {
            classic: {
                '--red-50': '#fff5f5', '--red-100': '#ffe3e3', '--red-200': '#ffc9c9', '--red-300': '#ff8787', '--red-400': '#ff4d4d', '--red-500': '#e03131', '--red-600': '#c92a2a', '--red-700': '#a61e1e', '--red-800': '#841919', '--red-900': '#5c0d0d',
                '--gold-50': '#fffbeb', '--gold-100': '#fef3c7', '--gold-200': '#fde68a', '--gold-300': '#fcd34d', '--gold-400': '#fbbf24', '--gold-500': '#f59e0b', '--gold-600': '#d97706', '--gold-700': '#b45309',
                '--bg-primary': '#1a0505', '--bg-card': 'rgba(139,0,0,0.25)', '--bg-glass': 'rgba(255,255,255,0.08)', '--bg-glass-strong': 'rgba(255,255,255,0.15)',
                '--text-primary': '#fff5f5', '--text-secondary': '#fcd34d', '--text-muted': 'rgba(255,245,245,0.6)',
                '--border-glow': 'rgba(251,191,36,0.3)', '--shadow-gold': '0 0 30px rgba(251,191,36,0.2)', '--shadow-red': '0 0 30px rgba(224,49,49,0.3)',
                '--gradient-bg': 'radial-gradient(ellipse at top,#3d0c0c 0%,#1a0505 50%,#0d0202 100%)',
                '--gradient-red': 'linear-gradient(135deg,#e03131,#c92a2a)', '--gradient-gold': 'linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)',
                '--gradient-card': 'linear-gradient(145deg,rgba(200,40,40,0.3),rgba(139,0,0,0.15))',
                '--gradient-button': 'linear-gradient(135deg,#fbbf24,#f59e0b)', '--gradient-button-red': 'linear-gradient(135deg,#e03131,#c92a2a)',
                '--glow-primary': '251,191,36', '--glow-accent': '224,49,49', '--btn-gold-text': '#1a0505'
            },
            jade: {
                '--red-50': '#f0fdf4', '--red-100': '#dcfce7', '--red-200': '#bbf7d0', '--red-300': '#86efac', '--red-400': '#4ade80', '--red-500': '#22c55e', '--red-600': '#16a34a', '--red-700': '#15803d', '--red-800': '#166534', '--red-900': '#14532d',
                '--gold-50': '#ecfdf5', '--gold-100': '#d1fae5', '--gold-200': '#a7f3d0', '--gold-300': '#6ee7b7', '--gold-400': '#34d399', '--gold-500': '#10b981', '--gold-600': '#059669', '--gold-700': '#047857',
                '--bg-primary': '#022c22', '--bg-card': 'rgba(6, 78, 59, 0.4)', '--bg-glass': 'rgba(209, 250, 229, 0.05)', '--bg-glass-strong': 'rgba(209, 250, 229, 0.1)',
                '--text-primary': '#ecfdf5', '--text-secondary': '#6ee7b7', '--text-muted': 'rgba(236,253,245,0.6)',
                '--border-glow': 'rgba(52,211,153,0.4)', '--shadow-gold': '0 0 30px rgba(52,211,153,0.15)', '--shadow-red': '0 0 30px rgba(16,185,129,0.25)',
                '--gradient-bg': 'radial-gradient(ellipse at top, #064e3b 0%, #022c22 60%, #061e16 100%)',
                '--gradient-red': 'linear-gradient(135deg, #15803d, #14532d)', '--gradient-gold': 'linear-gradient(135deg, #4ade80, #22c55e, #16a34a)',
                '--gradient-card': 'linear-gradient(145deg, rgba(6, 78, 59, 0.6), rgba(2, 44, 34, 0.4))',
                '--gradient-button': 'linear-gradient(135deg, #4ade80, #22c55e)', '--gradient-button-red': 'linear-gradient(135deg, #ef4444, #dc2626)',
                '--glow-primary': '74, 222, 128', '--glow-accent': '34, 197, 94', '--btn-gold-text': '#022c22'
            },
            sakura: {
                '--red-50': '#fff1f2', '--red-100': '#ffe4e6', '--red-200': '#fecdd3', '--red-300': '#fda4af', '--red-400': '#fb7185', '--red-500': '#f43f5e', '--red-600': '#e11d48', '--red-700': '#be123c', '--red-800': '#9f1239', '--red-900': '#881337',
                '--gold-50': '#fdf2f8', '--gold-100': '#fce7f3', '--gold-200': '#fbcfe8', '--gold-300': '#f9a8d4', '--gold-400': '#f472b6', '--gold-500': '#ec4899', '--gold-600': '#db2777', '--gold-700': '#be185d',
                '--bg-primary': '#2e0b16', '--bg-card': 'rgba(131, 24, 67, 0.3)', '--bg-glass': 'rgba(255, 228, 230, 0.05)', '--bg-glass-strong': 'rgba(255, 228, 230, 0.1)',
                '--text-primary': '#fff1f2', '--text-secondary': '#fda4af', '--text-muted': 'rgba(255, 241, 242, 0.6)',
                '--border-glow': 'rgba(251, 113, 133, 0.4)', '--shadow-gold': '0 0 30px rgba(251, 113, 133, 0.2)', '--shadow-red': '0 0 30px rgba(225, 29, 72, 0.3)',
                '--gradient-bg': 'radial-gradient(ellipse at top, #831843 0%, #500724 50%, #2e0b16 100%)',
                '--gradient-red': 'linear-gradient(135deg, #be123c, #9f1239)', '--gradient-gold': 'linear-gradient(135deg, #fb7185, #f43f5e, #e11d48)',
                '--gradient-card': 'linear-gradient(145deg, rgba(159, 18, 57, 0.4), rgba(131, 24, 67, 0.2))',
                '--gradient-button': 'linear-gradient(135deg, #fb7185, #f43f5e)', '--gradient-button-red': 'linear-gradient(135deg, #be123c, #9f1239)',
                '--glow-primary': '251, 113, 133', '--glow-accent': '244, 63, 94', '--btn-gold-text': '#2e0b16'
            },
            royal: {
                '--red-50': '#faf5ff', '--red-100': '#f3e8ff', '--red-200': '#e9d5ff', '--red-300': '#d8b4fe', '--red-400': '#c084fc', '--red-500': '#a855f7', '--red-600': '#9333ea', '--red-700': '#7e22ce', '--red-800': '#6b21a8', '--red-900': '#581c87',
                '--gold-50': '#fffbeb', '--gold-100': '#fef3c7', '--gold-200': '#fde68a', '--gold-300': '#fcd34d', '--gold-400': '#fbbf24', '--gold-500': '#f59e0b', '--gold-600': '#d97706', '--gold-700': '#b45309',
                '--bg-primary': '#190a2e', '--bg-card': 'rgba(88, 28, 135, 0.35)', '--bg-glass': 'rgba(233, 213, 255, 0.05)', '--bg-glass-strong': 'rgba(233, 213, 255, 0.1)',
                '--text-primary': '#faf5ff', '--text-secondary': '#fcd34d', '--text-muted': 'rgba(250, 245, 255, 0.6)',
                '--border-glow': 'rgba(251, 191, 36, 0.4)', '--shadow-gold': '0 0 35px rgba(251, 191, 36, 0.25)', '--shadow-red': '0 0 35px rgba(147, 51, 234, 0.3)',
                '--gradient-bg': 'radial-gradient(ellipse at top, #4c1d95 0%, #2e1065 50%, #170a2b 100%)',
                '--gradient-red': 'linear-gradient(135deg, #7e22ce, #6b21a8)', '--gradient-gold': 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
                '--gradient-card': 'linear-gradient(145deg, rgba(107, 33, 168, 0.4), rgba(88, 28, 135, 0.2))',
                '--gradient-button': 'linear-gradient(135deg, #fbbf24, #f59e0b)', '--gradient-button-red': 'linear-gradient(135deg, #9333ea, #7e22ce)',
                '--glow-primary': '251, 191, 36', '--glow-accent': '147, 51, 234', '--btn-gold-text': '#190a2e'
            },
            midnight: {
                '--red-50': '#f0f9ff', '--red-100': '#e0f2fe', '--red-200': '#bae6fd', '--red-300': '#7dd3fc', '--red-400': '#38bdf8', '--red-500': '#0ea5e9', '--red-600': '#0284c7', '--red-700': '#0369a1', '--red-800': '#075985', '--red-900': '#0c4a6e',
                '--gold-50': '#f0f9ff', '--gold-100': '#e0f2fe', '--gold-200': '#bae6fd', '--gold-300': '#7dd3fc', '--gold-400': '#38bdf8', '--gold-500': '#0ea5e9', '--gold-600': '#0284c7', '--gold-700': '#0369a1',
                '--bg-primary': '#020617', '--bg-card': 'rgba(15, 23, 42, 0.6)', '--bg-glass': 'rgba(224, 242, 254, 0.05)', '--bg-glass-strong': 'rgba(224, 242, 254, 0.1)',
                '--text-primary': '#f0f9ff', '--text-secondary': '#38bdf8', '--text-muted': 'rgba(240, 249, 255, 0.5)',
                '--border-glow': 'rgba(56, 189, 248, 0.3)', '--shadow-gold': '0 0 40px rgba(14, 165, 233, 0.2)', '--shadow-red': '0 0 40px rgba(56, 189, 248, 0.15)',
                '--gradient-bg': 'radial-gradient(ellipse at top, #0f172a 0%, #020617 70%, #000000 100%)',
                '--gradient-red': 'linear-gradient(135deg, #0369a1, #075985)', '--gradient-gold': 'linear-gradient(135deg, #38bdf8, #0ea5e9, #0284c7)',
                '--gradient-card': 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.5))',
                '--gradient-button': 'linear-gradient(135deg, #38bdf8, #0ea5e9)', '--gradient-button-red': 'linear-gradient(135deg, #ef4444, #dc2626)',
                '--glow-primary': '56, 189, 248', '--glow-accent': '14, 165, 233', '--btn-gold-text': '#020617'
            }
        };
        const t = themes[name] || themes.classic;
        Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
        // Also set body background
        document.body.style.background = t['--gradient-bg'];
        localStorage.setItem('lixi-theme', name);
        Sound.play('click');
    },
    _startMarquee(textEl, container) {
        if (!textEl || !container) return;
        clearTimeout(textEl._mqTimer);
        textEl.style.transition = 'none';
        textEl.style.transform = 'translateX(0)';
        const overflow = textEl.scrollWidth - container.clientWidth;
        if (overflow <= 4) return;
        const dur = Math.max(1.2, overflow * 0.033);
        textEl._mqTimer = setTimeout(() => {
            textEl.style.transition = `transform ${dur}s linear`;
            textEl.style.transform = `translateX(-${overflow}px)`;
        }, 300);
    },
    _stopMarquee(textEl) {
        if (!textEl) return;
        clearTimeout(textEl._mqTimer);
        textEl.style.transition = 'transform 0.25s ease';
        textEl.style.transform = 'translateX(0)';
    },
    changeMusic(src) {
        const audio = document.getElementById('bgMusic');
        if (!audio) return;
        const TRACKS = {
            'music1.mp3': 'Một năm mới bình an - Sơn Tùng MTP',
            'music2.mp3': 'Như hoa mùa xuân - Hồ Ngọc Hà, Thuỷ Tiên, Minh Hằng',
            'music3.mp3': 'Ngày xuân long phượng xum vầy - Bích Phương'
        };
        const playing = !audio.paused;
        audio.src = src;
        if (playing) audio.play().catch(() => { });
        localStorage.setItem('lixi-music', src);
        const textEl = document.getElementById('music-picker-text');
        if (textEl) { textEl.style.transform = 'translateX(0)'; textEl.textContent = TRACKS[src] || src; }
        document.querySelectorAll('.music-option').forEach(o => o.classList.toggle('selected', o.dataset.src === src));
        Sound.play('click');
    },
    restorePreferences() {
        const theme = localStorage.getItem('lixi-theme');
        if (theme && theme !== 'classic') {
            this.applyTheme(theme);
            const sel = document.getElementById('theme-selector');
            if (sel) sel.value = theme;
        }
        const music = localStorage.getItem('lixi-music');
        // Migrate old key 'music.mp3' -> 'music1.mp3' (persist the migration)
        if (music === 'music.mp3') localStorage.setItem('lixi-music', 'music1.mp3');
        const src = (music && music !== 'music.mp3') ? music : null;
        if (src && src !== 'music1.mp3') {
            const audio = document.getElementById('bgMusic');
            if (audio) audio.src = src;
            const TRACKS = {
                'music1.mp3': 'Một năm mới bình an - Sơn Tùng MTP',
                'music2.mp3': 'Như hoa mùa xuân - Hồ Ngọc Hà, Thuỷ Tiên, Minh Hằng',
                'music3.mp3': 'Ngày xuân long phượng xum vầy - Bích Phương'
            };
            const textEl = document.getElementById('music-picker-text');
            if (textEl) textEl.textContent = TRACKS[src] || src;
            document.querySelectorAll('.music-option').forEach(o => o.classList.toggle('selected', o.dataset.src === src));
        }
    },

    // ==================== STATE ====================
    async restoreState(state) {
        try {
            if (state.roomCode) { const r = await Storage.getRoom(state.roomCode); if (!r) { State.clear(); this.showScreen('screen-home', true); return; } this.currentRoom = r; }
            if (state.playerName) this.currentPlayer = state.playerName;
            if (state.screen === 'screen-host-dashboard' && this.currentRoom) this.showDashboard();
            else if (state.screen === 'screen-game-wheel' && this.currentRoom && this.currentPlayer) this.startWheelGame();
            else if (state.screen === 'screen-game-envelope' && this.currentRoom && this.currentPlayer) this.startEnvelopeGame();
            else if (state.screen === 'screen-game-scratch' && this.currentRoom && this.currentPlayer) this.startScratchGame();
            else this.showScreen(state.screen, true);
        } catch (e) { State.clear(); this.showScreen('screen-home', true); }
    },
    persistState(s) { State.save({ screen: s, roomCode: this.currentRoom ? this.currentRoom.code : null, playerName: this.currentPlayer }); },

    // ==================== UI ====================
    createBgParticles() { const c = document.getElementById('bgParticles'), cols = ['#fbbf2440', '#e0313140', '#ffd70030', '#ff4d4d30']; for (let i = 0; i < 20; i++) { const p = document.createElement('div'); p.className = 'particle'; const s = Math.random() * 6 + 2; p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + Math.random() * 100 + '%;background:' + cols[Math.floor(Math.random() * cols.length)] + ';animation-duration:' + (8 + Math.random() * 12) + 's;animation-delay:' + Math.random() * 10 + 's;'; c.appendChild(p); } },
    createWheelSparkles() { const c = document.getElementById('wheel-sparkles'); if (!c) return; for (let i = 0; i < 12; i++) { const s = document.createElement('div'); s.className = 'wheel-sparkle'; const a = (i / 12) * 360, d = 48 + Math.random() * 5; s.style.cssText = 'top:' + (50 + d * Math.sin(a * Math.PI / 180)) + '%;left:' + (50 + d * Math.cos(a * Math.PI / 180)) + '%;animation-delay:' + (i / 12) * 2 + 's;'; c.appendChild(s); } },
    initMusic() { const m = document.getElementById('bgMusic'), b = document.getElementById('musicToggle'); let p = false; b.addEventListener('click', () => { Sound.init(); if (p) { m.pause(); b.textContent = '🔇'; b.classList.remove('playing'); } else { m.play().catch(() => { }); b.textContent = '🎵'; b.classList.add('playing'); } p = !p; }); },

    showScreen(id, skip) {
        if (!this.currentUser && !this._isGuest && id !== 'screen-auth') return;
        if (this.dashboardListener && id !== 'screen-host-dashboard') { Storage.offRoomChange(this.dashboardListener); this.dashboardListener = null; }
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const t = document.getElementById(id); if (t) { t.classList.add('active'); t.style.animation = 'none'; t.offsetHeight; t.style.animation = ''; }
        if (!skip) this.persistState(id);
        if (id === 'screen-home') {
            if (this._isGuest) { this._isGuest = false; this.currentRoom = null; this.currentPlayer = null; State.clear(); this.showScreen('screen-auth', true); return; }
            this.currentRoom = null; this.currentPlayer = null; State.clear();
        }
        if (id === 'screen-history') this.renderHistoryScreen();
        if (id === 'screen-player-join') {
            if (this.currentUser) { const ni = document.getElementById('player-name'); if (!ni.value) ni.value = this.currentUser.displayName || ''; }
            // Restore last used guest name
            const ni = document.getElementById('player-name');
            if (ni && !ni.value) ni.value = localStorage.getItem('lixi-last-name') || '';
            if (this._deepLinkRoom) { document.getElementById('player-room-code').value = this._deepLinkRoom; this._deepLinkRoom = null; }
        }
        Sound.play('click');
    },
    showToast(msg, type) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast show' + (type ? ' toast-' + type : '');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => t.classList.remove('show'), type === 'error' ? 4000 : 4500);
    },

    // ==================== MODE / PRIZE ====================
    selectMode(m) { this.selectedMode = m; document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected')); document.getElementById('mode-' + m).classList.add('selected'); Sound.play('click'); },
    renderPrizeList(prizes, containerId, dataArray) {
        containerId = containerId || 'prize-list';
        dataArray = dataArray || 'defaultPrizes';
        const c = document.getElementById(containerId); c.innerHTML = '';
        prizes.forEach((p, i) => {
            const item = document.createElement('div'); item.className = 'prize-item';
            const n = document.createElement('input'); n.className = 'input-field'; n.type = 'text'; n.value = p.name; n.placeholder = 'Tên giải'; n.addEventListener('change', () => { this[dataArray][i].name = n.value; });
            const w = document.createElement('input'); w.className = 'input-field'; w.type = 'number'; w.value = p.weight; w.min = '0.01'; w.max = '100'; w.step = 'any'; w.placeholder = '%'; w.addEventListener('change', () => { this[dataArray][i].weight = parseFloat(w.value) || 1; });
            const d = document.createElement('button'); d.className = 'btn btn-icon'; d.textContent = '✕'; d.title = 'Xoá'; d.addEventListener('click', () => { if (dataArray === 'settingsPrizes') this.removeSettingsPrize(i); else this.removePrize(i); });
            item.appendChild(n); item.appendChild(w); item.appendChild(d); c.appendChild(item);
        });
    },
    addPrize() { this.defaultPrizes.push({ name: 'Giải mới', weight: 10, value: 0 }); this.renderPrizeList(this.defaultPrizes); Sound.play('click'); },
    removePrize(i) { if (this.defaultPrizes.length <= 2) { this.showToast('Cần ít nhất 2 giải', 'error'); Sound.play('error'); return; } this.defaultPrizes.splice(i, 1); this.renderPrizeList(this.defaultPrizes); Sound.play('click'); },
    equalPrizes() { const n = this.defaultPrizes.length; const w = parseFloat((100 / n).toFixed(2)); this.defaultPrizes.forEach(p => { p.weight = w; }); this.renderPrizeList(this.defaultPrizes); this.showToast('Đã chia đều: ' + w + '% mỗi giải'); Sound.play('click'); },

    // ==================== CREATE ROOM ====================
    async createRoom() {
        const name = document.getElementById('host-room-name').value.trim();
        if (!name) { this.showToast('Vui lòng nhập tên phòng', 'error'); Sound.play('error'); return; }
        const prizes = [];
        document.querySelectorAll('#prize-list .prize-item').forEach(item => { const inp = item.querySelectorAll('.input-field'); const pn = inp[0].value.trim(), pw = parseInt(inp[1].value) || 10; if (pn) { const m = pn.replace(/[,\.]/g, '').match(/(\d+)/); prizes.push({ name: pn, weight: pw, value: m ? parseInt(m[1]) : 0 }); } });
        if (prizes.length < 2) { this.showToast('Cần ít nhất 2 giải', 'error'); Sound.play('error'); return; }
        const mt = parseInt(document.getElementById('host-max-turns').value) || 1;
        const removePrizeOnWin = document.getElementById('host-remove-prize').checked;
        const greeting = (document.getElementById('host-greeting').value || '').trim();
        const timerHours = parseInt(document.getElementById('host-timer').value) || 0;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const room = { code, name, mode: this.selectedMode, prizes, maxTurns: mt, removePrizeOnWin, greeting, timerHours, isOpen: true, players: [], history: [], createdAt: new Date().toISOString(), ownerId: this.currentUser.uid };
        this.showToast('Đang tạo phòng...');
        await Storage.saveRoom(code, room); await Storage.saveCreatedRoom(this.currentUser.uid, code, name);
        this.currentRoom = room; Sound.play('win'); this.showToast('Tạo phòng thành công! 🎉', 'success'); this.showDashboard();
    },

    // ==================== DASHBOARD ====================
    showDashboard() {
        const r = this.currentRoom; if (!r) return;
        document.getElementById('dashboard-room-name').textContent = r.name;
        document.getElementById('dashboard-room-code').textContent = r.code;
        this.refreshDashboard(r); this.showScreen('screen-host-dashboard');
        this.dashboardListener = r.code; Storage.onRoomChange(r.code, d => { this.currentRoom = d; this.refreshDashboard(d); });
    },
    refreshDashboard(r) {
        const pl = r.players || [], h = r.history || [];
        // Host notification: new player joined
        if (this._lastPlayerCount > 0 && pl.length > this._lastPlayerCount) {
            const newest = pl[pl.length - 1];
            this.showToast('\ud83d\udc64 ' + (newest.name || 'Ai đó') + ' vừa tham gia!');
            Sound.play('click');
        }
        this._lastPlayerCount = pl.length;
        // Host notification: big win
        if (h.length > 0) {
            const last = h[h.length - 1];
            if (this._lastHistoryLen && h.length > this._lastHistoryLen && (last.value || 0) >= 100000) {
                this.showToast('\ud83c\udf86 ' + this.esc(last.playerName) + ' trúng JACKPOT: ' + this.esc(last.prizeName) + '!');
                Sound.play('bigwin');
            }
        }
        this._lastHistoryLen = h.length;
        // Check expiry
        if (this.isRoomExpired(r) && r.isOpen) {
            r.isOpen = false; Storage.saveRoom(r.code, r);
            this.showToast('\u23f0 Phòng đã hết hạn và tự động khóa!');
        }
        document.getElementById('stat-players').textContent = pl.length;
        document.getElementById('stat-played').textContent = h.length;
        document.getElementById('stat-total').textContent = this.formatMoney(h.reduce((s, x) => s + (x.value > 0 ? x.value : 0), 0));
        const ptb = document.getElementById('players-tbody'), pe = document.getElementById('players-empty');
        if (!pl.length) { ptb.innerHTML = ''; pe.style.display = 'block'; }
        else { pe.style.display = 'none'; ptb.innerHTML = pl.map((p, i) => { const tu = h.filter(x => x.playerName === p.name).length, tl = r.maxTurns - tu; return '<tr><td>' + (i + 1) + '</td><td>' + this.esc(p.name) + '</td><td>' + tl + '/' + r.maxTurns + '</td><td>' + (tl > 0 ? '<span class="badge badge-green">Chưa hết</span>' : '<span class="badge badge-red">Hết lượt</span>') + '</td></tr>'; }).join(''); }
        const htb = document.getElementById('history-tbody'), he = document.getElementById('history-empty');
        if (!h.length) { htb.innerHTML = ''; he.style.display = 'block'; }
        else {
            he.style.display = 'none';
            const bankMap = {}; Object.values(r.bankInfos || {}).forEach(b => bankMap[b.playerName] = b);
            htb.innerHTML = h.slice().reverse().map(x => {
                const t = new Date(x.time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const b = bankMap[x.playerName];
                let payInfo = '<span class="text-muted" style="font-size:0.7rem">N/A</span>';
                if (b) {
                    payInfo = `<button class="view-qr-btn" onclick="App.showPaymentDetail('${this.esc(x.playerName)}')">💳 Xem</button>`;
                }
                return `<tr>
                    <td>${this.esc(x.playerName)}</td>
                    <td><span class="badge ${x.value > 100000 ? 'badge-gold' : 'badge-green'}">${this.esc(x.prizeName)}</span></td>
                    <td>${payInfo}</td>
                    <td style="font-size:0.75rem">${t}</td>
                </tr>`;
            }).join('');
        }
        this.updateRoomStatusUI(r);
        this.populateSettings(r);
        this.renderLeaderboard(r);
        this.renderBankInfos(r);
    },
    updateRoomStatusUI(r) {
        const s = document.getElementById('room-status'), t = document.getElementById('room-status-text'), b = document.getElementById('btn-toggle-room');
        if (r.isOpen) { s.className = 'room-status open'; t.textContent = 'Đang mở'; b.textContent = '🔒 Khoá phòng'; }
        else { s.className = 'room-status closed'; t.textContent = 'Đã khoá'; b.textContent = '🔓 Mở phòng'; }
    },
    switchTab(tabId, btn) {
        const card = btn.closest('.glass-card');
        card.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        card.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active'); document.getElementById(tabId).classList.add('active'); Sound.play('click');
    },
    async toggleRoom() { if (!this.currentRoom) return; this.currentRoom.isOpen = !this.currentRoom.isOpen; await Storage.saveRoom(this.currentRoom.code, this.currentRoom); this.showToast(this.currentRoom.isOpen ? 'Phòng đã mở' : 'Phòng đã khoá'); Sound.play('click'); },
    async resetRoom() { if (!this.currentRoom || !confirm('Reset phòng?')) return; this.currentRoom.players = []; this.currentRoom.history = []; await Storage.saveRoom(this.currentRoom.code, this.currentRoom); this.showToast('Đã reset phòng'); Sound.play('click'); },
    async deleteRoom() { if (!this.currentRoom || !confirm('Xoá phòng vĩnh viễn?')) return; Storage.offRoomChange(this.currentRoom.code); this.dashboardListener = null; await Storage.deleteRoom(this.currentRoom.code); this.currentRoom = null; State.clear(); this.showScreen('screen-home'); this.showToast('Đã xoá phòng'); },
    copyRoomCode() { if (!this.currentRoom) return; navigator.clipboard.writeText(this.currentRoom.code).then(() => this.showToast('Đã sao chép: ' + this.currentRoom.code)).catch(() => this.showToast('Mã: ' + this.currentRoom.code)); Sound.play('click'); },
    getRoomURL() { const base = window.location.origin + window.location.pathname; return base + '?room=' + this.currentRoom.code; },
    showQRCode() {
        if (!this.currentRoom) return;
        const container = document.getElementById('qr-code'); container.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(container, { text: this.getRoomURL(), width: 220, height: 220, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
        } else { container.innerHTML = '<p class="text-muted">Không thể tạo QR. Mã phòng: ' + this.currentRoom.code + '</p>'; }
        document.getElementById('qr-modal').classList.add('active'); Sound.play('click');
    },
    async shareRoom() {
        if (!this.currentRoom) return;
        const url = this.getRoomURL();
        const text = '\ud83e\udde7 Tham gia phòng Lì Xì "' + this.currentRoom.name + '"! Mã: ' + this.currentRoom.code;
        if (navigator.share) { try { await navigator.share({ title: 'Lì Xì May Mắn', text, url }); } catch (e) { } }
        else { navigator.clipboard.writeText(text + '\n' + url).then(() => this.showToast('Đã sao chép link!')).catch(() => { }); }
        Sound.play('click');
    },
    renderLeaderboard(r) {
        const h = r.history || [], ll = document.getElementById('leaderboard-list'), le = document.getElementById('leaderboard-empty');
        if (!h.length) { ll.innerHTML = ''; le.style.display = 'block'; return; }
        le.style.display = 'none';
        const map = {}; h.forEach(x => { if (!map[x.playerName]) map[x.playerName] = { total: 0, count: 0 }; map[x.playerName].total += (x.value > 0 ? x.value : 0); map[x.playerName].count++; });
        const sorted = Object.entries(map).sort((a, b) => b[1].total - a[1].total);
        const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
        ll.innerHTML = sorted.map(([name, d], i) => '<div class="leaderboard-item' + (i < 3 ? ' top-' + (i + 1) : '') + '"><span class="lb-rank">' + (medals[i] || (i + 1)) + '</span><span class="lb-name">' + this.esc(name) + '</span><span class="lb-value">' + this.formatMoney(d.total) + ' (' + d.count + ' lượt)</span></div>').join('');
    },
    renderBankInfos(r) {
        const viewer = document.getElementById('bank-info-viewer');
        if (!viewer) return;
        const infos = Object.values(r.bankInfos || {}); // players who submitted
        const history = r.history || [];
        // Winners = unique players who won a monetary prize (value > 0)
        const winners = [...new Set(
            history.filter(h => (h.value || 0) > 0).map(h => h.playerName)
        )];

        if (!winners.length && !infos.length) {
            viewer.innerHTML = '<div class="payment-empty"><div class="empty-icon">💳</div><p>Chưa có lượt trúng thưởng nào</p></div>';
            return;
        }

        // Badge count on tab button
        const pending = winners.filter(p => !infos.find(b => b.playerName === p)).length;
        const tabBtn = document.getElementById('dtab-btn-payment');
        if (tabBtn) tabBtn.innerHTML = '💳 Thanh toán' + (pending > 0 ? ' <span class="payment-badge">' + pending + '</span>' : '');

        const submitted = winners.length - pending;
        const summaryHtml = `
            <div class="payment-summary">
                <div class="payment-stat ps-green">
                    <span class="ps-num">${submitted}</span>
                    <span class="ps-label">Đã gửi TT</span>
                </div>
                <div class="payment-stat ps-orange">
                    <span class="ps-num">${pending}</span>
                    <span class="ps-label">Chưa gửi</span>
                </div>
                <div class="payment-stat ps-blue">
                    <span class="ps-num">${winners.length}</span>
                    <span class="ps-label">Tổng người trúng</span>
                </div>
            </div>`;

        const cardsHtml = winners.map(playerName => {
            const info = infos.find(b => b.playerName === playerName);
            const playerPrizes = history.filter(h => h.playerName === playerName && (h.value || 0) > 0);
            const totalValue = playerPrizes.reduce((s, h) => s + (h.value || 0), 0);
            const prizeNames = playerPrizes.map(h => this.esc(h.prizeName)).join(', ');

            if (!info) {
                // Winner hasn't submitted payment info yet
                return `<div class="payment-card payment-card-pending">
                    <div class="payment-card-header">
                        <div class="payment-card-name">📳 ${this.esc(playerName)}</div>
                        <span class="payment-status-badge badge-pending">⏳ Chưa gửi</span>
                    </div>
                    <div class="payment-card-prizes">
                        <span class="prize-tag">🏆 ${prizeNames}</span>
                        <span class="prize-value">${this.formatMoney(totalValue)}</span>
                    </div>
                    <div class="payment-card-note">⚠️ Người chơi chưa gửi thông tin nhận thưởng</div>
                </div>`;
            }

            // Winner has submitted
            const time = new Date(info.time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `<div class="payment-card payment-card-done">
                <div class="payment-card-header">
                    <div class="payment-card-name">✅ ${this.esc(playerName)}</div>
                    <span class="payment-status-badge badge-done">✓ Đã gửi</span>
                </div>
                <div class="payment-card-prizes">
                    <span class="prize-tag">🏆 ${prizeNames}</span>
                    <span class="prize-value">${this.formatMoney(totalValue)}</span>
                </div>
                <div class="payment-card-body">
                    <div class="payment-row">
                        <span class="payment-label">🏦 Ngân hàng</span>
                        <span class="payment-value">${this.esc(info.bankName || '—')}</span>
                    </div>
                    <div class="payment-row">
                        <span class="payment-label">💳 Số TK</span>
                        <span class="payment-value">
                            <strong>${this.esc(info.bankAccount || '—')}</strong>
                            ${info.bankAccount ? `<button class="copy-btn" onclick="App.copyText('${this.esc(info.bankAccount)}')" title="Sao chép">📋</button>` : ''}
                        </span>
                    </div>
                    <div class="payment-row">
                        <span class="payment-label">👤 Chủ TK</span>
                        <span class="payment-value">${this.esc(info.bankHolder || '—')}</span>
                    </div>
                    <div class="payment-row">
                        <span class="payment-label">🕒 Gửi lúc</span>
                        <span class="payment-value" style="font-size:0.78rem;opacity:0.7">${time}</span>
                    </div>
                    ${info.qrImage ? `<div class="payment-qr-wrap">
                        <img src="${info.qrImage}" class="payment-qr-img" alt="QR" onclick="App.showFullQR('${info.qrImage}')" title="Bấm để xem to">
                        <div class="payment-qr-label">📃 Mã QR chuyển khoản (bấm để xem to)</div>
                    </div>` : '<div class="payment-no-qr">📷 Chưa có ảnh QR</div>'}
                </div>
            </div>`;
        }).join('');

        // Also show people who submitted but aren't in our winner list (edge case)
        const extraInfos = infos.filter(b => !winners.includes(b.playerName));
        const extraHtml = extraInfos.length ? '<div class="payment-extra-header">📎 Thông tin khác</div>' +
            extraInfos.map(b => {
                const time = new Date(b.time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                return `<div class="payment-card payment-card-done">
                    <div class="payment-card-header">
                        <div class="payment-card-name">${this.esc(b.playerName)}</div>
                        <span class="payment-status-badge badge-done">✓ Đã gửi</span>
                    </div>
                    <div class="payment-card-body">
                        <div class="payment-row"><span class="payment-label">🏦 NH</span><span class="payment-value">${this.esc(b.bankName || '—')}</span></div>
                        <div class="payment-row"><span class="payment-label">💳 STK</span><span class="payment-value"><strong>${this.esc(b.bankAccount || '—')}</strong>${b.bankAccount ? `<button class="copy-btn" onclick="App.copyText('${this.esc(b.bankAccount)}')">📋</button>` : ''}</span></div>
                        <div class="payment-row"><span class="payment-label">👤 Chủ TK</span><span class="payment-value">${this.esc(b.bankHolder || '—')}</span></div>
                        ${b.qrImage ? `<div class="payment-qr-wrap"><img src="${b.qrImage}" class="payment-qr-img" onclick="App.showFullQR('${b.qrImage}')"></div>` : ''}
                    </div>
                </div>`;
            }).join('') : '';

        viewer.innerHTML = summaryHtml + cardsHtml + extraHtml;
    },
    copyText(text) {
        navigator.clipboard.writeText(text)
            .then(() => this.showToast('Đã sao chép: ' + text))
            .catch(() => this.showToast(text));
        Sound.play('click');
    },
    exportCSV() {
        if (!this.currentRoom || !this.currentRoom.history || !this.currentRoom.history.length) { this.showToast('Không có dữ liệu'); return; }
        const rows = [['Tên', 'Giải thưởng', 'Giá trị', 'Thời gian']];
        this.currentRoom.history.forEach(h => rows.push([h.playerName, h.prizeName, h.value || 0, h.time]));
        const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'lixi_' + this.currentRoom.code + '.csv'; a.click();
        this.showToast('\u0110\u00e3 xuất CSV!'); Sound.play('click');
    },
    async renderPersonalStats() {
        if (!this.currentUser) return;
        const hist = await Storage.getUserHistory(this.currentUser.uid);
        const joined = Storage.ensureArray(hist.joined);
        let totalWins = 0, totalValue = 0, bestPrize = null, bestValue = 0;
        joined.forEach(rj => { const w = rj.wins || []; totalWins += w.length; w.forEach(win => { const v = win.value || 0; totalValue += v; if (v > bestValue) { bestValue = v; bestPrize = win.prizeName; } }); });
        document.getElementById('ps-rooms').textContent = joined.length;
        document.getElementById('ps-wins').textContent = totalWins;
        document.getElementById('ps-total').textContent = this.formatMoney(totalValue);
        document.getElementById('ps-best').textContent = bestPrize ? bestPrize + ' (' + this.formatMoney(bestValue) + ')' : 'Chưa có dữ liệu';
    },

    // ==================== SETTINGS ====================
    populateSettings(r) {
        if (!r) return;
        const nameInput = document.getElementById('settings-room-name');
        const turnsInput = document.getElementById('settings-max-turns');
        if (nameInput) nameInput.value = r.name || '';
        if (turnsInput) turnsInput.value = r.maxTurns || 1;
        const rpToggle = document.getElementById('settings-remove-prize');
        if (rpToggle) rpToggle.checked = !!r.removePrizeOnWin;
        const greetInput = document.getElementById('settings-greeting');
        if (greetInput) greetInput.value = r.greeting || '';
        const timerInput = document.getElementById('settings-timer');
        if (timerInput) timerInput.value = r.timerHours || 0;
        document.querySelectorAll('#tab-settings .mode-card').forEach(c => c.classList.remove('selected'));
        const modeEl = document.getElementById('settings-mode-' + (r.mode || 'wheel'));
        if (modeEl) modeEl.classList.add('selected');
        this.settingsPrizes = (r.prizes || []).map(p => ({ name: p.name, weight: p.weight, value: p.value || 0 }));
        this.renderPrizeList(this.settingsPrizes, 'settings-prize-list', 'settingsPrizes');
    },
    selectSettingsMode(m) {
        document.querySelectorAll('#tab-settings .mode-card').forEach(c => c.classList.remove('selected'));
        const el = document.getElementById('settings-mode-' + m);
        if (el) el.classList.add('selected');
        Sound.play('click');
    },
    addSettingsPrize() { this.settingsPrizes.push({ name: 'Giải mới', weight: 10, value: 0 }); this.renderPrizeList(this.settingsPrizes, 'settings-prize-list', 'settingsPrizes'); Sound.play('click'); },
    removeSettingsPrize(i) { if (this.settingsPrizes.length <= 2) { this.showToast('Cần ít nhất 2 giải', 'error'); Sound.play('error'); return; } this.settingsPrizes.splice(i, 1); this.renderPrizeList(this.settingsPrizes, 'settings-prize-list', 'settingsPrizes'); Sound.play('click'); },
    equalSettingsPrizes() { const n = this.settingsPrizes.length; const w = parseFloat((100 / n).toFixed(2)); this.settingsPrizes.forEach(p => { p.weight = w; }); this.renderPrizeList(this.settingsPrizes, 'settings-prize-list', 'settingsPrizes'); this.showToast('Đã chia đều: ' + w + '% mỗi giải'); Sound.play('click'); },
    async saveSettings() {
        if (!this.currentRoom) return;
        const name = document.getElementById('settings-room-name').value.trim();
        if (!name) { this.showToast('Vui lòng nhập tên phòng', 'error'); Sound.play('error'); return; }
        // Read prizes from settings prize list
        const prizes = [];
        document.querySelectorAll('#settings-prize-list .prize-item').forEach(item => {
            const inp = item.querySelectorAll('.input-field');
            const pn = inp[0].value.trim(), pw = parseFloat(inp[1].value) || 10;
            if (pn) { const m = pn.replace(/[,\.]/g, '').match(/(\d+)/); prizes.push({ name: pn, weight: pw, value: m ? parseInt(m[1]) : 0 }); }
        });
        if (prizes.length < 2) { this.showToast('Cần ít nhất 2 giải', 'error'); Sound.play('error'); return; }
        const mt = parseInt(document.getElementById('settings-max-turns').value) || 1;
        // Determine selected mode
        const modeEl = document.querySelector('#tab-settings .mode-card.selected');
        const mode = modeEl && modeEl.id === 'settings-mode-envelope' ? 'envelope' : modeEl && modeEl.id === 'settings-mode-scratch' ? 'scratch' : 'wheel';
        // Update room
        this.currentRoom.name = name;
        this.currentRoom.mode = mode;
        this.currentRoom.prizes = prizes;
        this.currentRoom.maxTurns = mt;
        this.currentRoom.removePrizeOnWin = document.getElementById('settings-remove-prize').checked;
        this.currentRoom.greeting = (document.getElementById('settings-greeting').value || '').trim();
        this.currentRoom.timerHours = parseInt(document.getElementById('settings-timer').value) || 0;
        await Storage.saveRoom(this.currentRoom.code, this.currentRoom);
        document.getElementById('dashboard-room-name').textContent = name;
        this.showToast('Đã lưu thay đổi thành công! ✅');
        Sound.play('win');
    },

    // ==================== PLAYER ====================
    async joinRoom() {
        const name = document.getElementById('player-name').value.trim(), code = document.getElementById('player-room-code').value.replace(/\D/g, '').trim();
        if (!name) { this.showToast('Vui lòng nhập tên', 'error'); Sound.play('error'); return; }
        if (!code || code.length !== 6) { this.showToast('Mã phòng phải có 6 số', 'error'); Sound.play('error'); return; }
        this.showToast('Đang tìm phòng...');
        const r = await Storage.getRoom(code); if (!r) { this.showToast('Không tìm thấy phòng!', 'error'); Sound.play('error'); return; }
        if (!r.isOpen) { this.showToast('Phòng đã khoá', 'error'); Sound.play('error'); return; }
        if (this.isRoomExpired(r)) { this.showToast('Phòng đã hết hạn!', 'error'); Sound.play('error'); return; }
        if (!r.players.find(p => p.name === name)) { r.players.push({ name, joinedAt: new Date().toISOString(), uid: this.currentUser ? this.currentUser.uid : null }); await Storage.saveRoom(code, r); }
        const tu = r.history.filter(h => h.playerName === name).length; if (tu >= r.maxTurns) { this.showToast('Bạn đã hết lượt!', 'error'); Sound.play('error'); return; }
        this.currentRoom = r; this.currentPlayer = name;
        // Remember player name for next visit
        localStorage.setItem('lixi-last-name', name);
        if (this.currentUser) await Storage.saveJoinedRoom(this.currentUser.uid, code, r.name, name);
        if (r.mode === 'wheel') this.startWheelGame(); else if (r.mode === 'scratch') this.startScratchGame(); else this.startEnvelopeGame();
    },

    // ==================== GAMES ====================
    startWheelGame() {
        document.getElementById('wheel-player-name').textContent = this.currentPlayer;
        const tu = (this.currentRoom.history || []).filter(h => h.playerName === this.currentPlayer).length;
        document.getElementById('wheel-turns-left').innerHTML = 'Bạn còn <strong>' + (this.currentRoom.maxTurns - tu) + '</strong> lượt';
        document.getElementById('spinBtn').disabled = false; document.getElementById('wheelCenterBtn').style.pointerEvents = 'auto';
        Wheel.init(this.currentRoom.prizes); this.showScreen('screen-game-wheel');
    },
    async spinWheel() {
        if (Wheel.spinning) return; const r = await Storage.getRoom(this.currentRoom.code); if (!r) { this.showToast('Phòng không tồn tại'); return; }
        this.currentRoom = r;
        if (!r.prizes || r.prizes.length === 0) { this.showToast('Đã hết giải thưởng!', 'error'); Sound.play('error'); return; }
        const tu = r.history.filter(h => h.playerName === this.currentPlayer).length; if (tu >= r.maxTurns) { this.showToast('Hết lượt!', 'error'); Sound.play('error'); return; }
        document.getElementById('spinBtn').disabled = true; document.getElementById('wheelCenterBtn').style.pointerEvents = 'none';
        Wheel.spin(p => this.handlePrizeWon(p));
    },
    startEnvelopeGame() {
        document.getElementById('envelope-player-name').textContent = this.currentPlayer;
        const tu = (this.currentRoom.history || []).filter(h => h.playerName === this.currentPlayer).length;
        document.getElementById('envelope-turns-left').innerHTML = 'Bạn còn <strong>' + (this.currentRoom.maxTurns - tu) + '</strong> lượt';
        this.renderEnvelopes(); this.showScreen('screen-game-envelope');
    },
    renderEnvelopes() {
        const g = document.getElementById('envelope-grid'); g.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const e = document.createElement('div'); e.className = 'envelope'; e.id = 'envelope-' + i;
            e.innerHTML = '<div class="envelope-inner"><div class="envelope-front"><div class="envelope-border-deco"></div><span class="envelope-text">LÌ XÌ</span></div><div class="envelope-back"><div class="prize-amount" id="env-prize-' + i + '">?</div><div class="prize-label">Phần thưởng</div></div></div>';
            e.addEventListener('click', () => this.openEnvelope(i)); g.appendChild(e);
        }
    },
    async openEnvelope(idx) {
        const env = document.getElementById('envelope-' + idx); if (env.classList.contains('flipped') || env.classList.contains('disabled')) return;
        const r = await Storage.getRoom(this.currentRoom.code); if (!r) { this.showToast('Phòng không tồn tại', 'error'); return; }
        this.currentRoom = r;
        if (!r.prizes || r.prizes.length === 0) { this.showToast('Đã hết giải thưởng!', 'error'); Sound.play('error'); return; }
        const tu = r.history.filter(h => h.playerName === this.currentPlayer).length; if (tu >= r.maxTurns) { this.showToast('Hết lượt!', 'error'); Sound.play('error'); return; }
        const prize = r.prizes[this.getWeightedRandom(r.prizes)]; document.getElementById('env-prize-' + idx).textContent = prize.name;
        document.querySelectorAll('.envelope').forEach(e => { if (e.id !== 'envelope-' + idx) e.classList.add('disabled'); });
        Sound.play('flip'); env.classList.add('flipped'); setTimeout(() => this.handlePrizeWon(prize), 1200);
    },
    startScratchGame() {
        ScratchCard.reset();
        document.getElementById('scratch-player-name').textContent = this.currentPlayer;
        const tu = (this.currentRoom.history || []).filter(h => h.playerName === this.currentPlayer).length;
        document.getElementById('scratch-turns-left').innerHTML = 'Bạn còn <strong>' + (this.currentRoom.maxTurns - tu) + '</strong> lượt';
        this.showScreen('screen-game-scratch');
        this.playScratch();
    },
    async playScratch() {
        const r = await Storage.getRoom(this.currentRoom.code); if (!r) { this.showToast('Phòng không tồn tại', 'error'); return; }
        this.currentRoom = r;
        if (!r.prizes || r.prizes.length === 0) { this.showToast('Đã hết giải thưởng!', 'error'); Sound.play('error'); return; }
        const tu = r.history.filter(h => h.playerName === this.currentPlayer).length; if (tu >= r.maxTurns) { this.showToast('Hết lượt!', 'error'); Sound.play('error'); return; }
        const prize = r.prizes[this.getWeightedRandom(r.prizes)];
        ScratchCard.init(prize);
    },

    async handlePrizeWon(prize) {
        const r = await Storage.getRoom(this.currentRoom.code); if (!r) return; r.history = r.history || [];
        r.history.push({ playerName: this.currentPlayer, prizeName: prize.name, value: prize.value === -1 ? 0 : (prize.value || 0), time: new Date().toISOString(), uid: this.currentUser ? this.currentUser.uid : null });
        // Extra turn prize: increment maxTurns so the player can actually play again
        if (prize.value === -1) r.maxTurns = (r.maxTurns || 1) + 1;
        // Remove prize from pool if enabled
        if (r.removePrizeOnWin) {
            const pi = r.prizes.findIndex(p => p.name === prize.name);
            if (pi !== -1) r.prizes.splice(pi, 1);
        }
        await Storage.saveRoom(r.code, r); this.currentRoom = r;
        if (this.currentUser) await Storage.saveWin(this.currentUser.uid, r.code, r.name, this.currentPlayer, prize.name, prize.value === -1 ? 0 : (prize.value || 0));
        const $ = id => document.getElementById(id), big = (prize.value || 0) >= 100000, luck = prize.value === 0 && prize.name.toLowerCase().includes('may man'), extra = prize.value === -1;
        if (luck) { $('result-emoji').textContent = '🍀'; $('result-title').textContent = 'Chúc may mắn!'; $('result-prize').textContent = prize.name; $('result-message').textContent = 'Lần sau sẽ may mắn hơn!'; }
        else if (extra) { $('result-emoji').textContent = '🎁'; $('result-title').textContent = 'Tuyệt vời!'; $('result-prize').textContent = 'Thêm 1 lượt!'; $('result-message').textContent = 'Bạn được thưởng thêm 1 lượt chơi'; }
        else if (big) { $('result-emoji').textContent = '🎆'; $('result-title').textContent = 'JACKPOT!'; $('result-prize').textContent = prize.name; $('result-message').textContent = 'Chúc mừng ' + this.currentPlayer + '! Trúng giải lớn!'; }
        else { $('result-emoji').textContent = '🎉'; $('result-title').textContent = 'Chúc mừng!'; $('result-prize').textContent = prize.name; $('result-message').textContent = this.currentPlayer + ' đã nhận được lì xì!'; }
        const tl = r.maxTurns - r.history.filter(h => h.playerName === this.currentPlayer).length, btn = $('btn-play-again');
        const noPrizes = r.removePrizeOnWin && (!r.prizes || r.prizes.length === 0);
        if ((tl > 0 || extra) && !noPrizes) { btn.style.display = 'inline-flex'; btn.textContent = '🔄 Chơi tiếp (còn ' + tl + ' lượt)'; } else btn.style.display = 'none';
        if (noPrizes) { this.showToast('🎯 Phòng đã hết giải thưởng!'); }
        const greetEl = $('result-greeting');
        if (r.greeting) { greetEl.textContent = r.greeting; greetEl.style.display = 'block'; } else { greetEl.style.display = 'none'; }
        // Show bank info section for monetary prizes
        const bankSection = $('bank-info-section');
        if ((prize.value || 0) > 0) { bankSection.style.display = 'block'; this.updateBankHint(); } else { bankSection.style.display = 'none'; }
        this.showScreen('screen-result');
        if (big) { Sound.play('bigwin'); Confetti.launch(5000); } else if (!luck) { Sound.play('win'); Confetti.launch(3000); } else Sound.play('click');
    },
    async playAgain() { const r = await Storage.getRoom(this.currentRoom.code); if (!r) { this.showToast('Phòng không còn tồn tại'); this.showScreen('screen-home'); return; } this.currentRoom = r; if (r.mode === 'wheel') this.startWheelGame(); else if (r.mode === 'scratch') this.startScratchGame(); else this.startEnvelopeGame(); },
    leaveGame() { ScratchCard.reset(); this.currentPlayer = null; this.currentRoom = null; State.clear(); this.showScreen('screen-home'); },
    updateBankHint() {
        const hint = document.getElementById('bank-info-hint');
        if (!hint) return;
        const bn = (document.getElementById('bank-name') || {}).value || '';
        const ba = (document.getElementById('bank-account') || {}).value || '';
        const bh = (document.getElementById('bank-holder') || {}).value || '';
        const hasQR = !!this._uploadedQR;
        const hasAllText = bn.trim() && ba.trim() && bh.trim();
        const opts = hint.querySelectorAll('.bank-hint-option');
        if (hasQR) {
            opts[0].classList.remove('done'); opts[1].classList.add('done');
        } else if (hasAllText) {
            opts[0].classList.add('done'); opts[1].classList.remove('done');
        } else {
            opts[0].classList.remove('done'); opts[1].classList.remove('done');
        }
    },
    async sendBankInfo() {
        if (!this.currentPlayer) return;
        const bn = document.getElementById('bank-name').value.trim();
        const ba = document.getElementById('bank-account').value.trim();
        const bh = document.getElementById('bank-holder').value.trim();
        const hasQR = !!this._uploadedQR;
        const hasAllText = bn && ba && bh;
        if (!hasQR && !hasAllText) {
            this.showToast('Vui lòng điền đủ 3 thông tin hoặc thêm ảnh QR', 'error'); Sound.play('error'); return;
        }

        const data = {
            playerName: this.currentPlayer,
            bankName: bn,
            bankAccount: ba,
            bankHolder: bh,
            qrImage: this._uploadedQR || null,
            time: new Date().toISOString()
        };

        try {
            const roomRef = db.ref('rooms/' + this.currentRoom.code + '/bankInfos');
            await roomRef.push().set(data);
            this.showToast('Đã gửi thông tin chuyển khoản! ✅', 'success'); Sound.play('win');
            document.getElementById('bank-info-section').style.display = 'none';
            this._uploadedQR = null;
            document.getElementById('bank-qr-upload').value = '';
            document.getElementById('qr-preview-wrapper').style.display = 'none';
            document.getElementById('qr-upload-label').style.display = 'flex';
            this.updateBankHint();
        } catch (e) { this.showToast('Gửi lỗi, vui lòng thử lại', 'error'); }
        document.getElementById('bank-name').value = '';
        document.getElementById('bank-account').value = '';
        document.getElementById('bank-holder').value = '';
    },
    handleQRUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            this._uploadedQR = event.target.result;
            const preview = document.getElementById('qr-preview-img');
            preview.src = this._uploadedQR;
            document.getElementById('qr-preview-wrapper').style.display = 'block';
            document.getElementById('qr-upload-label').style.display = 'none';
            this.updateBankHint();
        };
        reader.readAsDataURL(file);
    },
    showPaymentDetail(playerName) {
        if (!this.currentRoom || !this.currentRoom.bankInfos) return;
        const info = Object.values(this.currentRoom.bankInfos).find(b => b.playerName === playerName);
        if (!info) { this.showToast('Không tìm thấy thông tin'); return; }
        const details = `
            <div style="text-align:left;padding:15px;background:rgba(0,0,0,0.2);border-radius:12px;border:1px solid var(--border-glow);margin-bottom:15px">
                <div style="margin-bottom:8px">🏦 <strong>Ngân hàng:</strong> ${this.esc(info.bankName)}</div>
                <div style="margin-bottom:8px">💳 <strong>STK:</strong> ${this.esc(info.bankAccount)}</div>
                <div style="margin-bottom:8px">👤 <strong>Chủ TK:</strong> ${this.esc(info.bankHolder)}</div>
            </div>
            ${info.qrImage ? `<img src="${info.qrImage}" style="width:100%;border-radius:12px;border:2px solid var(--gold-400);box-shadow:var(--shadow-gold)" onclick="App.showFullQR('${info.qrImage}')">` : '<p class="text-muted">Không có ảnh QR</p>'}
        `;
        const modal = document.getElementById('qr-view-modal');
        modal.querySelector('.qr-view-container').innerHTML = details;
        modal.classList.add('active');
        Sound.play('click');
    },
    showFullQR(src) {
        const modal = document.getElementById('qr-view-modal');
        modal.querySelector('.qr-view-container').innerHTML = `<img src="${src}" style="width:100%;border-radius:12px;border:2px solid var(--gold-400);box-shadow:var(--shadow-gold)">`;
        modal.classList.add('active');
        Sound.play('click');
    },
    async renderHistoryScreen() {
        if (!this.currentUser) return; const hist = await Storage.getUserHistory(this.currentUser.uid);
        hist.created = Storage.ensureArray(hist.created); hist.joined = Storage.ensureArray(hist.joined);
        const ml = document.getElementById('my-rooms-list'), me = document.getElementById('my-rooms-empty');
        if (!hist.created.length) { ml.innerHTML = ''; ml.appendChild(me); me.style.display = 'block'; }
        else {
            ml.innerHTML = ''; for (const rc of hist.created) {
                const r = await Storage.getRoom(rc.code), card = document.createElement('div'); card.className = 'history-room-card';
                if (r) { const pc = (r.history || []).length, plc = (r.players || []).length, tm = (r.history || []).reduce((s, h) => s + (h.value > 0 ? h.value : 0), 0); card.innerHTML = '<div class="history-room-header"><span class="history-room-name">' + this.esc(r.name) + '</span><span class="history-room-code">#' + r.code + '</span></div><div class="history-room-meta"><span>👥 ' + plc + '</span><span>🎰 ' + pc + '</span><span>💰 ' + this.formatMoney(tm) + '</span></div>'; card.addEventListener('click', () => { this.currentRoom = r; this.showDashboard(); }); }
                else { card.innerHTML = '<div class="history-room-header"><span class="history-room-name">' + this.esc(rc.name) + '</span><span class="history-room-code">#' + rc.code + '</span></div><div class="history-room-meta"><span class="text-muted">Phòng đã xoá</span></div>'; card.style.opacity = '0.5'; card.style.cursor = 'default'; }
                ml.appendChild(card);
            }
        }
        const jl = document.getElementById('joined-rooms-list'), je = document.getElementById('joined-rooms-empty');
        if (!hist.joined.length) { jl.innerHTML = ''; jl.appendChild(je); je.style.display = 'block'; }
        else {
            jl.innerHTML = ''; for (const rj of hist.joined) {
                const r = await Storage.getRoom(rj.code);
                let myWins = rj.wins || [];
                if (myWins.length === 0 && r) {
                    const h = r.history || [];
                    myWins = h.filter(x => x.playerName === rj.playerName).reverse().map(x => ({ prizeName: x.prizeName, time: x.time, value: x.value }));
                }
                const tm = myWins.reduce((s, h) => s + (h.value > 0 ? h.value : 0), 0);
                const list = myWins.map(m => {
                    const t = new Date(m.time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    return '<div style="font-size:0.85rem;margin-top:4px;border-top:1px solid rgba(251,191,36,0.1);padding-top:4px;display:flex;justify-content:space-between"><span style="color:var(--gold-300)">' + this.esc(m.prizeName) + '</span><span style="color:var(--text-muted);font-size:0.75rem">' + t + '</span></div>';
                }).join('');
                const roomName = (r ? r.name : rj.name) || 'Phòng';
                const status = r ? '' : ' <span class="text-muted" style="font-size:0.8em">(Đã xoá)</span>';
                const card = document.createElement('div'); card.className = 'history-room-card';
                card.innerHTML = '<div class="history-room-header"><span class="history-room-name">' + this.esc(roomName) + status + '</span><span class="history-room-code">#' + rj.code + '</span></div>' +
                    '<div class="history-room-meta"><span>👤 ' + this.esc(rj.playerName) + '</span><span>🎰 ' + myWins.length + ' lượt</span><span>💰 ' + this.formatMoney(tm) + '</span></div>' +
                    (list ? '<div style="margin-top:8px">' + list + '</div>' : '');
                jl.appendChild(card);
            }
        }
    },

    // ==================== UTILS ====================
    getWeightedRandom(p) { const t = p.reduce((s, x) => s + (x.weight || 1), 0); let r = Math.random() * t; for (let i = 0; i < p.length; i++) { r -= (p[i].weight || 1); if (r <= 0) return i; } return p.length - 1; },
    formatMoney(a) { if (a >= 1000000) return (a / 1000000).toFixed(1) + 'tr'; if (a >= 1000) return Math.floor(a / 1000) + 'k'; return a + 'd'; },
    esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
};

document.addEventListener('DOMContentLoaded', () => App.init());
