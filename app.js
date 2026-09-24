/**
 * DocVerse AI - Frontend Client Architecture
 * Connects to Render Cloud Backend or local gemini-web2api server
 */

// ─── Configuration & State ───────────────────────────────────────────
function getInitialBackendUrl() {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('file:')) {
      // If served directly from local backend or dev server:
      if (origin.includes('localhost:8081') || origin.includes('127.0.0.1:8081')) {
        return origin;
      }
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return "http://localhost:8081";
      }
      // If deployed on Render or cloud domain:
      return origin;
    }
  }
  return "https://docverse-ai-backend.onrender.com";
}

const DEFAULT_CONFIG = {
  serverUrl: getInitialBackendUrl(),
  apiKey: "sk-gemini",
  systemPrompt: "You are DocVerse AI, an intelligent, precise, and articulate AI studio assistant. Assist the user with document workflows, analysis, coding, and strategic problem-solving.",
  stream: true,
  thinkingDepth: "auto"
};

let config = { ...DEFAULT_CONFIG };
let currentSessionId = null;
let sessions = [];
let abortController = null;
let pendingAttachment = null; // { type: 'image'|'file', data: base64/text, name: string }

// ─── DOM Elements ───────────────────────────────────────────────────
const elements = {
  sidebar: document.getElementById('sidebar'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  chatList: document.getElementById('chatList'),
  clearAllChatsBtn: document.getElementById('clearAllChatsBtn'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusLatency: document.getElementById('statusLatency'),
  headerStatusPill: document.getElementById('headerStatusPill'),
  modelSelect: document.getElementById('modelSelect'),
  thinkBadge: document.getElementById('thinkBadge'),
  chatFeed: document.getElementById('chatFeed'),
  welcomeContainer: document.getElementById('welcomeContainer'),
  messagesList: document.getElementById('messagesList'),
  chatForm: document.getElementById('chatForm'),
  promptInput: document.getElementById('promptInput'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  charCount: document.getElementById('charCount'),
  attachBtn: document.getElementById('attachBtn'),
  fileInput: document.getElementById('fileInput'),
  attachmentBar: document.getElementById('attachmentBar'),
  attachmentPreview: document.getElementById('attachmentPreview'),
  removeAttachmentBtn: document.getElementById('removeAttachmentBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  // Modal Elements
  settingsModal: document.getElementById('settingsModal'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  resetConfigBtn: document.getElementById('resetConfigBtn'),
  serverUrlInput: document.getElementById('serverUrlInput'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  systemPromptInput: document.getElementById('systemPromptInput'),
  streamToggle: document.getElementById('streamToggle'),
  thinkingDepthSelect: document.getElementById('thinkingDepthSelect')
};

// ─── Markdown Renderer Setup ─────────────────────────────────────────
if (window.marked) {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function (code, lang) {
      if (window.hljs) {
        const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language: validLang }).value;
      }
      return code;
    }
  });
}

// ─── Initialization ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadSessions();
  setupEventListeners();
  checkBackendHealth();
  fetchAvailableModels();

  // Poll backend health every 12 seconds
  setInterval(checkBackendHealth, 12000);
});

// ─── Local Storage & Settings ────────────────────────────────────────
function loadConfig() {
  const saved = localStorage.getItem('docverse_config');
  if (saved) {
    try {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Failed to parse saved config", e);
    }
  }
  syncSettingsModal();
}

function saveConfig() {
  config.serverUrl = elements.serverUrlInput.value.trim().replace(/\/+$/, '') || DEFAULT_CONFIG.serverUrl;
  config.apiKey = elements.apiKeyInput.value.trim() || DEFAULT_CONFIG.apiKey;
  config.systemPrompt = elements.systemPromptInput.value.trim();
  config.stream = elements.streamToggle.checked;
  config.thinkingDepth = elements.thinkingDepthSelect.value;

  localStorage.setItem('docverse_config', JSON.stringify(config));
  closeModal();
  checkBackendHealth();
  fetchAvailableModels();
}

function syncSettingsModal() {
  elements.serverUrlInput.value = config.serverUrl;
  elements.apiKeyInput.value = config.apiKey;
  elements.systemPromptInput.value = config.systemPrompt;
  elements.streamToggle.checked = config.stream;
  elements.thinkingDepthSelect.value = config.thinkingDepth;
}

