/**
 * The2nd - 모바일 버전 게임 로직
 * 터치/클릭 기반 발사, 세로 3영역 레이아웃
 * 스턴 게이지, GO 타이머, 타격감 강화
 */

// ============================================
// 게임 상수
// ============================================
const CONFIG = {
    INITIAL_HP: 100,
    CLEAN_SHOT_DAMAGE: 30,
    DIRTY_SHOT_DAMAGE_MIN: 10,
    DIRTY_SHOT_DAMAGE_MAX: 20,
    STUN_DURATION: 2000,
    GO_DURATION: 1000,
    COUNTDOWN_MIN: 500,
    COUNTDOWN_MAX: 5000,
    START_DELAY_MIN: 500,
    START_DELAY_MAX: 3000,
    ROUND_END_DELAY: 2000,
};

const GamePhase = {
    READY: 'ready',
    COUNTDOWN_3: 'countdown-3',
    COUNTDOWN_2: 'countdown-2',
    COUNTDOWN_1: 'countdown-1',
    GO: 'go',
    ROUND_END: 'round-end',
    GAME_OVER: 'game-over'
};

// ============================================
// 게임 상태
// ============================================
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.phase = GamePhase.READY;
        this.round = 1;
        this.players = {
            1: { hp: CONFIG.INITIAL_HP, stunned: false, shotFired: false, stunTimer: null, stunStartTime: null },
            2: { hp: CONFIG.INITIAL_HP, stunned: false, shotFired: false, stunTimer: null, stunStartTime: null }
        };
        this.countdownTimers = [];
        this.goTimer = null;
        this.goStartTime = null;
        this.goAnimationFrame = null;
        this.stunAnimationFrames = {};
    }

    resetRound() {
        this.phase = GamePhase.READY;
        this.players[1].shotFired = false;
        this.players[2].shotFired = false;
    }
}

// ============================================
// DOM 요소
// ============================================
const DOM = {
    container: document.querySelector('.game-container'),
    countdown: document.getElementById('countdown'),
    roundInfo: document.getElementById('round-info'),
    message: document.getElementById('game-message'),
    gameOver: document.getElementById('game-over'),
    winnerText: document.getElementById('winner-text'),
    winnerPlayer: document.getElementById('winner-player'),
    restartBtn: document.getElementById('restart-btn'),
    startBtn: document.getElementById('start-btn'),
    flash: document.getElementById('flash'),
    goTimerContainer: document.getElementById('go-timer-container'),
    goTimerProgress: document.getElementById('go-timer-progress'),
    players: {
        1: {
            section: document.querySelector('.my-section'),
            hp: document.getElementById('hp1'),
            hpText: document.getElementById('hp1-text'),
            stun: document.getElementById('stun1'),
            stunBar: document.getElementById('stun-bar1'),
            shot: document.getElementById('shot1'),
            damage: document.getElementById('damage1'),
            fireBtn: document.getElementById('fire-btn1')
        },
        2: {
            section: document.querySelector('.opponent-section'),
            hp: document.getElementById('hp2'),
            hpText: document.getElementById('hp2-text'),
            stun: document.getElementById('stun2'),
            stunBar: document.getElementById('stun-bar2'),
            shot: document.getElementById('shot2'),
            damage: document.getElementById('damage2'),
            fireBtn: document.getElementById('fire-btn2')
        }
    }
};

const game = new GameState();

// ============================================
// 유틸리티 함수
// ============================================
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomCountdownDelay() {
    return randomInt(CONFIG.COUNTDOWN_MIN, CONFIG.COUNTDOWN_MAX);
}

function getRandomStartDelay() {
    return randomInt(CONFIG.START_DELAY_MIN, CONFIG.START_DELAY_MAX);
}

// ============================================
// UI 업데이트 함수
// ============================================
function updateHP(playerNum) {
    const player = game.players[playerNum];
    const dom = DOM.players[playerNum];

    const hpPercent = Math.max(0, player.hp);
    dom.hp.style.width = `${hpPercent}%`;
    dom.hpText.textContent = hpPercent;

    if (hpPercent <= 30) {
        dom.hp.classList.add('low');
    } else {
        dom.hp.classList.remove('low');
    }
}

