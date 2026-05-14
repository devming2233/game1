/**
 * 接礼盒大作战 - 游戏核心逻辑
 * 
 * 关键设计点：
 * 1. 使用 requestAnimationFrame 实现流畅动画
 * 2. 礼盒类型：普通(10分/慢速)、高级(30分/中速)、稀有(50分/快速)
 * 3. 升级机制：500分→双盘，10000分→三盘
 * 4. 支持自定义图片（使用 localStorage 存储 base64）
 * 5. 支持键盘和触屏操作
 */

// ==================== 游戏配置 ====================
const CONFIG = {
    canvasWidth: 480,
    canvasHeight: 640,
    plateWidth: 80,
    plateHeight: 40,
    plateSpeed: 12,           // 基础移动速度（已提速）
    plateSpeedBoost: 2,        // 长按加速倍率（2倍速）
    plateBoostDelay: 300,      // 长按触发加速的延迟(ms)
    giftSize: 40,
    spawnInterval: 60,      // 每60帧生成一个礼盒
    gravity: 0.15,          // 重力加速度
    
    // 礼盒配置：类型、分数、基础速度、颜色（备用）
    giftTypes: [
        { type: 'normal',  score: 10,  baseSpeed: 2,  color: '#FF6B6B', label: '普通' },
        { type: 'advanced', score: 30,  baseSpeed: 3.5, color: '#4ECDC4', label: '高级' },
        { type: 'rare',    score: 50,  baseSpeed: 5,  color: '#FFE66D', label: '稀有' }
    ],
    
    // 升级阈值
    upgrades: {
        doublePlate: 500,
        triplePlate: 10000
    },
    
    // 生命值配置
    maxLives: 5,              // 最大生命值
    catchBonusInterval: 10,   // 每接住10个便便奖励1命
    speedIncreaseInterval: 5, // 每5个便便生成后速度增加
    speedIncreaseRate: 0.01   // 速度增加1%
};

// ==================== 游戏状态 ====================
let gameState = {
    isRunning: false,
    isPaused: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('catchGift_highScore')) || 0,
    frameCount: 0,
    plateCount: 1,          // 当前盘子数量
    plates: [],             // 盘子数组
    gifts: [],              // 礼盒数组
    particles: [],          // 粒子效果
    floatingTexts: [],      // 飘字特效
    lives: 5,               // 当前生命值
    maxLives: 5,            // 最大生命值
    catchCount: 0,          // 累计接住便便数
    spawnCount: 0,          // 累计生成便便数
    speedMultiplier: 1,     // 全局速度倍率
    gameOver: false,        // 游戏结束状态
    keys: {},               // 按键状态
    keyPressTime: {          // 按键按下时间戳（用于长按检测）
        left: 0,
        right: 0
    },
    customImages: {         // 自定义图片
        plate: null,
        normal: null,
        advanced: null,
        rare: null
    }
};

// ==================== DOM 元素 ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const plateCountEl = document.getElementById('plateCount');
const startBtn = document.getElementById('startBtn');
const upgradeNotice = document.getElementById('upgradeNotice');
const livesEl = document.getElementById('lives');

// 设置高分显示
highScoreEl.textContent = gameState.highScore;

// 页面加载完成后应用语言
window.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
});

// ==================== 图片资源 ====================
// 默认使用 Canvas 绘制，支持自定义图片替换
function loadCustomImages() {
    const saved = localStorage.getItem('catchGift_images');
    if (saved) {
        gameState.customImages = JSON.parse(saved);
    }
}

function saveCustomImages() {
    localStorage.setItem('catchGift_images', JSON.stringify(gameState.customImages));
}

loadCustomImages();

// 预加载盘子图片（去除背景色）
const PLATE_IMAGE = new Image();
PLATE_IMAGE.src = 'assets/plate.jpg';
PLATE_IMAGE.crossOrigin = 'anonymous';
let plateImageLoaded = false;
let plateImageProcessed = null;

