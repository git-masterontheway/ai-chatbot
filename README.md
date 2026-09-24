# 🌌 DocVerse AI - Intelligent AI Studio & Document Workspace

DocVerse AI is an end-to-end AI document processing and conversation workspace powered by an ultra-fast, OpenAI-compatible Google Gemini engine.

---

## 🚀 Key Highlights

- **Full-Stack Single-Service Architecture**: Runs both the modern glassmorphic frontend UI and high-performance Python streaming backend together or independently.
- **Render Ready**: Complete with `render.yaml` blueprint and `Dockerfile` for instantaneous zero-configuration deployment on [Render](https://render.com).
- **Gemini Powered**: Direct SSE token streaming with Gemini 2.5 / 3.0 Flash & Pro reasoning models.
- **Dynamic Address Auto-Detection**: Automatically connects to Render cloud or local environments without hardcoded localhost restrictions.
- **Security-First**: Google authentication cookies and virtual environments are decoupled and managed securely via environment variables.

---

## 🌐 Deploy to Render

### Option A: Using Blueprint (`render.yaml`) - Recommended
1. Fork or push this repository to your GitHub account.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect this repository and click **Apply**.
5. Render will automatically build and deploy both frontend and backend using `render.yaml`.

### Option B: Manual Web Service Setup on Render
1. Create a **New Web Service** from your GitHub repository on Render.
2. Select **Python** runtime (or **Docker**).
3. Set the following build and start commands:
   - **Build Command**: `pip install -r ai_integration/requirements.txt`
   - **Start Command**: `python ai_integration/gemini_web2api.py`
4. In **Environment Variables**, add:
   - `PORT`: `10000`
   - `GEMINI_COOKIE`: *(Optional)* Paste your Gemini web session cookie if using authenticated features.
5. In **Health Check Path**, set `/health`.

Once deployed, Render provides your live URL (e.g., `https://docverse-ai.onrender.com`).

---

## 💻 Local Development

### 1. Start the Backend
```bash
# Windows
start_backend.bat

# Or manually using Python:
pip install -r ai_integration/requirements.txt
python ai_integration/gemini_web2api.py
```
The backend will launch at `http://localhost:8081` (or your configured `$PORT`).

### 2. Open the Frontend
Simply open `index.html` in your web browser or serve it via any HTTP server (e.g., XAMPP, VS Code Live Server, or Nginx).

---

## ⚙️ Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Server listening port | `8081` (local) / `10000` (Render) |
| `HOST` | Server bind host address | `0.0.0.0` |
| `GEMINI_COOKIE` | Google Gemini authentication cookie | `None` (Anonymous) |

---

## 📄 License
MIT License.
