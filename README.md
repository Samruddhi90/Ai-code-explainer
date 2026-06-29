# AI-Powered Code Explainer

> A production-grade, full-stack Next.js 14 web app that uses Google Gemini Flash to analyze, profile (Big-O), and refactor code inside a premium dark-mode developer dashboard.

---

## 🏗️ System Architecture

Instead of a split frontend/backend setup, this app is built as a **unified Next.js 14 App Router monolith**. 

* **Zero CORS Pain:** React UI and API routes (`/api/explain`) share the same origin, preventing cross-origin errors in cloud environments like Project IDX or Gitpod.
* **Single Deployment:** It ships as a single serverless unit to Vercel or Netlify—no separate backend containers or inter-service latency.
* **Strict Security:** API routes run exclusively server-side, keeping your `GEMINI_API_KEY` entirely hidden from the browser.
* **Streaming Ready:** The architecture easily scales to support real-time streamed AI responses in the future.

---

## 🧠 Core Logic & Schema

### Why Gemini 2.0 Flash?
* **Speed:** Low-latency inference delivers responses in under 3 seconds.
* **Reliability:** Highly accurate at generating rigid structured JSON when paired with low temperatures.
* **Cost-Efficient:** Consumes far fewer tokens than larger models, keeping production costs sustainable.

### JSON Contract
The API strictly enforces a four-field JSON payload to ensure the frontend never receives malformed data:

```json
{
  "explanation": "2–4 sentence structural breakdown",
  "timeComplexity": "Big-O notation + 1-sentence justification",
  "spaceComplexity": "Big-O notation + 1-sentence justification",
  "optimizedCode": "Refactored production-ready code"
}