function updateCountdown(text, isGo = false) {
    DOM.countdown.textContent = text;
    DOM.countdown.classList.toggle('go', isGo);
}

function updateMessage(text, isDamage = false) {
    DOM.message.textContent = text;
    DOM.message.classList.toggle('damage', isDamage);
}

function updateFireButtons() {
    const allowFire = [GamePhase.COUNTDOWN_3, GamePhase.COUNTDOWN_2, GamePhase.COUNTDOWN_1, GamePhase.GO].includes(game.phase);

    [1, 2].forEach(pNum => {
        const player = game.players[pNum];
        const btn = DOM.players[pNum].fireBtn;

        btn.classList.remove('active', 'disabled');

        if (allowFire && !player.stunned && !player.shotFired) {
            btn.classList.add('active');
            btn.disabled = false;
        } else {
            btn.classList.add('disabled');
            btn.disabled = true;
        }
    });
}

function updateRoundInfo() {
    DOM.roundInfo.textContent = `ROUND ${game.round}`;
}

function updateStartButton() {
    if (game.phase === GamePhase.READY) {
        DOM.startBtn.disabled = false;
        DOM.startBtn.textContent = '🤠 결투 시작!';
    } else if (game.phase === GamePhase.ROUND_END) {
        DOM.startBtn.disabled = false;
        DOM.startBtn.textContent = '🔄 다음 라운드!';
    } else if (game.phase === GamePhase.GAME_OVER) {
        DOM.startBtn.disabled = true;
    } else {
        DOM.startBtn.disabled = true;
        DOM.startBtn.textContent = '⏳ 진행 중...';
    }
}

// ============================================
// 게임 로직
// ============================================
function applyDamage(targetPlayer, damage) {
    game.players[targetPlayer].hp = Math.max(0, game.players[targetPlayer].hp - damage);
    updateHP(targetPlayer);
}

function applyStun(playerNum) {
    const player = game.players[playerNum];

    if (player.stunTimer) {
        clearTimeout(player.stunTimer);
    }

    player.stunned = true;
    player.stunStartTime = Date.now();
    showStun(playerNum, true);
    animateStunBar(playerNum);
    updateFireButtons();

    player.stunTimer = setTimeout(() => {
        player.stunned = false;
        player.stunStartTime = null;
        showStun(playerNum, false);
        player.stunTimer = null;
        updateFireButtons();
    }, CONFIG.STUN_DURATION);
}

function handleShot(shooterNum) {
    const shooter = game.players[shooterNum];
    const targetNum = shooterNum === 1 ? 2 : 1;

    if (shooter.stunned || shooter.shotFired) {
        return;
    }

    if (game.phase === GamePhase.READY || game.phase === GamePhase.ROUND_END || game.phase === GamePhase.GAME_OVER) {
        return;
    }

    shooter.shotFired = true;
    updateFireButtons();

    if (game.phase === GamePhase.GO) {
        const damage = CONFIG.CLEAN_SHOT_DAMAGE;
        showShotEffect(shooterNum, 'clean', damage);
        applyDamage(targetNum, damage);
        applyStun(targetNum);
        updateMessage(`P${shooterNum}: 클린샷! 🤠 ${damage}!`, true);
        stopGoTimer();
    } else {
        const damage = randomInt(CONFIG.DIRTY_SHOT_DAMAGE_MIN, CONFIG.DIRTY_SHOT_DAMAGE_MAX);
        showShotEffect(shooterNum, 'dirty', damage);
        applyDamage(targetNum, damage);
        applyStun(targetNum);
        updateMessage(`P${shooterNum}: 더티샷! 🐀 ${damage}!`, true);
    }

    checkGameOver();

    if (game.players[1].shotFired && game.players[2].shotFired && game.phase !== GamePhase.GAME_OVER) {
        setTimeout(() => endRound(), 500);
    }
}

function checkGameOver() {
    const p1Dead = game.players[1].hp <= 0;
    const p2Dead = game.players[2].hp <= 0;

    if (p1Dead || p2Dead) {
        game.phase = GamePhase.GAME_OVER;
        clearAllTimers();
        stopGoTimer();
        updateFireButtons();
        updateStartButton();

        let winner;
        if (p1Dead && p2Dead) {
            winner = game.players[1].hp >= game.players[2].hp ? 1 : 2;
        } else {
            winner = p1Dead ? 2 : 1;
        }

        setTimeout(() => showGameOver(winner), 500);
    }
}