PLATE_IMAGE.onload = () => {
    plateImageLoaded = true;
    // 处理图片：去除白色/浅色背景，替换为游戏主题色
    processPlateImage();
};
PLATE_IMAGE.onerror = () => { console.warn('盘子图片加载失败，使用默认绘制'); };

/**
 * 处理盘子图片：将白色/浅色背景替换为游戏主题色渐变
 */
function processPlateImage() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = PLATE_IMAGE.width;
    tempCanvas.height = PLATE_IMAGE.height;
    const tCtx = tempCanvas.getContext('2d');
    
    // 先绘制主题色背景
    const gradient = tCtx.createLinearGradient(0, 0, tempCanvas.width, tempCanvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    tCtx.fillStyle = gradient;
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // 使用 destination-in 混合模式，只保留原图非透明部分
    tCtx.globalCompositeOperation = 'destination-in';
    tCtx.drawImage(PLATE_IMAGE, 0, 0);
    
    // 再绘制一次原图（带透明度混合，让主题色透出）
    tCtx.globalCompositeOperation = 'source-over';
    tCtx.globalAlpha = 0.85;
    tCtx.drawImage(PLATE_IMAGE, 0, 0);
    
    plateImageProcessed = new Image();
    plateImageProcessed.src = tempCanvas.toDataURL();
}

// ==================== 绘制函数 ====================

/**
 * 绘制盘子
 * 优先使用上传的图片，支持自适应尺寸
 */