// ─── Backend Connectivity & Health Check ─────────────────────────────
async function checkBackendHealth() {
  const startTime = performance.now();
  try {
    const res = await fetch(`${config.serverUrl}/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3500)
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json();
      setConnectionStatus(true, `Active (v${data.version || '1.1'})`, `${elapsed}ms`);
    } else {
      setConnectionStatus(false, `HTTP ${res.status}`, `${elapsed}ms`);
    }
  } catch (err) {
    setConnectionStatus(false, 'Offline / Starting...', '-- ms');
  }
}

function setConnectionStatus(isConnected, message, latency) {
  const modelsLink = document.getElementById('modelsLink');
  if (modelsLink && config.serverUrl) {
    const base = config.serverUrl.replace(/\/+$/, '');
    modelsLink.href = `${base}/v1/models`;
  }

  if (isConnected) {
    elements.statusDot.className = "status-dot connected";
    elements.statusText.textContent = `Backend: ${message}`;
    elements.statusLatency.textContent = latency;
    elements.headerStatusPill.innerHTML = `<span class="status-dot connected"></span><span class="pill-text">AI Engine Active (${latency})</span>`;
  } else {
    elements.statusDot.className = "status-dot error";
    elements.statusText.textContent = `Backend: ${message}`;
    elements.statusLatency.textContent = latency;
    elements.headerStatusPill.innerHTML = `<span class="status-dot error"></span><span class="pill-text">Backend Offline</span>`;
  }
}

async function fetchAvailableModels() {
  try {
    const res = await fetch(`${config.serverUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        populateModelDropdown(data.data);
      }
    }
  } catch (e) {
    console.warn("Could not load dynamic models from backend, using defaults.", e);
  }
}

