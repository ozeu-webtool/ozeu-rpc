const express = require('express');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const DiscordBot = require('./discord-bot');

const app = express();
const PORT = process.env.PORT || 3000;
const activeSessions = new Map();

app.use(cors());
app.use(express.json());

app.post('/api/connect', async (req, res) => {
    const { token, sessionId } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'トークンが必要です' });
    }
    
    const currentSessionId = sessionId || uuidv4();
    
    try {
        activeSessions.forEach((botInstance) => {
            botInstance.disconnect();
        });
        activeSessions.clear();
        
        const botInstance = new DiscordBot();
        await botInstance.connect(token);
        activeSessions.set(currentSessionId, botInstance);
        
        res.json({
            success: true,
            message: '接続を開始しました',
            sessionId: currentSessionId
        });
        
    } catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({
            error: '接続に失敗しました: ' + error.message
        });
    }
});

app.post('/api/set-activity', (req, res) => {
    const { activity, status = 'online', sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'セッションIDが必要です' });
    }
    
    const botInstance = activeSessions.get(sessionId);
    if (!botInstance) {
        return res.status(404).json({ error: '接続が見つかりません' });
    }
    
    try {
        const success = botInstance.updatePresence(status, activity);
        if (success) {
            res.json({
                success: true,
                message: 'アクティビティを設定しました'
            });
        } else {
            res.json({
                success: true,
                message: 'アクティビティを保存しました（接続後に適用されます）'
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'アクティビティの設定に失敗しました'
        });
    }
});

app.post('/api/clear-activity', (req, res) => {
    const { status = 'online', sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'セッションIDが必要です' });
    }
    
    const botInstance = activeSessions.get(sessionId);
    if (!botInstance) {
        return res.status(404).json({ error: '接続が見つかりません' });
    }
    
    try {
        const success = botInstance.updatePresence(status, null);
        if (success) {
            res.json({
                success: true,
                message: 'アクティビティをクリアしました'
            });
        } else {
            res.json({
                success: true,
                message: 'アクティビティをクリア予約しました'
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'アクティビティのクリアに失敗しました'
        });
    }
});

app.get('/api/status', (req, res) => {
    const { sessionId } = req.query;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'セッションIDが必要です' });
    }
    
    const botInstance = activeSessions.get(sessionId);
    if (!botInstance) {
        return res.json({
            isConnected: false,
            message: '接続が見つかりません'
        });
    }
    
    const status = botInstance.getStatus();
    res.json(status);
});

app.post('/api/set-status', (req, res) => {
    const { status, sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'セッションIDが必要です' });
    }
    
    if (!status) {
        return res.status(400).json({ error: 'ステータスが必要です' });
    }
    
    const botInstance = activeSessions.get(sessionId);
    if (!botInstance) {
        return res.status(404).json({ error: '接続が見つかりません' });
    }
    
    try {
        const currentActivity = botInstance.currentActivity;
        const success = botInstance.updatePresence(status, currentActivity);
        
        if (success) {
            res.json({
                success: true,
                message: `ステータスを${status}に変更しました`
            });
        } else {
            res.json({
                success: true,
                message: 'ステータスを保存しました（接続後に適用されます）'
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'ステータスの変更に失敗しました'
        });
    }
});

app.post('/api/disconnect', (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'セッションIDが必要です' });
    }
    
    try {
        const botInstance = activeSessions.get(sessionId);
        if (botInstance) {
            botInstance.disconnect();
            activeSessions.delete(sessionId);
        }
        
        res.json({
            success: true,
            message: '切断しました'
        });
    } catch (error) {
        res.status(500).json({
            error: '切断に失敗しました'
        });
    }
});

app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/ozeu-logo.png', (req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(path.join(__dirname, 'ozeu-logo.png'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Discord Activity Tracker - Server Side');
    
    process.on('SIGINT', () => {
        console.log('\n終了処理中...');
        activeSessions.forEach(botInstance => botInstance.disconnect());
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n終了処理中...');
        activeSessions.forEach(botInstance => botInstance.disconnect());
        process.exit(0);
    });
});
