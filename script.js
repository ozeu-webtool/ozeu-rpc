class DiscordActivityManager {
    constructor() {
        this.isConnected = false;
        this.user = null;
        this.sessionId = null;
        this.currentStatus = 'online';
        this.currentActivity = null;
        
        this.initializeElements();
        this.bindEvents();
        this.startKeepAlive();
    }

    initializeElements() {
        this.elements = {
            userToken: document.getElementById('userToken'),
            connectBtn: document.getElementById('connectBtn'),
            connectionStatus: document.getElementById('connectionStatus'),
            username: document.getElementById('username'),
            userStatus: document.getElementById('userStatus'),
            activity: document.getElementById('activity'),
            activityDisplay: document.getElementById('activityDisplay'),
            activityCard: document.getElementById('activityCard'),
            activityIcon: document.getElementById('activityIcon'),
            activityType: document.getElementById('activityType'),
            activityName: document.getElementById('activityName'),
            activityDetails: document.getElementById('activityDetails'),
            logContainer: document.getElementById('logContainer'),
            clearLogs: document.getElementById('clearLogs'),
            
            customActivityName: document.getElementById('customActivityName'),
            customActivityDetails: document.getElementById('customActivityDetails'),
            customActivityState: document.getElementById('customActivityState'),
            activityTypeSelect: document.getElementById('activityTypeSelect'),
            statusSelect: document.getElementById('statusSelect'),
            
            setActivityBtn: document.getElementById('setActivityBtn'),
            clearActivityBtn: document.getElementById('clearActivityBtn'),
            setStatusBtn: document.getElementById('setStatusBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            ozeuModeBtn: document.getElementById('ozeuModeBtn')
        };
    }

    bindEvents() {
        this.elements.connectBtn.addEventListener('click', () => {
            const token = this.elements.userToken.value.trim();
            if (token) {
                this.connectToDiscord(token);
            } else {
                this.addLog('エラー: トークンを入力してください', 'error');
            }
        });

        this.elements.userToken.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.elements.connectBtn.click();
            }
        });

        this.elements.clearLogs.addEventListener('click', () => {
            this.elements.logContainer.innerHTML = '';
        });

        if (this.elements.setActivityBtn) {
            this.elements.setActivityBtn.addEventListener('click', () => {
                this.setCustomActivity();
            });
        }

        if (this.elements.clearActivityBtn) {
            this.elements.clearActivityBtn.addEventListener('click', () => {
                this.clearActivity();
            });
        }

        if (this.elements.setStatusBtn) {
            this.elements.setStatusBtn.addEventListener('click', () => {
                this.setStatus();
            });
        }

        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.addEventListener('click', () => {
                this.disconnect();
            });
        }

        if (this.elements.ozeuModeBtn) {
            this.elements.ozeuModeBtn.addEventListener('click', () => {
                this.setOzeuMode();
            });
        }
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logElement = document.createElement('div');
        logElement.className = `log-message ${type}`;
        logElement.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
        
        this.elements.logContainer.appendChild(logElement);
        this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
    }

    updateConnectionStatus(message, type = 'info') {
        this.elements.connectionStatus.textContent = message;
        this.elements.connectionStatus.className = `status-indicator ${type}`;
    }

    async connectToDiscord(token) {
        this.addLog('サーバーに接続中...');
        this.updateConnectionStatus('接続中...', 'connecting');

        try {
            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token,
                    sessionId: this.sessionId
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.sessionId = result.sessionId;
                this.addLog(result.message);
                this.updateConnectionStatus('接続中...', 'connecting');
                
                setTimeout(() => this.checkStatus(), 1000);
            } else {
                this.addLog(result.error, 'error');
                this.updateConnectionStatus('エラー', 'error');
            }
        } catch (error) {
            this.addLog('サーバーへの接続に失敗しました', 'error');
            this.updateConnectionStatus('エラー', 'error');
        }
    }

    async checkStatus() {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`/api/status?sessionId=${this.sessionId}`);
            const result = await response.json();

            if (result.isConnected) {
                this.isConnected = true;
                this.user = result.user;
                this.updateConnectionStatus('接続済み', 'success');
                this.elements.username.textContent = `${result.user.username}#${result.user.discriminator}`;
                
                if (result.currentActivity) {
                    this.displayActivity(result.currentActivity);
                }
                
                this.updateUserStatus(result.currentStatus);
                this.showConnectedSections();
            } else {
                this.updateConnectionStatus('接続中...', 'connecting');
                setTimeout(() => this.checkStatus(), 3000);
            }
        } catch (error) {
            this.addLog('ステータス取得に失敗しました', 'error');
            setTimeout(() => this.checkStatus(), 5000);
        }
    }

    showConnectedSections() {
        document.getElementById('userInfo').style.display = 'block';
        document.getElementById('activitySection').style.display = 'block';
        document.getElementById('logSection').style.display = 'block';
    }

    startKeepAlive() {
        setInterval(async () => {
            if (this.isConnected) {
                await this.checkStatus();
            }
        }, 30000);

        setInterval(() => {
            fetch('/api/status?sessionId=keepalive').catch(() => {});
        }, 25000);
    }

    updateUserStatus(status) {
        this.elements.userStatus.textContent = this.getStatusText(status);
        this.elements.userStatus.className = `user-status status-${status}`;
    }

    displayActivity(activity) {
        const typeText = this.getActivityTypeText(activity.type);
        const iconText = this.getActivityIcon(activity.type);
        
        this.elements.activityIcon.textContent = iconText;
        this.elements.activityType.textContent = typeText;
        this.elements.activityName.textContent = activity.name || '-';
        
        let details = '';
        if (activity.details) {
            details += activity.details;
        }
        if (activity.state) {
            if (details) details += ' - ';
            details += activity.state;
        }
        
        this.elements.activityDetails.textContent = details || '-';
        this.elements.activity.textContent = `${typeText} ${activity.name}`;
        this.elements.activityDisplay.style.display = 'block';
    }

    clearActivityDisplay() {
        this.elements.activity.textContent = 'アクティビティなし';
        this.elements.activityDisplay.style.display = 'none';
    }

    getStatusText(status) {
        const statusTexts = {
            online: 'オンライン',
            idle: '離席中',
            dnd: '取り込み中',
            offline: 'オフライン',
            invisible: 'オフライン'
        };
        return statusTexts[status] || status;
    }

    getActivityTypeText(type) {
        const typeTexts = {
            0: 'プレイ中',
            1: 'ストリーミング',
            2: '聞いている',
            3: '視聴中',
            5: '競技中'
        };
        return typeTexts[type] || '不明';
    }

    getActivityIcon(type) {
        const icons = {
            0: '🎮',
            1: '📺',
            2: '🎵',
            3: '👀',
            5: '🏆'
        };
        return icons[type] || '❓';
    }

    async setCustomActivity() {
        const name = this.elements.customActivityName.value.trim();
        const details = this.elements.customActivityDetails.value.trim();
        const state = this.elements.customActivityState.value.trim();
        const type = parseInt(this.elements.activityTypeSelect.value);
        const status = this.elements.statusSelect.value;

        if (!name) {
            this.addLog('エラー: アクティビティ名を入力してないなぁ、そうに決まってる', 'error');
            return;
        }

        const activity = { name, type };
        if (details) activity.details = details;
        if (state) activity.state = state;

        try {
            const response = await fetch('/api/set-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity: activity,
                    status: status,
                    sessionId: this.sessionId
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.addLog(result.message);
                this.currentActivity = activity;
                this.currentStatus = status;
            } else {
                this.addLog(result.error, 'error');
            }
        } catch (error) {
            this.addLog('アクティビティの設定に失敗しました', 'error');
        }
    }

    async setOzeuMode() {
        const ozeuActivity = {
            name: 'ozeu.site',
            type: 0, 
            details: 'ozeu allied forceをプレイ中...',
            state: 'おぜうの兵士として忠誠を誓います！'
        };

        try {
            const response = await fetch('/api/set-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity: ozeuActivity,
                    status: 'online',
                    sessionId: this.sessionId
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.addLog('ozeu派を設定したなぁ、そうに決まってる', 'success');
                this.currentActivity = ozeuActivity;
                this.currentStatus = 'online';
                this.displayActivity(ozeuActivity);
            } else {
                this.addLog(result.error, 'error');
            }
        } catch (error) {
            this.addLog('ozeu派の設定に失敗したなぁ、そうに決まってる', 'error');
        }
    }

    async clearActivity() {
        const status = this.elements.statusSelect.value;

        try {
            const response = await fetch('/api/clear-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: status,
                    sessionId: this.sessionId
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.addLog(result.message);
                this.currentActivity = null;
                this.currentStatus = status;
                this.clearActivityDisplay();
            } else {
                this.addLog(result.error, 'error');
            }
        } catch (error) {
            this.addLog('アクティビティのクリアに失敗しました', 'error');
        }
    }

    async setStatus() {
        const status = this.elements.statusSelect.value;

        try {
            const response = await fetch('/api/set-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: status,
                    sessionId: this.sessionId
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.addLog(result.message);
                this.currentStatus = status;
                this.updateUserStatus(status);
            } else {
                this.addLog(result.error, 'error');
            }
        } catch (error) {
            this.addLog('ステータスの変更に失敗しました', 'error');
        }
    }

    async disconnect() {
        try {
            const response = await fetch('/api/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId })
            });

            const result = await response.json();

            if (response.ok) {
                this.addLog(result.message);
                this.isConnected = false;
                this.user = null;
                this.updateConnectionStatus('切断済み', 'error');
                this.elements.username.textContent = '-';
                this.elements.userStatus.textContent = '-';
                this.clearActivityDisplay();
                this.sessionId = null;

                document.getElementById('userInfo').style.display = 'none';
                document.getElementById('activitySection').style.display = 'none';
                document.getElementById('logSection').style.display = 'none';
            } else {
                this.addLog(result.error, 'error');
            }
        } catch (error) {
            this.addLog('切断に失敗しました', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DiscordActivityManager();
});
