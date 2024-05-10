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
    const script = document.createElement('script');
    // It is a module script to avoid conflicts with the global scope
    script.type = 'module';
    script.src = 'https://raw.githubusercontent.com/mpsych/cdn/main/web-llm/index.js';
    document.head.appendChild(script);
  
    // Wait for the script to load
    script.onload = async () => {
      // Import the module
      const module = await import(script.src);
      // Now you can use the exported items from the module
      // For example, if the module exports a function called `init`, you can call it like this:
      console.log(module);
      window.webllm = module;
      setupChatUI();
      populateModelSelector();
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
        display: flex;
        align-items: center;
        background-color: #f0f0f0;
        border-radius: 8px;
        padding: 10px;
        color: black;
        width: calc(100% - 20px);
        margin: 5px auto;
        box-sizing: border-box;
    }
    .left-msg .msg-bubble {
        background-color: #343541; /* LLM Messages */
        color: #ececec;
    }
    .right-msg .msg-bubble {
        background-color: #444654; /* User Messages */
        color: #ececec;
    }
    .profile-image {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        margin-right: 10px;
    }
    .message-label {
        font-size: 12px;
        color: #ccc;
        text-align: center;
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

function populateModelSelector() {
    const modelSelect = document.getElementById('chatui-select');
    webllm.prebuiltAppConfig.model_list.forEach((model, index) => {
        let option = new Option(model.model_id, model.model_id);
        modelSelect.add(option);
    });

    modelSelect.addEventListener('change', function() {
        initializeChat(this.value);
    });
}

// Initialize the chat
async function initializeChat(selectedModel) {
    try {
        const initProgressCallback = (report) => {
            showProgress(report.text);
        };
        const engine = await webllm.CreateEngine(selectedModel, { initProgressCallback });
        const chatUI = new ChatUI(engine);
        chatUI.setupEventListeners();
        clearProgress();
    } catch (error) {
        Boostlet.hint(`Error: ${error.message}`, 3000);
    }
}

function showProgress(text) {
    let progressBox = document.getElementById('progress-box');
    if (!progressBox) {
        progressBox = document.createElement('div');
        progressBox.id = 'progress-box';
        progressBox.style = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.75); color: white; padding: 20px; border-radius: 10px; z-index: 1500;';
        document.body.appendChild(progressBox);
    }
    progressBox.innerText = text;
}

function clearProgress() {
    const progressBox = document.getElementById('progress-box');
    if (progressBox) {
        document.body.removeChild(progressBox);
    }
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
    this.appendMessage('right-msg', message, "User");
    this.uiInput.value = '';
    this.processChatMessage(message);
}

  resetChat() {
      this.uiChat.innerHTML = '';
  }

  appendMessage(className, text, role) {
    const chat = this.uiChat;
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'msg ' + className;

    const imgSrc = (role === "User") ? "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png" : "https://en.shiftdelete.net/wp-content/uploads/2023/06/chatbots-unleashed-utilizing-a-gpt-like-mlc-local-chatbot-in-macos-1.jpg";
    const profileImg = `<img src="${imgSrc}" alt="${role}" class="profile-image">`;

    messageWrapper.innerHTML = `
        <div class="msg-bubble">
            ${profileImg}
            <div>
                <div>${text}</div>
            </div>
        </div>
    `;

    chat.appendChild(messageWrapper);
    chat.scrollTop = chat.scrollHeight;
  }

  async processChatMessage(message) {
    try {
        const response = await this.engine.chat.completions.create({
            messages: [{role: "user", content: message}]
        });
        this.appendMessage('left-msg', response.choices[0].message.content);
    } catch (error) {
        Boostlet.hint(`Error: ${error.message}`, 3000);
    }
 }
};