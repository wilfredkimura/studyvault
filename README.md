# StudyVault

StudyVault is an offline-first academic document organizer and study companion. It combines a local SQLite database, a Python background extraction worker, and a modern Electron desktop shell with optional AI capabilities using a local **Bring Your Own Key (BYOK)** model.

This repository is structured as a monorepo containing:
1. **Desktop Application**: The Electron-based study dashboard, document library, text reader, and PDF annotation suite.
2. **Python Worker Node**: A background service that manages high-fidelity text/metadata extraction, database sync, and AI prompt gateways.
3. **Marketing & Simulator Website**: A landing page, tutorial site, and interactive in-browser application simulator deployed on Vercel.

---

## Key Features

* **Local-First & Private**: Your lecture slides, documents, and annotations are stored securely in a local SQLite database on your machine.
* **Document Converter**: Drag-and-drop support for `.docx`, `.pptx`, and other academic slides, converting them automatically into clean, uniform PDFs.
* **High-Fidelity Reader & Annotator**: Keep track of slides, read raw text, highlight important formulas, and add notes to specific pages.
* **Bring Your Own Key (BYOK) AI Copilot**: Unlock page summarization and contextual study guides by providing your own API credentials. Compatible with:
  * **Google Gemini** (using optimized `gemini-2.5-flash`)
  * **OpenAI GPT** models
  * **Anthropic Claude**
  * **Local LLMs** (via Ollama or custom local API gateways)
* **Interactive Web Simulator**: Allows new users to preview the app's features and UI right in their browser before downloading.

---

## Repository Structure

```
studyvault/
├── database/            # Local SQLite database configurations
├── python_worker/       # Python background service for layout/text extraction
│   ├── requirements.txt # Python dependencies
│   └── worker.py        # Background process entrypoint
├── src/                 # Electron main and renderer desktop application
│   ├── main/            # Electron main process (lifecycle, IPC bridge)
│   └── renderer/        # React + TS desktop UI (Dashboard, Library, Viewer)
├── website/             # Vite + React + TS marketing and simulator website
│   ├── public/          # Branding assets (favicon.svg, folder icons)
│   └── src/             # Website landing page & mock simulator components
├── package.json         # Root monorepo scripts & configurations
├── vercel.json          # Production Vercel deployment specifications
└── LICENSE              # MIT License details
```

---

## Prerequisites

To run this project locally, ensure you have the following installed:
* **Node.js** (v18 or higher)
* **Python** (v3.10 or higher)

---

## Desktop App Setup & Execution

### 1. Install Node Dependencies
From the repository root, install the required packages:
```bash
npm install
```

### 2. Configure the Python Worker
Navigate into the `python_worker` directory, create a virtual environment, and install dependencies:
```bash
cd python_worker
python -m venv venv
# Activate on Windows:
.\venv\Scripts\activate
# Activate on macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Run in Development Mode
To start both the Electron shell and compile the React renderer assets:
```bash
npm run dev
# In another terminal (or runs automatically via application startup):
npm run start
```

### 4. Package the Application
To build the distribution installers (NSIS executable and portable standalone builds for Windows):
```bash
npm run dist
```
The output builds will compile and save in the `release/` folder.

---

## License

This project is licensed under the MIT License. See the [LICENSE](file:///c:/Users/kimushzyyy/Documents/studyvault/LICENSE) file for more information.
