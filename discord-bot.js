const WebSocket = require('ws');

class DiscordBot {
    constructor() {
        this.websocket = null;
        this.token = null;
        this.heartbeatInterval = null;
        this.sequenceNumber = null;
        this.sessionId = null;
        this.user = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.shouldReconnect = true;
        this.currentActivity = null;
        this.currentStatus = 'online';
    }

    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    }

    async connect(token) {
        this.token = token;
        this.log('Discord Gateway に接続中...');
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.websocket) {
            this.websocket.close();
        }
        
        this.isConnected = false;

        try {
            this.websocket = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
            
            this.websocket.onopen = () => {
                this.log('WebSocket接続が確立されました');
                this.reconnectAttempts = 0;
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };
            
            this.websocket.onclose = (event) => {
                this.log(`接続が切断されました (コード: ${event.code}, 理由: ${event.reason || 'Unknown'})`);
                this.isConnected = false;
                
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                    this.log('ハートビート停止');
                }
                
                if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    if (event.code === 4014 || event.code === 4004 || event.code === 4010 || 
                        event.code === 4011 || event.code === 4012 || event.code === 4013) {
                        this.log(`致命的なエラー (${event.code}): 再接続を停止します`, 'error');
                        this.shouldReconnect = false;
                    } else {
                        this.reconnectAttempts++;
                        const delay = Math.min(5000 * Math.pow(1.5, this.reconnectAttempts - 1), 30000) + Math.random() * 1000;
                        this.log(`再接続試行 ${this.reconnectAttempts}/${this.maxReconnectAttempts} (${Math.round(delay)}ms後)`);
                        
                        setTimeout(() => {
                            if (this.shouldReconnect) {
                                this.connect(this.token);
                            }
                        }, delay);
                    }
                }
            };
            
            this.websocket.onerror = (error) => {
                this.log(`WebSocketエラー: ${error.message || 'Unknown error'}`, 'error');
                console.error('Discord WebSocket error:', error);
                this.isConnected = false;
                
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                }
            };
            
        } catch (error) {
            this.log(`接続エラー: ${error.message}`, 'error');
            this.isConnected = false;
        }
    }

    handleMessage(message) {
        const { op, d, s, t } = message;
        
        if (s !== null) {
            this.sequenceNumber = s;
        }

        switch (op) {
            case 10: 
                this.log(`Helloを受信, ハートビート間隔: ${d.heartbeat_interval}ms`);
                this.startHeartbeat(d.heartbeat_interval);
                this.authenticate();
                break;
                
            case 0: 
                this.handleDispatch(t, d);
                break;
                
            case 1: 
                this.sendHeartbeat();
                break;
                
            case 7: 
                this.log('再接続が必要です');
                this.reconnect();
                break;
                
            case 9: 
                this.log('無効なセッションです - 再認証が必要', 'error');
                this.sessionId = null;
                setTimeout(() => {
                    if (this.shouldReconnect) {
                        this.authenticate();
                    }
                }, 1000);
                break;
                
            case 11:
                break;
                
            default:
                this.log(`未知のOPコード: ${op}`);
        }
    }

    handleDispatch(eventType, data) {
        switch (eventType) {
            case 'READY':
                this.handleReady(data);
                break;
                
            case 'PRESENCE_UPDATE':
                this.handlePresenceUpdate(data);
                break;
        }
    }

    handleReady(data) {
        this.user = data.user;
        this.sessionId = data.session_id;
        this.isConnected = true;
        
        this.log(`ログイン成功: ${data.user.username}#${data.user.discriminator}`);
        
        if (this.currentActivity || this.currentStatus !== 'online') {
            setTimeout(() => {
                this.updatePresence(this.currentStatus, this.currentActivity);
            }, 1000);
        }
    }

    handlePresenceUpdate(data) {
        if (data.user && data.user.id === this.user.id) {
            this.log(`プレゼンス更新: ${data.status}`);
        }
    }

    authenticate() {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            this.log('WebSocket未接続のため認証をスキップ', 'warn');
            return;
        }

        try {
            this.websocket.send(JSON.stringify({
                op: 2,
                d: {
                    token: this.token,
                    properties: {
                        os: 'linux',
                        browser: 'discord-bot',
                        device: 'discord-bot'
                    },
                    intents: 1 << 8
                }
            }));
            
            this.log('認証情報を送信しました');
        } catch (error) {
            this.log(`認証送信エラー: ${error.message}`, 'error');
        }
    }

    startHeartbeat(interval) {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, interval);
        
        this.log(`ハートビート開始: ${interval}ms間隔`);
    }

    sendHeartbeat() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
                this.websocket.send(JSON.stringify({
                    op: 1,
                    d: this.sequenceNumber
                }));
            } catch (error) {
                this.log(`ハートビート送信エラー: ${error.message}`, 'error');
                if (this.shouldReconnect) {
                    this.reconnect();
                }
            }
        } else {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
                this.log('WebSocket接続なし - ハートビート停止', 'info');
            }
        }
    }

    updatePresence(status = 'online', activity = null) {
        this.currentStatus = status;
        this.currentActivity = activity;

        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            this.log('Discord未接続のため、設定を保存しました（接続後に適用されます）', 'warn');
            return false;
        }

        try {
            this.websocket.send(JSON.stringify({
                op: 3,
                d: {
                    status: status,
                    since: status === 'idle' ? Date.now() : null,
                    activities: activity ? [activity] : [],
                    afk: status === 'idle'
                }
            }));
            
            this.log(`プレゼンス更新: ${status}, アクティビティ: ${activity ? activity.name : 'なし'}`);
            return true;
        } catch (error) {
            this.log(`プレゼンス更新エラー: ${error.message}`, 'error');
            return false;
        }
    }

    reconnect() {
        if (this.token) {
            setTimeout(() => {
                this.connect(this.token);
            }, 1000);
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        
        if (this.websocket) {
            this.websocket.close();
        }
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.log('Discord接続を終了しました');
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            user: this.user,
            currentStatus: this.currentStatus,
            currentActivity: this.currentActivity
        };
    }
}

module.exports = DiscordBot;
