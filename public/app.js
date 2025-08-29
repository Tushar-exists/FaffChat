class ChatApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.selectedUser = null;
        this.users = [];
        this.messages = [];
        this.typingTimeout = null;
        
        this.initializeElements();
        this.bindEvents();
        this.checkAuth();
    }

    initializeElements() {
        // Auth elements
        this.authScreen = document.getElementById('auth-screen');
        this.chatScreen = document.getElementById('chat-screen');
        this.loginForm = document.getElementById('login-form');
        this.signupForm = document.getElementById('signup-form');
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.authError = document.getElementById('auth-error');

        // Chat elements
        this.currentUserName = document.getElementById('current-user-name');
        this.logoutBtn = document.getElementById('logout-btn');
        this.usersContainer = document.getElementById('users-container');
        this.messagesList = document.getElementById('messages-list');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.chatUserName = document.getElementById('chat-user-name');
        this.chatUserStatus = document.getElementById('chat-user-status');
        this.typingIndicator = document.getElementById('typing-indicator');

        // Search elements
        this.searchInput = document.getElementById('search-input');
        this.searchBtn = document.getElementById('search-btn');
        this.searchResults = document.querySelector('.search-results');
        this.searchResultsContainer = document.getElementById('search-results-container');
    }

    bindEvents() {
        // Auth events
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        this.logoutBtn.addEventListener('click', () => this.handleLogout());

        // Chat events
        this.messageInput.addEventListener('input', () => this.handleTyping());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // Search events
        this.searchBtn.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
    }

    switchTab(tab) {
        this.tabBtns.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        if (tab === 'login') {
            this.loginForm.classList.remove('hidden');
            this.signupForm.classList.add('hidden');
        } else {
            this.loginForm.classList.add('hidden');
            this.signupForm.classList.remove('hidden');
        }
        this.hideError();
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.setAuthToken(data.token);
                this.currentUser = data.user;
                this.showChat();
                this.initializeSocket();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Login failed. Please try again.');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.setAuthToken(data.token);
                this.currentUser = data.user;
                this.showChat();
                this.initializeSocket();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Signup failed. Please try again.');
        }
    }

    handleLogout() {
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.selectedUser = null;
        this.users = [];
        this.messages = [];
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.showAuth();
    }

    setAuthToken(token) {
        localStorage.setItem('authToken', token);
    }

    getAuthToken() {
        return localStorage.getItem('authToken');
    }

    checkAuth() {
        const token = this.getAuthToken();
        if (token) {
            this.validateToken(token);
        } else {
            this.showAuth();
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch('/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.showChat();
                this.initializeSocket();
            } else {
                localStorage.removeItem('authToken');
                this.showAuth();
            }
        } catch (error) {
            localStorage.removeItem('authToken');
            this.showAuth();
        }
    }

    showAuth() {
        this.authScreen.classList.remove('hidden');
        this.chatScreen.classList.add('hidden');
    }

    showChat() {
        this.authScreen.classList.add('hidden');
        this.chatScreen.classList.remove('hidden');
        this.currentUserName.textContent = this.currentUser.name;
        this.loadUsers();
    }

    initializeSocket() {
        this.socket = io();
        const token = this.getAuthToken();

        this.socket.emit('authenticate', token);

        this.socket.on('authenticated', (data) => {
            // Sync online state for current user
            this.updateUserStatus(this.currentUser.id, 'online');
            // Ask server for who is online (if supported in future)
        });

        this.socket.on('new_message', (message) => {
            this.addMessage(message);
        });

        this.socket.on('user_typing', (data) => {
            if (data.userId === this.selectedUser?.id) {
                this.showTypingIndicator();
            }
        });

        this.socket.on('user_stop_typing', (data) => {
            if (data.userId === this.selectedUser?.id) {
                this.hideTypingIndicator();
            }
        });

        this.socket.on('user_online', (data) => {
            this.updateUserStatus(data.userId, 'online');
        });

        this.socket.on('user_offline', (data) => {
            this.updateUserStatus(data.userId, 'offline');
        });
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${this.getAuthToken()}` }
            });

            if (response.ok) {
                this.users = await response.json();
                this.renderUsers();
            }
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    renderUsers() {
        this.usersContainer.innerHTML = '';
        
        this.users.forEach(user => {
            if (user.id !== this.currentUser.id) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.dataset.userId = user.id;
                
                userElement.innerHTML = `
                    <div class="avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <h4>${user.name}</h4>
                        <span class="status">Offline</span>
                    </div>
                `;
                
                userElement.addEventListener('click', () => this.selectUser(user));
                this.usersContainer.appendChild(userElement);
            }
        });
    }

    selectUser(user) {
        this.selectedUser = user;
        
        // Update UI
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const userElement = document.querySelector(`[data-user-id="${user.id}"]`);
        if (userElement) {
            userElement.classList.add('active');
        }
        
        this.chatUserName.textContent = user.name;
        // Do not force Online; default unknown until server events arrive
        this.chatUserStatus.textContent = 'Offline';
        this.chatUserStatus.className = 'status offline';
        
        // Enable message input
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;
        this.messageInput.focus();
        
        // Load conversation
        this.loadConversation(user.id);
    }

    async loadConversation(userId) {
        try {
            const response = await fetch(`/api/conversation/${userId}`, {
                headers: { 'Authorization': `Bearer ${this.getAuthToken()}` }
            });

            if (response.ok) {
                this.messages = await response.json();
                this.renderMessages();
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
        }
    }

    renderMessages() {
        this.messagesList.innerHTML = '';
        
        this.messages.forEach(message => {
            this.addMessage(message);
        });
        
        this.scrollToBottom();
    }

    addMessage(message) {
        const messageElement = document.createElement('div');
        const isSent = message.sender_id === this.currentUser.id;
        
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const time = new Date(message.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageElement.innerHTML = `
            <div class="message-content">
                <div>${this.escapeHtml(message.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        this.messagesList.appendChild(messageElement);
        this.scrollToBottom();
    }

    async sendMessage() {
        if (!this.selectedUser || !this.messageInput.value.trim()) return;

        const message = this.messageInput.value.trim();
        this.messageInput.value = '';

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    receiverId: this.selectedUser.id,
                    message: message
                })
            });

            if (response.ok) {
                const newMessage = await response.json();
                this.addMessage(newMessage);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    handleTyping() {
        if (!this.selectedUser) return;

        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        this.socket.emit('typing', { userId: this.selectedUser.id });

        this.typingTimeout = setTimeout(() => {
            this.socket.emit('stop_typing', { userId: this.selectedUser.id });
        }, 1000);
    }

    showTypingIndicator() {
        this.typingIndicator.classList.remove('hidden');
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        try {
            // Show a lightweight loading state
            this.searchBtn.disabled = true;
            this.searchBtn.textContent = 'Searching…';

            const response = await fetch(`/api/semantic-search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${this.getAuthToken()}` }
            });

            if (!response.ok) {
                let details = '';
                try {
                    const err = await response.json();
                    details = err && (err.error || err.message) ? `: ${err.error || err.message}` : '';
                } catch (_) {}
                this.searchResults.classList.remove('hidden');
                this.searchResultsContainer.innerHTML = `<p>Search failed${this.escapeHtml(details)}</p>`;
                return;
            }

            const results = await response.json();
            this.renderSearchResults(results);
        } catch (error) {
            this.searchResults.classList.remove('hidden');
            this.searchResultsContainer.innerHTML = `<p>Search failed. Please try again.</p>`;
        }
        finally {
            this.searchBtn.disabled = false;
            this.searchBtn.textContent = 'Search';
        }
    }

    renderSearchResults(results) {
        this.searchResults.classList.remove('hidden');
        this.searchResultsContainer.innerHTML = '';

        if (results.length === 0) {
            this.searchResultsContainer.innerHTML = '<p>No results found</p>';
            return;
        }

        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'search-result-item';
            
            const time = new Date(result.created_at).toLocaleString();
            const raw = typeof result.similarity_score === 'number' ? result.similarity_score : 0;
            const clamped = Math.max(0, Math.min(1, raw));
            const score = Math.round(clamped * 100);
            
            resultElement.innerHTML = `
                <div class="message-preview">${this.escapeHtml(result.message)}</div>
                <div class="message-meta">
                    <span>From: ${result.sender_name}</span>
                    <span>${time}</span>
                    <span class="similarity-score">${score}% match</span>
                </div>
            `;
            
            resultElement.addEventListener('click', () => {
                // Find and select the user who sent this message
                const user = this.users.find(u => u.id === result.sender_id);
                if (user) {
                    this.selectUser(user);
                    this.searchResults.classList.add('hidden');
                }
            });
            
            this.searchResultsContainer.appendChild(resultElement);
        });
    }

    updateUserStatus(userId, status) {
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            const statusElement = userElement.querySelector('.status');
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusElement.className = `status ${status}`;
        }

        if (this.selectedUser && this.selectedUser.id === userId) {
            this.chatUserStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            this.chatUserStatus.className = `status ${status}`;
        }
    }

    scrollToBottom() {
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    showError(message) {
        this.authError.textContent = message;
        this.authError.classList.remove('hidden');
    }

    hideError() {
        this.authError.classList.add('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});

