script = document.createElement("script");
script.type = "text/javascript";
//script.src = "https://boostlet.org/dist/boostlet.min.js";
script.src = "http://localhost:5500/dist/boostlet.min.js";

script.onload = run;
document.head.appendChild(script);
eval(script);

async function run() {

  // detect visualization framework
  Boostlet.init();

  // Dynamically load the WebLLM script
  const webLLMScript = document.createElement("script");
  webLLMScript.src = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.35/lib/index.min.js";
  document.head.appendChild(webLLMScript);

  webLLMScript.onload = function() {
      // Setup the chat UI once the WebLLM is loaded
      setupChatUI();
      initializeChat();
  };
}

function setupChatUI() {
  const style = document.createElement("style");
  style.type = 'text/css';
  style.innerHTML = `
      .chatui {
          display: flex;
          position: fixed;
          bottom: 0;
          right: 0;
          flex-direction: column;
          width: 350px;
          height: 600px;
          border: 2px solid #ddd;
          border-radius: 5px;
          background-color: #1F2027;
          z-index: 1000;
      }
      .chatui-select-wrapper {
          display: flex;
          justify-content: center;
          background-color: #1F2027;
          padding: 10px 0;
      }
      #chatui-select {
          width: 90%;
          background-color: #1F2027;
          color: white;
          border: none;
      }
      #chatui-select:focus {
          outline: none;
      }
      .chatui-chat {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: #1F2027;
      }
      .chatui-inputarea {
          display: flex;
          padding: 10px;
          border-top: 2px solid transparent;
          background-color: #1F2027;
      }
      .chatui-input {
          flex: 1;
          background-color: #40414F;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 10px;
          font-size: 16px;
      }
      .chatui-send-btn, .chatui-reset-btn {
          background-color: #40414F;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 10px;
          cursor: pointer;
          margin-left: 10px;
      }
      .chatui-send-btn:hover, .chatui-reset-btn:hover {
          background-color: #03a33e;
      }
      .msg-bubble {
          background-color: #f0f0f0;
          border-radius: 8px;
          padding: 16px;
          color: black;
          width: calc(100% - 20px);
          margin: 5px auto;
          box-sizing: border-box;
      }
      .left-msg .msg-bubble {
          background-color: #343541;
          color: #ececec;
      }
      .right-msg .msg-bubble {
          background-color: #444654;
          color: #ececec;
      }
  `;
  document.head.appendChild(style);

  const chatContainer = document.createElement('div');
  chatContainer.className = 'chatui';
  document.body.appendChild(chatContainer);

  chatContainer.innerHTML = `
      <div class="chatui-select-wrapper">
          <select id="chatui-select">
              <option selected>Select Model...</option>
          </select>
      </div>
      <div class="chatui-chat" id="chatui-chat"></div>
      <div class="chatui-inputarea">
          <input id="chatui-input" type="text" class="chatui-input" placeholder="Enter your message...">
          <button id="chatui-send-btn" class="chatui-send-btn">Send</button>
          <button id="chatui-reset-btn" class="chatui-reset-btn">Reset</button>
      </div>
  `;
}

// Initialize the chat
async function initializeChat() {
  const engine = await webllm.Engine.create({modelId: "Llama-3-8B-Instruct-q4f32_1"}); // Use your model ID
  const chatUI = new ChatUI(engine);
  chatUI.setupEventListeners(); // Set up event listeners after initializing
}

class ChatUI {
  constructor(engine) {
      this.engine = engine;
      this.uiChat = document.getElementById("chatui-chat");
      this.uiInput = document.getElementById("chatui-input");
      this.uiSendBtn = document.getElementById("chatui-send-btn");
      this.uiResetBtn = document.getElementById("chatui-reset-btn");
  }

  setupEventListeners() {
      this.uiSendBtn.addEventListener('click', () => this.sendChatMessage());
      this.uiResetBtn.addEventListener('click', () => this.resetChat());
  }

  sendChatMessage() {
      const message = this.uiInput.value.trim();
      if (!message) return;
      this.appendMessage('right-msg', message);
      this.uiInput.value = '';
      this.processChatMessage(message);
  }

  resetChat() {
      this.uiChat.innerHTML = '';
  }

  appendMessage(className, text) {
      const messageElement = document.createElement('div');
      messageElement.className = 'msg ' + className;
      messageElement.innerHTML = `<div class="msg-bubble">${text}</div>`;
      this.uiChat.appendChild(messageElement);
      this.uiChat.scrollTop = this.uiChat.scrollHeight;
  }

  async processChatMessage(message) {
      // Integration with WebLLM to send and receive messages
      const response = await this.engine.chat.completions.create({
          messages: [{role: "user", content: message}]
      });
      this.appendMessage('left-msg', response.choices[0].message.content); // Handle and display response
  }
};