function clearAllTimers() {
    game.countdownTimers.forEach(timer => clearTimeout(timer));
    game.countdownTimers = [];

    if (game.goTimer) {
        clearTimeout(game.goTimer);
        game.goTimer = null;
    }
}

// ============================================
// 카운트다운
// ============================================
function startCountdown() {
    if (game.phase !== GamePhase.READY) return;

    updateMessage('결투 준비...');
    updateStartButton();

    const startDelay = getRandomStartDelay();

    game.countdownTimers.push(setTimeout(() => {
        game.phase = GamePhase.COUNTDOWN_3;
        updateCountdown('3');
        updateMessage('3...');
        updateFireButtons();
    }, startDelay));

    const delay2 = startDelay + getRandomCountdownDelay();
    game.countdownTimers.push(setTimeout(() => {
        if (game.phase !== GamePhase.GAME_OVER) {
            game.phase = GamePhase.COUNTDOWN_2;
            updateCountdown('2');
            updateMessage('2...');
        }
    }, delay2));

    const delay3 = delay2 + getRandomCountdownDelay();
    game.countdownTimers.push(setTimeout(() => {
        if (game.phase !== GamePhase.GAME_OVER) {
            game.phase = GamePhase.COUNTDOWN_1;
            updateCountdown('1');
            updateMessage('1...');
        }
    }, delay3));

    const delayGo = delay3 + getRandomCountdownDelay();
    game.countdownTimers.push(setTimeout(() => {
        if (game.phase !== GamePhase.GAME_OVER) {
            game.phase = GamePhase.GO;
            updateCountdown('GO!', true);
            updateMessage('발사!!!', true);
            updateFireButtons();
            startGoTimer();

            game.goTimer = setTimeout(() => {
                if (game.phase === GamePhase.GO) {
                    endRound();
                }
            }, CONFIG.GO_DURATION);
        }
    }, delayGo));
}

function endRound() {
    if (game.phase === GamePhase.GAME_OVER) return;

    game.phase = GamePhase.ROUND_END;
    clearAllTimers();
    stopGoTimer();
    updateFireButtons();

    updateCountdown('END');
    updateMessage(`라운드 ${game.round} 종료!`);

    setTimeout(() => {
        if (game.phase === GamePhase.GAME_OVER) return;

        game.round++;
        game.resetRound();
        updateRoundInfo();
        updateCountdown('READY');
        updateMessage('시작 버튼을 눌러주세요!');
        updateStartButton();
        updateFireButtons();
    }, CONFIG.ROUND_END_DELAY);
}

// ============================================
// 게임 초기화
// ============================================
function initGame() {
    game.reset();
    hideGameOver();
    stopGoTimer();
    updateHP(1);
    updateHP(2);
    updateCountdown('READY');
    updateRoundInfo();
    updateMessage('시작 버튼을 눌러주세요!');
    showStun(1, false);
    showStun(2, false);
    DOM.players[1].stunBar.style.width = '0%';
    DOM.players[2].stunBar.style.width = '0%';
    updateFireButtons();
    updateStartButton();
}

// ============================================
// 비주얼 효과
// ============================================
function showStun(playerNum, show) {
    const dom = DOM.players[playerNum];
    dom.section.classList.toggle('stunned', show);
    dom.stun.classList.toggle('show', show);

    if (!show) {
        dom.stunBar.style.width = '0%';
    }
}

function animateStunBar(playerNum) {
    const player = game.players[playerNum];
    const dom = DOM.players[playerNum];

    if (game.stunAnimationFrames[playerNum]) {
        cancelAnimationFrame(game.stunAnimationFrames[playerNum]);
    }

    function updateBar() {
        if (!player.stunned || !player.stunStartTime) {
            dom.stunBar.style.width = '0%';
            return;
        }

        const elapsed = Date.now() - player.stunStartTime;
        const remaining = Math.max(0, CONFIG.STUN_DURATION - elapsed);
        const percent = (remaining / CONFIG.STUN_DURATION) * 100;

        dom.stunBar.style.width = `${percent}%`;

        if (remaining > 0) {
            game.stunAnimationFrames[playerNum] = requestAnimationFrame(updateBar);
        }
    }

    updateBar();
}