function drawPlate(plate) {
    const { x, y, width, height } = plate;
    
    // 优先使用处理后的盘子图片（背景色已替换为游戏主题色）
    if (plateImageLoaded && plateImageProcessed && plateImageProcessed.complete) {
        // 计算自适应绘制尺寸，保持图片比例
        const imgRatio = plateImageProcessed.width / plateImageProcessed.height;
        const plateRatio = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imgRatio > plateRatio) {
            // 图片更宽，以宽度为基准
            drawWidth = width * 1.2;  // 稍微放大一点，更饱满
            drawHeight = drawWidth / imgRatio;
            drawX = x - drawWidth / 2;
            drawY = y + (height - drawHeight) / 2;
        } else {
            // 图片更高，以高度为基准
            drawHeight = height * 1.2;
            drawWidth = drawHeight * imgRatio;
            drawX = x - drawWidth / 2;
            drawY = y + (height - drawHeight) / 2;
        }
        
        ctx.drawImage(plateImageProcessed, drawX, drawY, drawWidth, drawHeight);
        return;
    }
    
    // fallback: 自定义图片（localStorage）
    if (gameState.customImages.plate) {
        const img = new Image();
        img.src = gameState.customImages.plate;
        if (img.complete) {
            ctx.drawImage(img, x - width/2, y, width, height);
            return;
        }
    }
    
    // 默认卡通盘子绘制
    ctx.save();
    
    // 盘子主体 - 椭圆
    ctx.beginPath();
    ctx.ellipse(x, y + height/2, width/2, height/2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#F4A460';
    ctx.fill();
    ctx.strokeStyle = '#D2691E';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 盘子内部
    ctx.beginPath();
    ctx.ellipse(x, y + height/2 - 3, width/2 - 8, height/2 - 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFE4C4';
    ctx.fill();
    
    // 盘子边缘高光
    ctx.beginPath();
    ctx.ellipse(x - 5, y + height/2 - 5, width/2 - 15, height/2 - 10, -0.2, 0, Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
}

/**
 * 绘制便便
 * 支持自定义图片，无图片时用卡通便便绘制
 */
function drawGift(gift) {
    const { x, y, size, giftType } = gift;
    const config = CONFIG.giftTypes.find(g => g.type === giftType);
    
    if (gameState.customImages[giftType]) {
        const img = new Image();
        img.src = gameState.customImages[giftType];
        if (img.complete) {
            ctx.drawImage(img, x - size/2, y - size/2, size, size);
            return;
        }
    }
    
    // 默认卡通便便绘制
    ctx.save();
    
    const cx = x;
    const cy = y + size * 0.1;
    const s = size * 0.9;
    
    // 便便颜色根据类型变化
    let poopColor, darkColor;
    if (giftType === 'normal') {
        poopColor = '#8B4513';      //  saddlebrown
        darkColor = '#5D2E0C';
    } else if (giftType === 'advanced') {
        poopColor = '#A0522D';      // sienna
        darkColor = '#6B3410';
    } else {
        poopColor = '#CD853F';      // peru (金色稀有)
        darkColor = '#8B5A2B';
    }
    
    // 阴影
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.45, s * 0.35, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
    
    // 便便主体 - 三层堆叠的椭圆
    // 底层（最大）
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.25, s * 0.38, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = poopColor;
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // 中层
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.05, s * 0.30, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = poopColor;
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // 顶层（最小）
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.12, s * 0.22, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = poopColor;
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // 顶部小尖尖
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.28, s * 0.10, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = poopColor;
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // 表情 - 眼睛
    const eyeY = cy - s * 0.12;
    const eyeOffset = s * 0.08;
    
    // 左眼白
    ctx.beginPath();
    ctx.arc(cx - eyeOffset, eyeY, s * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 右眼白
    ctx.beginPath();
    ctx.arc(cx + eyeOffset, eyeY, s * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 左眼球
    ctx.beginPath();
    ctx.arc(cx - eyeOffset + s * 0.02, eyeY, s * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    
    // 右眼球
    ctx.beginPath();
    ctx.arc(cx + eyeOffset + s * 0.02, eyeY, s * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    
    // 高光
    ctx.beginPath();
    ctx.arc(cx - eyeOffset - s * 0.02, eyeY - s * 0.02, s * 0.015, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffset - s * 0.02, eyeY - s * 0.02, s * 0.015, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    // 嘴巴
    ctx.beginPath();
    ctx.arc(cx, eyeY + s * 0.06, s * 0.04, 0, Math.PI);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // 腮红
    ctx.beginPath();
    ctx.arc(cx - s * 0.18, eyeY + s * 0.02, s * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, eyeY + s * 0.02, s * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
    ctx.fill();
    
    // 分数标签（小数字显示在便便下方）
    ctx.font = `bold ${Math.floor(s * 0.25)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = config.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeText(config.score, cx, cy + s * 0.55);
    ctx.fillText(config.score, cx, cy + s * 0.55);
    
    ctx.restore();
}

/**
 * 绘制粒子效果（接住礼盒时的爆炸）
 */
function drawParticles() {
    gameState.particles = gameState.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;  // 重力
        p.life -= 0.02;
        p.size *= 0.98;
        
        if (p.life <= 0) return false;
        
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        return true;
    });
}

function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        gameState.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            size: Math.random() * 5 + 3,
            color: color,
            life: 1
        });
    }
}

/**
 * 创建"美味！"飘字特效
 */
function createDeliciousText(x, y) {
    const text = t('delicious');
    
    gameState.floatingTexts.push({
        x: x,
        y: y,
        text: text,
        life: 1,           // 1秒生命周期（60帧）
        vy: -2,            // 向上飘动
        scale: 1,
        color: '#FFD700'   // 金色
    });
}

/**
 * 绘制飘字特效
 */
function drawFloatingTexts() {
    gameState.floatingTexts = gameState.floatingTexts.filter(ft => {
        ft.y += ft.vy;
        ft.life -= 0.016;   // 约60帧 = 1秒
        ft.scale += 0.01;
        
        if (ft.life <= 0) return false;
        
        ctx.save();
        ctx.globalAlpha = ft.life;
        ctx.font = `bold ${Math.floor(20 * ft.scale)}px Microsoft YaHei`;
        ctx.textAlign = 'center';
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
        
        return true;
    });
}

// ==================== 游戏逻辑 ====================

/**
 * 初始化/重置游戏
 */
function initGame() {
    gameState.score = 0;
    gameState.frameCount = 0;
    gameState.plateCount = 1;
    gameState.gifts = [];
    gameState.particles = [];
    gameState.floatingTexts = [];
    gameState.lives = CONFIG.maxLives;
    gameState.maxLives = CONFIG.maxLives;
    gameState.catchCount = 0;
    gameState.spawnCount = 0;
    gameState.speedMultiplier = 1;
    gameState.gameOver = false;
    
    // 初始化盘子位置（底部居中）
    updatePlates();
    
    updateUI();
}

/**
 * 根据盘子数量更新盘子位置
 * 多个盘子时紧密并排排列，统一控制
 */
function updatePlates() {
    const baseY = CONFIG.canvasHeight - CONFIG.plateHeight - 10;
    gameState.plates = [];
    
    // 计算整组盘子的总宽度，居中放置
    const totalWidth = gameState.plateCount * CONFIG.plateWidth;
    const startX = (CONFIG.canvasWidth - totalWidth) / 2 + CONFIG.plateWidth / 2;
    
    for (let i = 0; i < gameState.plateCount; i++) {
        gameState.plates.push({
            x: startX + i * CONFIG.plateWidth,
            y: baseY,
            width: CONFIG.plateWidth,
            height: CONFIG.plateHeight
        });
    }
}

/**
 * 生成新便便
 * 根据盘子数量同时生成多个
 */
function spawnGift() {
    // 根据盘子数量决定生成便便数量
    const spawnCount = gameState.plateCount;
    
    for (let i = 0; i < spawnCount; i++) {
        // 随机选择便便类型（普通60%，高级30%，稀有10%）
        const rand = Math.random();
        let giftType;
        if (rand < 0.6) {
            giftType = 'normal';
        } else if (rand < 0.9) {
            giftType = 'advanced';
        } else {
            giftType = 'rare';
        }
        
        const config = CONFIG.giftTypes.find(g => g.type === giftType);
        
        // 基础速度 + 分数加成 + 全局速度倍率
        const scoreSpeed = 1 + gameState.score / 2000;
        
        gameState.gifts.push({
            x: Math.random() * (CONFIG.canvasWidth - CONFIG.giftSize) + CONFIG.giftSize / 2,
            y: -CONFIG.giftSize - i * 30,  // 错开初始位置
            size: CONFIG.giftSize,
            giftType: giftType,
            speed: config.baseSpeed * scoreSpeed * gameState.speedMultiplier,
            vy: 0  // 垂直速度（受重力影响）
        });
    }
    
    // 累计生成计数
    gameState.spawnCount += spawnCount;
    
    // 每5个便便生成后，速度增加1%
    if (gameState.spawnCount >= CONFIG.speedIncreaseInterval) {
        gameState.spawnCount = 0;
        gameState.speedMultiplier += CONFIG.speedIncreaseRate;
    }
}

/**
 * 碰撞检测
 */
function checkCollision(gift, plate) {
    const giftLeft = gift.x - gift.size / 2;
    const giftRight = gift.x + gift.size / 2;
    const giftTop = gift.y - gift.size / 2;
    const giftBottom = gift.y + gift.size / 2;
    
    const plateLeft = plate.x - plate.width / 2;
    const plateRight = plate.x + plate.width / 2;
    const plateTop = plate.y;
    const plateBottom = plate.y + plate.height;
    
    return giftRight > plateLeft &&
           giftLeft < plateRight &&
           giftBottom > plateTop &&
           giftTop < plateBottom;
}

/**
 * 检查升级
 */
function checkUpgrade() {
    if (gameState.plateCount === 1 && gameState.score >= CONFIG.upgrades.doublePlate) {
        gameState.plateCount = 2;
        updatePlates();
        showUpgradeNotice(t('doublePlate'));
        updateUI();
    } else if (gameState.plateCount === 2 && gameState.score >= CONFIG.upgrades.triplePlate) {
        gameState.plateCount = 3;
        updatePlates();
        showUpgradeNotice(t('triplePlate'));
        updateUI();
    }
}

/**
 * 显示升级提示
 */
function showUpgradeNotice(text) {
    upgradeNotice.textContent = text;
    upgradeNotice.style.display = 'block';
    setTimeout(() => {
        upgradeNotice.style.display = 'none';
    }, 2500);
}

/**
 * 更新UI
 */
function updateUI() {
    scoreEl.textContent = gameState.score;
    plateCountEl.textContent = gameState.plateCount;
    if (livesEl) livesEl.textContent = gameState.lives;
    // 更新信息栏标签（语言适配）
    updateInfoLabels();
}

/**
 * 游戏结束
 */
function gameOver() {
    gameState.isRunning = false;
    gameState.gameOver = true;
    
    // 绘制游戏结束画面
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Microsoft YaHei';
    ctx.textAlign = 'center';
    ctx.fillText(t('gameOver'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 - 60);
    
    ctx.font = '24px Microsoft YaHei';
    ctx.fillText(`${t('finalScore')}: ${gameState.score}`, CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2);
    
    ctx.font = '18px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(t('trumpFull'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 + 40);
    
    ctx.font = '16px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(t('clickToRestart'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 + 80);
    
    ctx.restore();
    
    // 重置按钮状态
    startBtn.textContent = t('restart');
    startBtn.classList.remove('btn-pause');
    startBtn.classList.add('btn-start');
}

// ==================== 游戏循环 ====================

function gameLoop() {
    if (!gameState.isRunning || gameState.isPaused) return;
    
    // 清空画布
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    
    // 绘制背景装饰（星星）
    drawBackground();
    
    // 更新帧计数
    gameState.frameCount++;
    
    // 生成礼盒
    if (gameState.frameCount % CONFIG.spawnInterval === 0) {
        spawnGift();
    }
    
    // 处理输入 - 移动盘子
    handleInput();
    
    // 更新和绘制礼盒
    gameState.gifts = gameState.gifts.filter(gift => {
        // 应用重力
        gift.vy += CONFIG.gravity;
        gift.y += gift.speed + gift.vy;
        
        // 检查是否接住
        let caught = false;
        for (const plate of gameState.plates) {
            if (checkCollision(gift, plate)) {
                caught = true;
                const config = CONFIG.giftTypes.find(g => g.type === gift.giftType);
                gameState.score += config.score;
                
                // 创建粒子效果
                createParticles(gift.x, gift.y, config.color);
                
                // 创建"美味！"飘字特效
                createDeliciousText(gift.x, gift.y - 30);
                
                // 累计接住计数
                gameState.catchCount++;
                
                // 每接住10个便便，奖励1命（不超过上限）
                if (gameState.catchCount >= CONFIG.catchBonusInterval) {
                    gameState.catchCount = 0;
                    if (gameState.lives < gameState.maxLives) {
                        gameState.lives++;
                        // 奖励飘字
                        gameState.floatingTexts.push({
                            x: CONFIG.canvasWidth / 2,
                            y: CONFIG.canvasHeight / 2,
                            text: t('lifeBonus'),
                            life: 1.5,
                            vy: -2,
                            scale: 1.5,
                            color: '#FF69B4'
                        });
                        updateUI();
                    }
                }
                
                // 检查升级
                checkUpgrade();
                
                // 更新最高分
                if (gameState.score > gameState.highScore) {
                    gameState.highScore = gameState.score;
                    localStorage.setItem('catchGift_highScore', gameState.highScore);
                    highScoreEl.textContent = gameState.highScore;
                }
                
                updateUI();
                break;
            }
        }
        
        if (caught) return false;
        
        // 检查是否掉落到底部（失误）
        if (gift.y > CONFIG.canvasHeight + gift.size) {
            // 掉落的便便扣除生命值
            gameState.lives--;
            
            // 创建失误飘字
            gameState.floatingTexts.push({
                x: gift.x,
                y: CONFIG.canvasHeight - 50,
                text: t('miss'),
                life: 1,
                vy: -1,
                scale: 1,
                color: '#FF4444'
            });
            
            updateUI();
            
            // 检查游戏结束
            if (gameState.lives <= 0) {
                gameOver();
            }
            
            return false;
        }
        
        // 绘制礼盒
        drawGift(gift);
        return true;
    });
    
    // 绘制盘子
    for (const plate of gameState.plates) {
        drawPlate(plate);
    }
    
    // 绘制粒子
    drawParticles();
    
    // 绘制飘字特效
    drawFloatingTexts();
    
    requestAnimationFrame(gameLoop);
}

/**
 * 绘制背景装饰
 */
function drawBackground() {
    // 简单的星星背景
    ctx.save();
    for (let i = 0; i < 20; i++) {
        const x = (gameState.frameCount * 0.5 + i * 50) % CONFIG.canvasWidth;
        const y = (i * 37 + gameState.frameCount * 0.2) % CONFIG.canvasHeight;
        const size = (Math.sin(gameState.frameCount * 0.05 + i) + 1) * 1.5;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
    }
    ctx.restore();
}

/**
 * 处理键盘/触摸输入
 * 多个盘子作为整体统一移动，长按超过 plateBoostDelay 后速度翻倍
 */
function handleInput() {
    const now = Date.now();
    let moveSpeed = CONFIG.plateSpeed;
    
    // 检测是否长按（任一方向长按都触发加速）
    const leftPressed = gameState.keys['ArrowLeft'] || gameState.keys['KeyA'] || gameState.keys['left'];
    const rightPressed = gameState.keys['ArrowRight'] || gameState.keys['KeyD'] || gameState.keys['right'];
    
    const leftLongPress = leftPressed && gameState.keyPressTime.left > 0 && (now - gameState.keyPressTime.left) > CONFIG.plateBoostDelay;
    const rightLongPress = rightPressed && gameState.keyPressTime.right > 0 && (now - gameState.keyPressTime.right) > CONFIG.plateBoostDelay;
    
    // 只要任一方向长按超过阈值，整体加速
    if (leftLongPress || rightLongPress) {
        moveSpeed *= CONFIG.plateSpeedBoost;
    }
    
    // 计算整组盘子的左右边界
    const totalWidth = gameState.plateCount * CONFIG.plateWidth;
    const groupLeft = gameState.plates[0].x - CONFIG.plateWidth / 2;
    const groupRight = gameState.plates[gameState.plateCount - 1].x + CONFIG.plateWidth / 2;
    
    // 计算移动量，确保整组不会超出边界
    let moveDelta = 0;
    if (leftPressed) moveDelta -= moveSpeed;
    if (rightPressed) moveDelta += moveSpeed;
    
    // 边界限制：整组盘子不能移出屏幕
    if (moveDelta < 0 && groupLeft + moveDelta < 0) {
        moveDelta = -groupLeft; // 贴到左边缘
    }
    if (moveDelta > 0 && groupRight + moveDelta > CONFIG.canvasWidth) {
        moveDelta = CONFIG.canvasWidth - groupRight; // 贴到右边缘
    }
    
    // 统一移动所有盘子
    for (const plate of gameState.plates) {
        plate.x += moveDelta;
    }
}

// ==================== 控制函数 ====================

function toggleGame() {
    if (gameState.gameOver) {
        // 游戏结束后重新开始
        initGame();
        gameState.isRunning = true;
        gameState.isPaused = false;
        gameState.gameOver = false;
        startBtn.textContent = t('pause');
        startBtn.classList.remove('btn-start');
        startBtn.classList.add('btn-pause');
        gameLoop();
    } else if (!gameState.isRunning) {
        // 开始游戏
        initGame();
        gameState.isRunning = true;
        gameState.isPaused = false;
        startBtn.textContent = t('pause');
        startBtn.classList.remove('btn-start');
        startBtn.classList.add('btn-pause');
        gameLoop();
    } else if (gameState.isPaused) {
        // 继续
        gameState.isPaused = false;
        startBtn.textContent = t('pause');
        gameLoop();
    } else {
        // 暂停
        gameState.isPaused = true;
        startBtn.textContent = t('resume');
    }
}

// ==================== 事件监听 ====================

// 键盘事件
document.addEventListener('keydown', (e) => {
    const wasPressed = gameState.keys[e.code];
    gameState.keys[e.code] = true;
    
    // 记录按键按下时间（用于长按加速）
    if (!wasPressed) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            gameState.keyPressTime.left = Date.now();
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            gameState.keyPressTime.right = Date.now();
        }
    }
    
    // 空格键暂停/继续
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState.isRunning) {
            toggleGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.code] = false;
    
    // 清除按键时间
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        gameState.keyPressTime.left = 0;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        gameState.keyPressTime.right = 0;
    }
});

// 移动端触摸控制
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

leftBtn.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    gameState.keys['left'] = true; 
    gameState.keyPressTime.left = Date.now();
});
leftBtn.addEventListener('touchend', (e) => { 
    e.preventDefault(); 
    gameState.keys['left'] = false; 
    gameState.keyPressTime.left = 0;
});
leftBtn.addEventListener('mousedown', () => { 
    gameState.keys['left'] = true; 
    gameState.keyPressTime.left = Date.now();
});
leftBtn.addEventListener('mouseup', () => { 
    gameState.keys['left'] = false; 
    gameState.keyPressTime.left = 0;
});

rightBtn.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    gameState.keys['right'] = true; 
    gameState.keyPressTime.right = Date.now();
});
rightBtn.addEventListener('touchend', (e) => { 
    e.preventDefault(); 
    gameState.keys['right'] = false; 
    gameState.keyPressTime.right = 0;
});
rightBtn.addEventListener('mousedown', () => { 
    gameState.keys['right'] = true; 
    gameState.keyPressTime.right = Date.now();
});
rightBtn.addEventListener('mouseup', () => { 
    gameState.keys['right'] = false; 
    gameState.keyPressTime.right = 0;
});

// ==================== 自定义图片功能 ====================

function openCustom() {
    document.getElementById('customModal').style.display = 'flex';
    // 暂停游戏
    if (gameState.isRunning && !gameState.isPaused) {
        gameState.isPaused = true;
        startBtn.textContent = t('resume');
    }
}

function closeCustom() {
    document.getElementById('customModal').style.display = 'none';
    saveCustomImages();
}

function previewImage(input, previewId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewId);
            preview.src = e.target.result;
            preview.style.display = 'block';
            
            // 保存到游戏状态
            const typeMap = {
                'platePreview': 'plate',
                'gift1Preview': 'normal',
                'gift2Preview': 'advanced',
                'gift3Preview': 'rare'
            };
            gameState.customImages[typeMap[previewId]] = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// 点击模态框背景关闭
document.getElementById('customModal').addEventListener('click', (e) => {
    if (e.target.id === 'customModal') {
        closeCustom();
    }
});

// ==================== 初始绘制 ====================

// 游戏开始前显示提示画面
function drawStartScreen() {
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 32px Microsoft YaHei';
    ctx.textAlign = 'center';
    ctx.fillText(t('title'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 - 60);
    
    ctx.font = '18px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(t('controlHint'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2);
    ctx.fillText(t('catchHint'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 + 30);
    ctx.fillText(t('lifeRule'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 + 60);
    
    ctx.font = '16px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(t('clickToStart'), CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 + 110);
    
    ctx.restore();
}

drawStartScreen();

// 窗口大小调整（移动端适配）
function resizeCanvas() {
    const maxWidth = Math.min(window.innerWidth - 20, 480);
    const scale = maxWidth / 480;
    canvas.style.width = maxWidth + 'px';
    canvas.style.height = (640 * scale) + 'px';
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
