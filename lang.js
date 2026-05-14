/**
 * 多语言支持
 * 支持中文(zh)和英文(en)切换
 */

const LANG = {
    zh: {
        title: '🍽️ 特朗普吃屎大作战',
        score: '分数',
        highScore: '最高',
        lives: '生命',
        plates: '盘子',
        start: '▶ 开始游戏',
        pause: '⏸ 暂停游戏',
        resume: '▶ 继续游戏',
        restart: '▶ 重新开始',
        gameOver: '💩 游戏结束',
        finalScore: '最终得分',
        trumpFull: '川普已经吃撑了！',
        clickToRestart: '点击"开始游戏"重新开始',
        controlHint: '使用 ← → 或 A D 键移动盘子',
        catchHint: '接住便便，川普说美味！',
        lifeRule: '❤️ 生命: 5 | 接住10个+1命',
        clickToStart: '点击"开始游戏"开始',
        doublePlate: '🎉 盘子加倍！\n现在你有2个盘子了！',
        triplePlate: '🎊 超级升级！\n现在你有3个盘子了！',
        miss: '💔 失误！',
        lifeBonus: '❤️ +1 生命！',
        delicious: ['美味！', 'yummy！', '好吃！', '真香！', '再来一口！', '川普最爱！'],
        normalPoop: '普通便便',
        advancedPoop: '高级便便',
        rarePoop: '稀有便便',
        customTitle: '🎨 自定义图片',
        plateTip: '💡 盘子已使用上传的图片，如需更换请替换 assets/plate.jpg 文件',
        save: '✅ 保存设置',
        langSwitch: '🌐 English'
    },
    en: {
        title: '🍽️ Trump Eats Poop',
        score: 'Score',
        highScore: 'Best',
        lives: 'Lives',
        plates: 'Plates',
        start: '▶ Start Game',
        pause: '⏸ Pause',
        resume: '▶ Resume',
        restart: '▶ Restart',
        gameOver: '💩 Game Over',
        finalScore: 'Final Score',
        trumpFull: 'Trump is stuffed!',
        clickToRestart: 'Click "Start Game" to restart',
        controlHint: 'Use ← → or A D keys to move',
        catchHint: 'Catch poop, Trump says yummy!',
        lifeRule: '❤️ Lives: 5 | Catch 10 for +1',
        clickToStart: 'Click "Start Game" to begin',
        doublePlate: '🎉 Double Plates!\nYou now have 2 plates!',
        triplePlate: '🎊 Super Upgrade!\nYou now have 3 plates!',
        miss: '💔 Miss!',
        lifeBonus: '❤️ +1 Life!',
        delicious: ['Delicious!', 'Yummy!', 'Tasty!', 'So good!', 'More!', 'Trump loves it!'],
        normalPoop: 'Normal Poop',
        advancedPoop: 'Advanced Poop',
        rarePoop: 'Rare Poop',
        customTitle: '🎨 Custom Images',
        plateTip: '💡 Plate image is fixed. Replace assets/plate.jpg to change.',
        save: '✅ Save Settings',
        langSwitch: '🌐 中文'
    }
};

// 当前语言
let currentLang = localStorage.getItem('catchGift_lang') || 'zh';

/**
 * 获取翻译文本
 */
function t(key) {
    const texts = LANG[currentLang];
    if (!texts) return key;
    
    const value = texts[key];
    if (Array.isArray(value)) {
        // 如果是数组，随机返回一个
        return value[Math.floor(Math.random() * value.length)];
    }
    return value || key;
}

/**
 * 切换语言
 */
function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('catchGift_lang', currentLang);
    applyLanguage();
}

/**
 * 应用语言到UI
 */
function applyLanguage() {
    // 更新HTML lang属性
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    
    // 更新标题
    document.title = currentLang === 'zh' ? '川普吃屎' : 'Trump Eats Poop';
    
    // 更新游戏标题
    const gameTitle = document.getElementById('gameTitle');
    if (gameTitle) gameTitle.textContent = t('title');
    
    // 更新信息栏标签
    updateInfoLabels();
    
    // 更新按钮文字
    updateButtonText();
    
    // 更新自定义面板
    updateCustomPanel();
    
    // 更新语言切换按钮
    const langBtn = document.getElementById('langBtn');
    if (langBtn) langBtn.textContent = t('langSwitch');
    
    // 如果游戏未运行，重绘开始画面
    if (!gameState.isRunning && !gameState.gameOver) {
        drawStartScreen();
    }
}

/**
 * 更新信息栏标签
 */
function updateInfoLabels() {
    const infoSpans = document.querySelectorAll('#gameInfo span');
    infoSpans.forEach(span => {
        const strong = span.querySelector('strong');
        if (!strong) return;
        
        const id = strong.id;
        let label = '';
        
        if (id === 'score') label = '🏆 ' + t('score') + ': ';
        else if (id === 'highScore') label = '🎯 ' + t('highScore') + ': ';
        else if (id === 'lives') label = '❤️ ' + t('lives') + ': ';
        else if (id === 'plateCount') label = '🍽️ ' + t('plates') + ': ';
        
        // 保留当前数值
        const value = strong.textContent;
        span.innerHTML = label + '<strong id="' + id + '">' + value + '</strong>';
    });
}

/**
 * 更新按钮文字
 */
function updateButtonText() {
    if (!startBtn) return;
    
    if (gameState.gameOver) {
        startBtn.textContent = t('restart');
    } else if (!gameState.isRunning) {
        startBtn.textContent = t('start');
    } else if (gameState.isPaused) {
        startBtn.textContent = t('resume');
    } else {
        startBtn.textContent = t('pause');
    }
}

/**
 * 更新自定义面板
 */
function updateCustomPanel() {
    const panelTitle = document.querySelector('#customPanel h3');
    if (panelTitle) panelTitle.textContent = t('customTitle');
    
    const plateTip = document.querySelector('#customPanel .custom-row p');
    if (plateTip) plateTip.textContent = t('plateTip');
    
    const labels = document.querySelectorAll('#customPanel .custom-row label');
    if (labels[0]) labels[0].textContent = t('normalPoop') + ' (10pts):';
    if (labels[1]) labels[1].textContent = t('advancedPoop') + ' (30pts):';
    if (labels[2]) labels[2].textContent = t('rarePoop') + ' (50pts):';
    
    const saveBtn = document.querySelector('#customPanel .btn-close');
    if (saveBtn) saveBtn.textContent = t('save');
}
