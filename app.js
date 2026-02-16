/* ============================================
   LI XI MAY MAN - Application Logic v4
   Firebase Auth + Realtime Database
   All events via addEventListener
   ============================================ */

const Storage = {
    roomRef(code) { return db.ref('rooms/' + code); },
    userRef(uid) { return db.ref('users/' + uid); },
    async getRoom(code) {
        try { const s = await this.roomRef(code).once('value'); const d = s.val(); if (!d) return null; d.players = d.players || []; d.history = d.history || []; return d; } catch (e) { return null; }
    },
    async saveRoom(code, room) { try { await this.roomRef(code).set(room); } catch (e) { console.error(e); } },
    async deleteRoom(code) { try { await this.roomRef(code).remove(); } catch (e) { console.error(e); } },
    onRoomChange(code, cb) { this.roomRef(code).on('value', s => { const d = s.val(); if (d) { d.players = d.players || []; d.history = d.history || []; cb(d); } }); },
    offRoomChange(code) { this.roomRef(code).off('value'); },
    async getUserHistory(uid) { try { const s = await this.userRef(uid).child('history').once('value'); return s.val() || { created: [], joined: [] }; } catch (e) { return { created: [], joined: [] }; } },
    async saveCreatedRoom(uid, code, name) {
        try { const h = await this.getUserHistory(uid); if (!h.created.find(r => r.code === code)) { h.created.unshift({ code, name, time: new Date().toISOString() }); if (h.created.length > 30) h.created = h.created.slice(0, 30); await this.userRef(uid).child('history').set(h); } } catch (e) { console.error(e); }
    },
    async saveJoinedRoom(uid, code, name, playerName) {
        try { const h = await this.getUserHistory(uid); if (!h.joined.find(r => r.code === code && r.playerName === playerName)) { h.joined.unshift({ code, name, playerName, time: new Date().toISOString() }); if (h.joined.length > 50) h.joined = h.joined.slice(0, 50); await this.userRef(uid).child('history').set(h); } } catch (e) { console.error(e); }
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

const App = {
    currentRoom: null, currentPlayer: null, currentUser: null, selectedMode: 'wheel', dashboardListener: null,
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

        // Password live check
        const pwInput = $('register-password');
        if (pwInput) pwInput.addEventListener('input', () => this.checkPasswordLive(pwInput.value));

        // Home
        on('btn-role-host', () => this.showScreen('screen-host-create'));
        on('btn-role-player', () => this.showScreen('screen-player-join'));
        on('btn-history', () => this.showScreen('screen-history'));

        // History
        on('back-history', () => this.showScreen('screen-home'));
        on('htab-btn-created', () => this.switchHistoryTab('htab-my-rooms', $('htab-btn-created')));
        on('htab-btn-joined', () => this.switchHistoryTab('htab-joined', $('htab-btn-joined')));

        // Host create
        on('back-host-create', () => this.showScreen('screen-home'));
        on('mode-wheel', () => this.selectMode('wheel'));
        on('mode-envelope', () => this.selectMode('envelope'));
        on('btn-add-prize', () => this.addPrize());
        on('btn-equal-prize', () => this.equalPrizes());
        on('btn-create-room', () => this.createRoom());

        // Dashboard
        on('btn-copy-code', () => this.copyRoomCode());
        on('dtab-btn-players', () => this.switchTab('tab-players', $('dtab-btn-players')));
        on('dtab-btn-history', () => this.switchTab('tab-history', $('dtab-btn-history')));
        on('dtab-btn-settings', () => this.switchTab('tab-settings', $('dtab-btn-settings')));
        on('btn-toggle-room', () => this.toggleRoom());
        on('btn-reset-room', () => this.resetRoom());
        on('btn-delete-room', () => this.deleteRoom());
        on('btn-dashboard-home', () => this.showScreen('screen-home'));

        // Player join
        on('back-player-join', () => this.showScreen('screen-home'));
        on('btn-join-room', () => this.joinRoom());

        // Games
        on('back-wheel', () => this.leaveGame());
        on('back-envelope', () => this.leaveGame());
        on('spinBtn', () => this.spinWheel());
        on('wheelCenterBtn', () => this.spinWheel());
        on('btn-play-again', () => this.playAgain());
        on('btn-leave-result', () => this.leaveGame());
    },

    // ==================== AUTH ====================
    initAuth() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user; this.updateUserBar(user);
                const state = State.load();
                if (state && state.screen && state.screen !== 'screen-auth') await this.restoreState(state);
                else this.showScreen('screen-home', true);
            } else {
                this.currentUser = null; this.currentRoom = null; this.currentPlayer = null;
                State.clear(); this.showScreen('screen-auth', true);
            }
        });
    },

    updateUserBar(user) {
        const n = document.getElementById('user-display-name');
        const e = document.getElementById('user-email-display');
        const a = document.getElementById('user-avatar');
        n.textContent = user.displayName || user.email.split('@')[0];
        e.textContent = user.email;
        if (user.photoURL) { a.innerHTML = '<img src="' + user.photoURL + '" alt="Avatar">'; }
        else { a.textContent = (user.displayName || user.email)[0].toUpperCase(); a.style.fontSize = '1.2rem'; a.style.fontWeight = '800'; a.style.color = '#1a0505'; }
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
            el.style.color = c.ok ? '#22c55e' : '#ef4444';
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
        if (!email || !pw) { this.showToast('Vui lòng nhập email và mật khẩu'); Sound.play('error'); return; }
        const btn = document.getElementById('btn-login');
        btn.disabled = true; btn.textContent = '⏳ Đang đăng nhập...';
        try { await auth.signInWithEmailAndPassword(email, pw); Sound.play('win'); }
        catch (e) { this.showToast(this.getAuthErrorMessage(e.code)); Sound.play('error'); }
        finally { btn.disabled = false; btn.textContent = '🔑 Đăng nhập'; }
    },

    async registerEmail() {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const pw = document.getElementById('register-password').value;
        if (!name) { this.showToast('Vui lòng nhập tên'); Sound.play('error'); return; }
        if (!email) { this.showToast('Vui lòng nhập email'); Sound.play('error'); return; }
        if (!pw) { this.showToast('Vui lòng nhập mật khẩu'); Sound.play('error'); return; }
        const err = this.validatePassword(pw);
        if (err) { this.showToast(err); Sound.play('error'); return; }
        const btn = document.getElementById('btn-register');
        btn.disabled = true; btn.textContent = '⏳ Đang tạo tài khoản...';
        try { const c = await auth.createUserWithEmailAndPassword(email, pw); await c.user.updateProfile({ displayName: name }); Sound.play('bigwin'); this.showToast('Chào mừng ' + name + '! 🎉'); }
        catch (e) { this.showToast(this.getAuthErrorMessage(e.code)); Sound.play('error'); }
        finally { btn.disabled = false; btn.textContent = '📝 Tạo tài khoản'; }
    },

    async loginGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        const btn = document.getElementById('btn-google');
        btn.disabled = true;
        try { await auth.signInWithPopup(provider); Sound.play('win'); }
        catch (e) { if (e.code !== 'auth/popup-closed-by-user') { this.showToast(this.getAuthErrorMessage(e.code)); Sound.play('error'); } }
        finally { btn.disabled = false; }
    },

    async logout() {
        if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
        if (this.dashboardListener) { Storage.offRoomChange(this.dashboardListener); this.dashboardListener = null; }
        this.currentRoom = null; this.currentPlayer = null; State.clear();
        await auth.signOut(); this.showToast('Đã đăng xuất');
    },

    // ==================== STATE ====================
    async restoreState(state) {
        try {
            if (state.roomCode) { const r = await Storage.getRoom(state.roomCode); if (!r) { State.clear(); this.showScreen('screen-home', true); return; } this.currentRoom = r; }
            if (state.playerName) this.currentPlayer = state.playerName;
            if (state.screen === 'screen-host-dashboard' && this.currentRoom) this.showDashboard();
            else if (state.screen === 'screen-game-wheel' && this.currentRoom && this.currentPlayer) this.startWheelGame();
            else if (state.screen === 'screen-game-envelope' && this.currentRoom && this.currentPlayer) this.startEnvelopeGame();
            else this.showScreen(state.screen, true);
        } catch (e) { State.clear(); this.showScreen('screen-home', true); }
    },
    persistState(s) { State.save({ screen: s, roomCode: this.currentRoom ? this.currentRoom.code : null, playerName: this.currentPlayer }); },

    // ==================== UI ====================
    createBgParticles() { const c = document.getElementById('bgParticles'), cols = ['#fbbf2440', '#e0313140', '#ffd70030', '#ff4d4d30']; for (let i = 0; i < 20; i++) { const p = document.createElement('div'); p.className = 'particle'; const s = Math.random() * 6 + 2; p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + Math.random() * 100 + '%;background:' + cols[Math.floor(Math.random() * cols.length)] + ';animation-duration:' + (8 + Math.random() * 12) + 's;animation-delay:' + Math.random() * 10 + 's;'; c.appendChild(p); } },
    createWheelSparkles() { const c = document.getElementById('wheel-sparkles'); if (!c) return; for (let i = 0; i < 12; i++) { const s = document.createElement('div'); s.className = 'wheel-sparkle'; const a = (i / 12) * 360, d = 48 + Math.random() * 5; s.style.cssText = 'top:' + (50 + d * Math.sin(a * Math.PI / 180)) + '%;left:' + (50 + d * Math.cos(a * Math.PI / 180)) + '%;animation-delay:' + (i / 12) * 2 + 's;'; c.appendChild(s); } },
    initMusic() { const m = document.getElementById('bgMusic'), b = document.getElementById('musicToggle'); let p = false; b.addEventListener('click', () => { Sound.init(); if (p) { m.pause(); b.textContent = '🔇'; b.classList.remove('playing'); } else { m.play().catch(() => { }); b.textContent = '🎵'; b.classList.add('playing'); } p = !p; }); },

    showScreen(id, skip) {
        if (!this.currentUser && id !== 'screen-auth') return;
        if (this.dashboardListener && id !== 'screen-host-dashboard') { Storage.offRoomChange(this.dashboardListener); this.dashboardListener = null; }
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const t = document.getElementById(id); if (t) { t.classList.add('active'); t.style.animation = 'none'; t.offsetHeight; t.style.animation = ''; }
        if (!skip) this.persistState(id);
        if (id === 'screen-home') { this.currentRoom = null; this.currentPlayer = null; State.clear(); }
        if (id === 'screen-history') this.renderHistoryScreen();
        if (id === 'screen-player-join' && this.currentUser) { const ni = document.getElementById('player-name'); if (!ni.value) ni.value = this.currentUser.displayName || ''; }
        Sound.play('click');
    },
    showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._toastTimer); this._toastTimer = setTimeout(() => t.classList.remove('show'), 5000); },

    // ==================== MODE / PRIZE ====================
    selectMode(m) { this.selectedMode = m; document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected')); document.getElementById('mode-' + m).classList.add('selected'); Sound.play('click'); },
    renderPrizeList(prizes) {
        const c = document.getElementById('prize-list'); c.innerHTML = '';
        prizes.forEach((p, i) => {
            const item = document.createElement('div'); item.className = 'prize-item';
            const n = document.createElement('input'); n.className = 'input-field'; n.type = 'text'; n.value = p.name; n.placeholder = 'Tên giải'; n.addEventListener('change', () => { this.defaultPrizes[i].name = n.value; });
            const w = document.createElement('input'); w.className = 'input-field'; w.type = 'number'; w.value = p.weight; w.min = '0.01'; w.max = '100'; w.step = 'any'; w.placeholder = '%'; w.addEventListener('change', () => { this.defaultPrizes[i].weight = parseFloat(w.value) || 1; });
            const d = document.createElement('button'); d.className = 'btn btn-icon'; d.textContent = '✕'; d.title = 'Xoá'; d.addEventListener('click', () => this.removePrize(i));
            item.appendChild(n); item.appendChild(w); item.appendChild(d); c.appendChild(item);
        });
    },
    addPrize() { this.defaultPrizes.push({ name: 'Giải mới', weight: 10, value: 0 }); this.renderPrizeList(this.defaultPrizes); Sound.play('click'); },
    removePrize(i) { if (this.defaultPrizes.length <= 2) { this.showToast('Cần ít nhất 2 giải'); Sound.play('error'); return; } this.defaultPrizes.splice(i, 1); this.renderPrizeList(this.defaultPrizes); Sound.play('click'); },
    equalPrizes() { const n = this.defaultPrizes.length; const w = parseFloat((100 / n).toFixed(2)); this.defaultPrizes.forEach(p => { p.weight = w; }); this.renderPrizeList(this.defaultPrizes); this.showToast('Đã chia đều: ' + w + '% mỗi giải'); Sound.play('click'); },

    // ==================== CREATE ROOM ====================
    async createRoom() {
        const name = document.getElementById('host-room-name').value.trim();
        if (!name) { this.showToast('Vui lòng nhập tên phòng'); Sound.play('error'); return; }
        const prizes = [];
        document.querySelectorAll('.prize-item').forEach(item => { const inp = item.querySelectorAll('.input-field'); const pn = inp[0].value.trim(), pw = parseInt(inp[1].value) || 10; if (pn) { const m = pn.replace(/[,\.]/g, '').match(/(\d+)/); prizes.push({ name: pn, weight: pw, value: m ? parseInt(m[1]) : 0 }); } });
        if (prizes.length < 2) { this.showToast('Cần ít nhất 2 giải'); Sound.play('error'); return; }
        const mt = parseInt(document.getElementById('host-max-turns').value) || 1;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const room = { code, name, mode: this.selectedMode, prizes, maxTurns: mt, isOpen: true, players: [], history: [], createdAt: new Date().toISOString(), ownerId: this.currentUser.uid };
        this.showToast('Đang tạo phòng...');
        await Storage.saveRoom(code, room); await Storage.saveCreatedRoom(this.currentUser.uid, code, name);
        this.currentRoom = room; Sound.play('win'); this.showDashboard();
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
        document.getElementById('stat-players').textContent = pl.length;
        document.getElementById('stat-played').textContent = h.length;
        document.getElementById('stat-total').textContent = this.formatMoney(h.reduce((s, x) => s + (x.value > 0 ? x.value : 0), 0));
        const ptb = document.getElementById('players-tbody'), pe = document.getElementById('players-empty');
        if (!pl.length) { ptb.innerHTML = ''; pe.style.display = 'block'; }
        else { pe.style.display = 'none'; ptb.innerHTML = pl.map((p, i) => { const tu = h.filter(x => x.playerName === p.name).length, tl = r.maxTurns - tu; return '<tr><td>' + (i + 1) + '</td><td>' + this.esc(p.name) + '</td><td>' + tl + '/' + r.maxTurns + '</td><td>' + (tl > 0 ? '<span class="badge badge-green">Chưa hết</span>' : '<span class="badge badge-red">Hết lượt</span>') + '</td></tr>'; }).join(''); }
        const htb = document.getElementById('history-tbody'), he = document.getElementById('history-empty');
        if (!h.length) { htb.innerHTML = ''; he.style.display = 'block'; }
        else { he.style.display = 'none'; htb.innerHTML = h.slice().reverse().map(x => { const t = new Date(x.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); return '<tr><td>' + this.esc(x.playerName) + '</td><td><span class="badge ' + (x.value > 100000 ? 'badge-gold' : 'badge-green') + '">' + this.esc(x.prizeName) + '</span></td><td>' + t + '</td></tr>'; }).join(''); }
        this.updateRoomStatusUI(r);
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

    // ==================== PLAYER ====================
    async joinRoom() {
        const name = document.getElementById('player-name').value.trim(), code = document.getElementById('player-room-code').value.trim();
        if (!name) { this.showToast('Vui lòng nhập tên'); Sound.play('error'); return; }
        if (!code || code.length !== 6) { this.showToast('Mã phòng phải có 6 số'); Sound.play('error'); return; }
        this.showToast('Đang tìm phòng...');
        const r = await Storage.getRoom(code); if (!r) { this.showToast('Không tìm thấy phòng!'); Sound.play('error'); return; }
        if (!r.isOpen) { this.showToast('Phòng đã khoá'); Sound.play('error'); return; }
        if (!r.players.find(p => p.name === name)) { r.players.push({ name, joinedAt: new Date().toISOString(), uid: this.currentUser.uid }); await Storage.saveRoom(code, r); }
        const tu = r.history.filter(h => h.playerName === name).length; if (tu >= r.maxTurns) { this.showToast('Bạn đã hết lượt!'); Sound.play('error'); return; }
        this.currentRoom = r; this.currentPlayer = name;
        await Storage.saveJoinedRoom(this.currentUser.uid, code, r.name, name); Sound.play('win');
        if (r.mode === 'wheel') this.startWheelGame(); else this.startEnvelopeGame();
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
        this.currentRoom = r; const tu = r.history.filter(h => h.playerName === this.currentPlayer).length; if (tu >= r.maxTurns) { this.showToast('Hết lượt!'); Sound.play('error'); return; }
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
        const r = await Storage.getRoom(this.currentRoom.code); if (!r) { this.showToast('Phòng không tồn tại'); return; }
        this.currentRoom = r; const tu = r.history.filter(h => h.playerName === this.currentPlayer).length; if (tu >= r.maxTurns) { this.showToast('Hết lượt!'); Sound.play('error'); return; }
        const prize = r.prizes[this.getWeightedRandom(r.prizes)]; document.getElementById('env-prize-' + idx).textContent = prize.name;
        document.querySelectorAll('.envelope').forEach(e => { if (e.id !== 'envelope-' + idx) e.classList.add('disabled'); });
        Sound.play('flip'); env.classList.add('flipped'); setTimeout(() => this.handlePrizeWon(prize), 1200);
    },

    async handlePrizeWon(prize) {
        const r = await Storage.getRoom(this.currentRoom.code); if (!r) return; r.history = r.history || [];
        r.history.push({ playerName: this.currentPlayer, prizeName: prize.name, value: prize.value === -1 ? 0 : (prize.value || 0), time: new Date().toISOString(), uid: this.currentUser.uid });
        await Storage.saveRoom(r.code, r); this.currentRoom = r;
        const $ = id => document.getElementById(id), big = (prize.value || 0) >= 100000, luck = prize.value === 0 && prize.name.toLowerCase().includes('may man'), extra = prize.value === -1;
        if (luck) { $('result-emoji').textContent = '🍀'; $('result-title').textContent = 'Chúc may mắn!'; $('result-prize').textContent = prize.name; $('result-message').textContent = 'Lần sau sẽ may mắn hơn!'; }
        else if (extra) { $('result-emoji').textContent = '🎁'; $('result-title').textContent = 'Tuyệt vời!'; $('result-prize').textContent = 'Thêm 1 lượt!'; $('result-message').textContent = 'Bạn được thưởng thêm 1 lượt chơi'; }
        else if (big) { $('result-emoji').textContent = '🎆'; $('result-title').textContent = 'JACKPOT!'; $('result-prize').textContent = prize.name; $('result-message').textContent = 'Chúc mừng ' + this.currentPlayer + '! Trúng giải lớn!'; }
        else { $('result-emoji').textContent = '🎉'; $('result-title').textContent = 'Chúc mừng!'; $('result-prize').textContent = prize.name; $('result-message').textContent = this.currentPlayer + ' đã nhận được lì xì!'; }
        const tl = r.maxTurns - r.history.filter(h => h.playerName === this.currentPlayer).length, btn = $('btn-play-again');
        if (tl > 0 || extra) { btn.style.display = 'inline-flex'; btn.textContent = '🔄 Chơi tiếp (còn ' + (extra ? tl + 1 : tl) + ' lượt)'; } else btn.style.display = 'none';
        this.showScreen('screen-result');
        if (big) { Sound.play('bigwin'); Confetti.launch(5000); } else if (!luck) { Sound.play('win'); Confetti.launch(3000); } else Sound.play('click');
    },
    async playAgain() { const r = await Storage.getRoom(this.currentRoom.code); if (!r) { this.showToast('Phòng không còn tồn tại'); this.showScreen('screen-home'); return; } this.currentRoom = r; if (r.mode === 'wheel') this.startWheelGame(); else this.startEnvelopeGame(); },
    leaveGame() { this.currentPlayer = null; this.currentRoom = null; State.clear(); this.showScreen('screen-home'); },

    // ==================== HISTORY ====================
    switchHistoryTab(tabId, btn) {
        const p = btn.closest('.glass-card'); p.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        p.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active'); document.getElementById(tabId).classList.add('active'); Sound.play('click');
    },
    async renderHistoryScreen() {
        if (!this.currentUser) return; const hist = await Storage.getUserHistory(this.currentUser.uid);
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
                const r = await Storage.getRoom(rj.code), card = document.createElement('div'); card.className = 'history-room-card';
                if (r) { const my = (r.history || []).filter(h => h.playerName === rj.playerName), mt = my.reduce((s, h) => s + (h.value > 0 ? h.value : 0), 0); card.innerHTML = '<div class="history-room-header"><span class="history-room-name">' + this.esc(r.name) + '</span><span class="history-room-code">#' + r.code + '</span></div><div class="history-room-meta"><span>👤 ' + this.esc(rj.playerName) + '</span><span>🎰 ' + my.length + '</span><span>💰 ' + this.formatMoney(mt) + '</span></div>'; }
                else { card.innerHTML = '<div class="history-room-header"><span class="history-room-name">' + this.esc(rj.name || 'Phòng') + '</span><span class="history-room-code">#' + rj.code + '</span></div><div class="history-room-meta"><span class="text-muted">Phòng đã xoá</span></div>'; card.style.opacity = '0.5'; card.style.cursor = 'default'; }
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