function populateModelDropdown(modelsList) {
  const currentVal = elements.modelSelect.value;
  elements.modelSelect.innerHTML = '';

  modelsList.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.id} ${m.description ? '· ' + m.description : ''}`;
    elements.modelSelect.appendChild(opt);
  });

  // Preserve previous choice if exists
  if (Array.from(elements.modelSelect.options).some(o => o.value === currentVal)) {
    elements.modelSelect.value = currentVal;
  }
}

// ─── Sessions & Chat History ─────────────────────────────────────────
function loadSessions() {
  const stored = localStorage.getItem('docverse_sessions');
  if (stored) {
    try {
      sessions = JSON.parse(stored);
    } catch (e) {
      sessions = [];
    }
  }

  if (sessions.length === 0) {
    createNewSession(false);
  } else {
    currentSessionId = sessions[0].id;
    renderSidebarChats();
    renderActiveSessionMessages();
  }
}

function saveSessions() {
  localStorage.setItem('docverse_sessions', JSON.stringify(sessions));
  renderSidebarChats();
}

function createNewSession(switchImmediately = true) {
  const newSession = {
    id: 'session_' + Date.now(),
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    messages: []
  };

  sessions.unshift(newSession);
  saveSessions();

  if (switchImmediately) {
    switchSession(newSession.id);
  }
}

function switchSession(id) {
  if (abortController) {
    abortController.abort();
    abortController = null;
    setIsStreaming(false);
  }

  currentSessionId = id;
  renderSidebarChats();
  renderActiveSessionMessages();
  elements.promptInput.focus();
}

function getCurrentSession() {
  return sessions.find(s => s.id === currentSessionId) || sessions[0];
}

function deleteSession(id, event) {
  if (event) event.stopPropagation();
  sessions = sessions.filter(s => s.id !== id);
  if (sessions.length === 0) {
    createNewSession(true);
  } else {
    if (currentSessionId === id) {
      currentSessionId = sessions[0].id;
    }
    saveSessions();
    renderActiveSessionMessages();
  }
}

function renderSidebarChats() {
  elements.chatList.innerHTML = '';
  sessions.forEach(sess => {
    const item = document.createElement('div');
    item.className = `chat-item ${sess.id === currentSessionId ? 'active' : ''}`;
    item.onclick = () => switchSession(sess.id);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-item-text';
    titleSpan.textContent = sess.title || 'Conversation';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chat-item-delete';
    deleteBtn.title = 'Delete chat';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => deleteSession(sess.id, e);

    item.appendChild(titleSpan);
    item.appendChild(deleteBtn);
    elements.chatList.appendChild(item);
  });
}

function renderActiveSessionMessages() {
  const sess = getCurrentSession();
  elements.messagesList.innerHTML = '';

  if (!sess || sess.messages.length === 0) {
    elements.welcomeContainer.style.display = 'flex';
    elements.messagesList.style.display = 'none';
  } else {
    elements.welcomeContainer.style.display = 'none';
    elements.messagesList.style.display = 'flex';

    sess.messages.forEach(msg => {
      appendMessageToDOM(msg.role, msg.content, msg.thinking, msg.stats, msg.attachment, false);
    });
    scrollToBottom();
  }
}

// ─── Chat Messaging Logic ────────────────────────────────────────────
async function handleSendMessage(promptText) {
  const text = (promptText || elements.promptInput.value).trim();
  if (!text && !pendingAttachment) return;

  const session = getCurrentSession();
  const attachment = pendingAttachment;

  // Clear inputs
  elements.promptInput.value = '';
  elements.promptInput.style.height = 'auto';
  elements.charCount.textContent = '0 chars';
  clearAttachment();

  // Switch from welcome to chat list
  elements.welcomeContainer.style.display = 'none';
  elements.messagesList.style.display = 'flex';

  // Append user message
  const userMsg = {
    role: 'user',
    content: text,
    attachment: attachment,
    timestamp: new Date().toISOString()
  };

  session.messages.push(userMsg);
  if (session.messages.length === 1 && text) {
    session.title = text.slice(0, 36) + (text.length > 36 ? '...' : '');
  }
  saveSessions();

  appendMessageToDOM('user', text, null, null, attachment, true);
  scrollToBottom();

  // Prepare payload
  let selectedModel = elements.modelSelect.value;
  if (config.thinkingDepth !== 'auto') {
    selectedModel = `${selectedModel}@think=${config.thinkingDepth}`;
  }

  // Construct message history for OpenAI-compatible endpoint
  const apiMessages = [];
  if (config.systemPrompt) {
    apiMessages.push({ role: 'system', content: config.systemPrompt });
  }

  session.messages.forEach(m => {
    if (m.attachment && m.attachment.type === 'image') {
      apiMessages.push({
        role: m.role,
        content: [
          { type: 'text', text: m.content || 'Attached image:' },
          { type: 'image_url', image_url: { url: m.attachment.data } }
        ]
      });
    } else {
      apiMessages.push({ role: m.role, content: m.content });
    }
  });

  // Prepare AI Response message in DOM
  const aiMessageBubble = appendMessageToDOM('assistant', '', null, null, null, true);
  scrollToBottom();
  setIsStreaming(true);

  abortController = new AbortController();
  const startTime = performance.now();

  try {
    const payload = {
      model: selectedModel,
      messages: apiMessages,
      stream: config.stream
    };

    const response = await fetch(`${config.serverUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Server responded with ${response.status}`);
    }

    let fullText = '';
    let thinkingText = '';

    if (config.stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          if (trimmed === 'data: [DONE]') break;

          const dataStr = trimmed.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              if (delta.reasoning_content) {
                thinkingText += delta.reasoning_content;
              }
              if (delta.content) {
                fullText += delta.content;
              }
              updateAIMessageDOM(aiMessageBubble, fullText, thinkingText, true);
              scrollToBottom();
            }
          } catch (e) {
            // Partial JSON chunk, continue
          }
        }
      }
    } else {
      const result = await response.json();
      fullText = result.choices?.[0]?.message?.content || '';
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    const stats = `${elapsed}s · ${selectedModel.split('@')[0]}`;

    // Finalize DOM and store in session
    updateAIMessageDOM(aiMessageBubble, fullText, thinkingText, false, stats);

    session.messages.push({
      role: 'assistant',
      content: fullText,
      thinking: thinkingText,
      stats: stats,
      timestamp: new Date().toISOString()
    });
    saveSessions();

  } catch (err) {
    if (err.name === 'AbortError') {
      updateAIMessageDOM(aiMessageBubble, (aiMessageBubble._text || '') + '\n\n*(Generation stopped)*', null, false, 'Stopped');
    } else {
      updateAIMessageDOM(aiMessageBubble, `❌ **Error connecting to DocVerse Backend:**\n\`${err.message}\`\n\n*Make sure \`gemini_web2api.py\` is running on port 8081 and has active internet access.*`, null, false, 'Failed');
    }
  } finally {
    setIsStreaming(false);
    abortController = null;
    scrollToBottom();
  }
}