function startGoTimer() {
    DOM.goTimerContainer.classList.add('active');
    game.goStartTime = Date.now();

    const circumference = 2 * Math.PI * 45;

    function updateTimer() {
        const elapsed = Date.now() - game.goStartTime;
        const remaining = Math.max(0, CONFIG.GO_DURATION - elapsed);
        const progress = remaining / CONFIG.GO_DURATION;

        const offset = circumference * (1 - progress);
        DOM.goTimerProgress.style.strokeDashoffset = offset;

        if (remaining > 0 && game.phase === GamePhase.GO) {
            game.goAnimationFrame = requestAnimationFrame(updateTimer);
        }
    }

    updateTimer();
}

function stopGoTimer() {
    DOM.goTimerContainer.classList.remove('active');
    if (game.goAnimationFrame) {
        cancelAnimationFrame(game.goAnimationFrame);
        game.goAnimationFrame = null;
    }
    DOM.goTimerProgress.style.strokeDashoffset = 0;
}

function showShotEffect(playerNum, type, damage = 0) {
    const targetNum = playerNum === 1 ? 2 : 1;
    const shooterDom = DOM.players[playerNum];
    const targetDom = DOM.players[targetNum];

    // 발사 이펙트
    shooterDom.shot.textContent = type === 'clean' ? '💥' : '💨';
    shooterDom.shot.className = 'shot-indicator';
    void shooterDom.shot.offsetWidth;
    shooterDom.shot.classList.add(type);

    // 화면 흔들림
    DOM.container.classList.remove('shake');
    void DOM.container.offsetWidth;
    DOM.container.classList.add('shake');
    setTimeout(() => DOM.container.classList.remove('shake'), 500);

    // 피격 효과
    targetDom.section.classList.remove('hit');
    void targetDom.section.offsetWidth;
    targetDom.section.classList.add('hit');
    setTimeout(() => targetDom.section.classList.remove('hit'), 400);

    // 데미지 표시
    if (damage > 0) {
        targetDom.damage.textContent = `-${damage}`;
        targetDom.damage.classList.remove('show');
        void targetDom.damage.offsetWidth;
        targetDom.damage.classList.add('show');
    }

    // 플래시 효과
    DOM.flash.classList.remove('flash-clean', 'flash-dirty');
    void DOM.flash.offsetWidth;
    if (type === 'clean') {
        DOM.flash.classList.add('flash-clean');
        setTimeout(() => DOM.flash.classList.remove('flash-clean'), 150);
    } else {
        DOM.flash.classList.add('flash-dirty');
        setTimeout(() => DOM.flash.classList.remove('flash-dirty'), 120);
    }

    // 진동 (지원되는 경우)
    if (navigator.vibrate) {
        navigator.vibrate(type === 'clean' ? [50, 30, 100] : [30, 20, 50]);
    }
}

function showGameOver(winner) {
    DOM.winnerText.textContent = 'VICTORY';
    DOM.winnerPlayer.textContent = `Player ${winner} 승리!`;
    DOM.gameOver.classList.add('show');
}

function hideGameOver() {
    DOM.gameOver.classList.remove('show');
}

// ============================================
// 이벤트 핸들러
// ============================================

// 시작 버튼
DOM.startBtn.addEventListener('click', () => {
    if (game.phase === GamePhase.READY) {
        startCountdown();
    }
});

DOM.startBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (game.phase === GamePhase.READY) {
        startCountdown();
    }
});

// 발사 버튼 (터치/클릭)
DOM.players[1].fireBtn.addEventListener('click', () => handleShot(1));
DOM.players[2].fireBtn.addEventListener('click', () => handleShot(2));

DOM.players[1].fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleShot(1);
});
DOM.players[2].fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleShot(2);
});

// 재시작 버튼
DOM.restartBtn.addEventListener('click', () => initGame());
DOM.restartBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initGame();
});

// 게임 초기화 실행
initGame();