// ─── DOM Message Builders ───────────────────────────────────────────
function appendMessageToDOM(role, text, thinking, stats, attachment, animate) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role === 'user' ? 'user-avatar' : 'ai-avatar'}`;
  if (role === 'user') {
    avatar.textContent = 'U';
  } else {
    avatar.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><circle cx="12" cy="14" r="2" fill="currentColor"></circle></svg>`;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'message-content-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble._text = text;

  // Attached image if user message
  if (attachment && attachment.type === 'image') {
    const img = document.createElement('img');
    img.src = attachment.data;
    img.className = 'user-attached-img';
    bubble.appendChild(img);
  }

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'bubble-body';
  bubble.appendChild(bodyDiv);

  wrapper.appendChild(bubble);

  // Meta stats bar
  const metaBar = document.createElement('div');
  metaBar.className = 'message-meta';
  metaBar.innerHTML = `<span class="meta-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;

  if (role === 'assistant') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-chip';
    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(bubble._text || text);
      copyBtn.innerHTML = '✓ Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
      }, 1800);
    };

    actions.appendChild(copyBtn);
    metaBar.appendChild(actions);
  }

  wrapper.appendChild(metaBar);

  row.appendChild(avatar);
  row.appendChild(wrapper);

  elements.messagesList.appendChild(row);

  if (text || thinking) {
    updateAIMessageDOM(bubble, text, thinking, false, stats);
  }

  return bubble;
}

function updateAIMessageDOM(bubble, text, thinking, isStreaming, stats) {
  bubble._text = text;
  const bodyDiv = bubble.querySelector('.bubble-body') || bubble;

  let html = '';

  // Thinking collapsible accordion
  if (thinking && thinking.trim()) {
    html += `
      <details class="thinking-box" ${isStreaming ? 'open' : ''}>
        <summary>🧠 Neural Reasoning (${Math.round(thinking.length / 4)} tokens)</summary>
        <div class="thinking-content">${escapeHTML(thinking)}</div>
      </details>
    `;
  }

  if (text) {
    if (window.marked) {
      html += marked.parse(text);
    } else {
      html += `<p>${escapeHTML(text).replace(/\n/g, '<br>')}</p>`;
    }
  }

  if (isStreaming) {
    html += `<span class="cursor-blink"></span>`;
  }

  bodyDiv.innerHTML = html;

  // Enhance Code Blocks with Copy Button
  bodyDiv.querySelectorAll('pre code').forEach((block) => {
    const pre = block.parentElement;
    if (!pre.parentElement.classList.contains('code-block-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-header';
      const lang = block.className.replace(/language-/, '') || 'code';
      header.innerHTML = `<span>${lang}</span>`;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-code-btn';
      copyBtn.innerHTML = 'Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(block.innerText);
        copyBtn.innerText = 'Copied!';
        setTimeout(() => copyBtn.innerText = 'Copy', 2000);
      };

      header.appendChild(copyBtn);
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    }
  });

  // Update Stats in meta bar
  if (stats) {
    const metaBar = bubble.closest('.message-content-wrapper')?.querySelector('.message-meta');
    if (metaBar) {
      let statsSpan = metaBar.querySelector('.meta-stats');
      if (!statsSpan) {
        statsSpan = document.createElement('span');
        statsSpan.className = 'meta-stats';
        metaBar.insertBefore(statsSpan, metaBar.firstChild);
      }
      statsSpan.textContent = `⚡ ${stats} · `;
    }
  }
}

// ─── Attachments Handling ─────────────────────────────────────────────
function setupAttachmentHandlers() {
  elements.attachBtn.addEventListener('click', () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
      reader.onload = () => {
        pendingAttachment = {
          type: 'image',
          data: reader.result,
          name: file.name
        };
        renderAttachmentPreview();
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        pendingAttachment = {
          type: 'file',
          data: reader.result,
          name: file.name
        };
        renderAttachmentPreview();
      };
      reader.readAsText(file);
    }
  });

  elements.removeAttachmentBtn.addEventListener('click', clearAttachment);
}

function renderAttachmentPreview() {
  if (!pendingAttachment) {
    elements.attachmentBar.style.display = 'none';
    return;
  }

  elements.attachmentBar.style.display = 'flex';
  if (pendingAttachment.type === 'image') {
    elements.attachmentPreview.innerHTML = `
      <img src="${pendingAttachment.data}" alt="Preview">
      <span>${escapeHTML(pendingAttachment.name)}</span>
    `;
  } else {
    elements.attachmentPreview.innerHTML = `
      <span>📄 ${escapeHTML(pendingAttachment.name)}</span>
    `;
  }
}

function clearAttachment() {
  pendingAttachment = null;
  elements.fileInput.value = '';
  elements.attachmentBar.style.display = 'none';
  elements.attachmentPreview.innerHTML = '';
}

// ─── UI Helpers & Event Listeners ────────────────────────────────────
function setupEventListeners() {
  // Sidebar toggles
  elements.toggleSidebarBtn.addEventListener('click', () => {
    elements.sidebar.classList.toggle('closed');
  });

  elements.closeSidebarBtn.addEventListener('click', () => {
    elements.sidebar.classList.add('closed');
  });

  elements.newChatBtn.addEventListener('click', () => {
    createNewSession(true);
  });

  elements.clearAllChatsBtn.addEventListener('click', () => {
    if (confirm("Delete all chat conversations?")) {
      sessions = [];
      createNewSession(true);
    }
  });

  // Prompt Form submission
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Textarea auto-height & keybindings
  elements.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  elements.promptInput.addEventListener('input', () => {
    elements.promptInput.style.height = 'auto';
    elements.promptInput.style.height = Math.min(elements.promptInput.scrollHeight, 180) + 'px';
    elements.charCount.textContent = `${elements.promptInput.value.length} chars`;
  });

  // Global shortcut Ctrl+K for new chat
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      createNewSession(true);
    }
  });

  // Stop generation button
  elements.stopBtn.addEventListener('click', () => {
    if (abortController) {
      abortController.abort();
    }
  });

  // Clear Chat in active view
  elements.clearChatBtn.addEventListener('click', () => {
    const session = getCurrentSession();
    if (session && confirm("Clear all messages in this conversation?")) {
      session.messages = [];
      saveSessions();
      renderActiveSessionMessages();
    }
  });

  // Export conversation
  elements.exportChatBtn.addEventListener('click', exportActiveConversation);

  // Quick Starter Cards
  document.querySelectorAll('.quick-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      handleSendMessage(prompt);
    });
  });

  // Settings Modal Controls
  elements.openSettingsBtn.addEventListener('click', openModal);
  elements.closeSettingsBtn.addEventListener('click', closeModal);
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeModal();
  });
  elements.saveConfigBtn.addEventListener('click', saveConfig);
  elements.resetConfigBtn.addEventListener('click', () => {
    config = { ...DEFAULT_CONFIG };
    syncSettingsModal();
    saveConfig();
  });

  // Thinking badge info
  elements.thinkingDepthSelect.addEventListener('change', (e) => {
    const depth = e.target.value;
    elements.thinkBadge.textContent = depth === 'auto' ? '⚡ Thinking Auto' : `🧠 Think @${depth}`;
  });

  setupAttachmentHandlers();
}

function setIsStreaming(streaming) {
  elements.sendBtn.style.display = streaming ? 'none' : 'flex';
  elements.stopBtn.style.display = streaming ? 'flex' : 'none';
  elements.sendBtn.disabled = streaming;
}

function scrollToBottom() {
  elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
}

function openModal() {
  syncSettingsModal();
  elements.settingsModal.classList.add('active');
}

function closeModal() {
  elements.settingsModal.classList.remove('active');
}

function exportActiveConversation() {
  const session = getCurrentSession();
  if (!session || session.messages.length === 0) {
    alert("No messages to export.");
    return;
  }

  let md = `# ${session.title}\n*Exported from DocVerse AI Studio on ${new Date().toLocaleString()}*\n\n---\n\n`;
  session.messages.forEach(m => {
    md += `### ${m.role === 'user' ? '👤 User' : '🤖 DocVerse AI'}\n\n`;
    if (m.thinking) {
      md += `> **Reasoning:**\n> ${m.thinking.replace(/\n/g, '\n> ')}\n\n`;
    }
    md += `${m.content}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
