# AI-Powered Code Explainer

> A production-grade, full-stack Next.js 14 application that leverages Google Gemini Flash for deterministic code analysis, Big-O complexity profiling, and intelligent refactoring — all within a premium developer-centric dark-mode dashboard.

---

## System Architecture

### Why Next.js App Router?

This application is built as a **unified Next.js 14+ App Router** monolith rather than a traditional split frontend/backend architecture. This decision is deliberate and solves several critical engineering constraints:

1. **Zero CORS Configuration**: By colocating the React UI and the AI API endpoints (`/api/explain`) under the same origin, we completely eliminate cross-origin resource sharing issues. In cloud IDE environments (such as Project IDX, Gitpod, or Codespaces), ports are often proxied through intermediary domains with unpredictable URL rewriting — a split architecture would require fragile CORS whitelisting or proxy middleware that breaks across environments.

2. **Single Deployment Unit**: The App Router's file-system-based routing means our API route handlers (`app/api/explain/route.js`) are colocated with our pages. This ships as a single serverless deployment on Vercel, Netlify, or any Node.js host — no separate backend container, no service mesh, no inter-service latency.

3. **Server Component Boundary**: Next.js App Router draws a clear server/client boundary. Our API route runs exclusively server-side, keeping the `GEMINI_API_KEY` off the client bundle entirely. The `"use client"` directive on `page.js` marks only the interactive dashboard as a client component, while the layout and metadata remain server-rendered for SEO.

4. **Streaming-Ready**: The App Router architecture supports React Server Components and streaming, making it straightforward to upgrade to streamed AI responses in the future without architectural changes.

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                       │
│                                                              │
│  ┌────────────────────┐    ┌──────────────────────────────┐ │
│  │   Client (React)   │───▶│  POST /api/explain           │ │
│  │   "use client"     │◀───│  (Server-only Route Handler) │ │
│  │                    │    │                              │  │
│  │  • Code Input      │    │  • Input Validation          │ │
│  │  • History (localStorage) │  • Gemini SDK Init       │  │
│  │  • Result Display  │    │  • System Prompt Injection   │ │
│  │  • Diff Viewer     │    │  • JSON Parse + Validation   │ │
│  │  • Skeleton Loader │    │  • Error Fallback            │ │
│  └────────────────────┘    └──────────────────────────────┘ │
│                                       │                      │
│                                       ▼                      │
│                           ┌──────────────────┐               │
│                           │  Google Gemini    │               │
│                           │  Flash 2.0       │               │
│                           │  temp: 0.1       │               │
│                           └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Logic

### Why Gemini Flash?

**Google Gemini 2.0 Flash** was selected as the inference engine for three strategic reasons:

1. **Speed**: Flash models are optimized for low-latency inference, critical for an interactive code analysis tool where users expect sub-3-second responses. Larger models (Gemini Pro, GPT-4) introduce perceptible wait times that degrade UX.

2. **Structured Output Fidelity**: Flash models, when constrained with low temperature and explicit system prompts, demonstrate strong adherence to JSON schema specifications. This is essential because our frontend directly parses the AI response as structured data — any deviation from the schema causes runtime failures.

3. **Cost Efficiency**: Flash models consume significantly fewer tokens per inference call. For a tool designed for repeated, rapid-fire code submissions, this keeps API costs sustainable.

### Strict JSON Schema Contract

The API endpoint enforces a rigid four-field JSON contract:

```json
{
  "explanation": "string — 2–4 sentence structural breakdown",
  "timeComplexity": "string — Big-O notation + 1-sentence justification",
  "spaceComplexity": "string — Big-O notation + 1-sentence justification",
  "optimizedCode": "string — refactored production-ready code"
}
```

This schema is enforced at **three layers**:

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **Prompt Engineering** | System prompt explicitly defines the JSON schema with examples | Guides the model's output format |
| **Parse Resilience** | Multi-stage JSON extraction (direct parse → fence stripping → brace extraction) | Recovers from common LLM formatting artifacts |
| **Schema Validation** | Runtime type-checking of all four fields before returning to the client | Guarantees frontend never receives malformed data |

---

## Mitigation of Hallucinations

Hallucination mitigation is the single most critical defensive engineering concern when deploying LLM-generated structured output into a production pipeline. This application implements a **defense-in-depth** strategy across four vectors:

### 1. Low Temperature (0.1)

The Gemini SDK is configured with `temperature: 0.1`, dramatically reducing the model's sampling randomness. At this temperature, the model selects from only the highest-probability tokens at each generation step, producing deterministic, analytically grounded output rather than creative or speculative text. This is essential for Big-O complexity analysis, where a "creative" answer (e.g., claiming O(n) for an O(n²) algorithm) would be worse than no answer at all.

### 2. Deterministic System Prompting

The system prompt is not a casual instruction — it is a **behavioral contract** with the model. Key defensive elements include:

- **Positive constraints**: "You MUST respond with ONLY a single valid JSON object."
- **Negative constraints**: "Never invent functionality that is not present in the input code."
- **Explicit error schema**: The prompt defines an exact JSON fallback the model must return for empty, broken, or malicious input, preventing the model from guessing at intent.
- **Formatting constraints**: "Never wrap the JSON in markdown code fences or backticks" — addressing a common Gemini behavior pattern.

### 3. Strict Runtime Schema Validation

Even with perfect prompting, LLMs can produce structurally valid JSON with incorrect field names, missing fields, or unexpected types. The API route performs **post-inference schema validation**, checking that all four required fields exist and are strings before forwarding the response to the client. If validation fails, a pre-defined fallback payload is returned instead of the malformed response.

### 4. Frontend Error Boundaries

The client-side code implements multiple resilience layers:

- **Fetch error handling**: Network failures and non-200 responses trigger user-facing error banners, never silent failures.
- **Schema verification**: The client validates the presence of all four response fields before rendering, independent of server-side validation.
- **Graceful degradation**: If localStorage is corrupted or unavailable, the app continues to function without history — no crashes.
- **Input validation**: Empty or whitespace-only code is caught client-side before making any API call.

Together, these four layers ensure that the user **never sees hallucinated, malformed, or misleading output** — the system either returns verified, schema-compliant analysis or a clear, honest error state.

---

## Getting Started

### Prerequisites

- **Node.js** 18.17+ (LTS recommended)
- A **Google Gemini API key** from [AI Studio](https://aistudio.google.com/apikey)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
#    Edit .env and replace 'your_gemini_api_key_here' with your actual key
#    Or copy from the template:
cp .env.example .env

# 3. Start the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Usage

1. Select a language (Python or JavaScript) from the dropdown.
2. Paste your code into the editor, or click **Load Sample** for a demo snippet.
3. Click **Analyze Code** (or press `Ctrl+Enter`) to submit.
4. Review the structural analysis, complexity metrics, and optimized code diff.
5. Past analyses are saved automatically and accessible from the History sidebar.

---

## Project Structure

```
├── .env.example            # Environment variable template
├── .env                    # Your API key (git-ignored)
├── next.config.js          # Next.js configuration
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind dark theme + animations
├── postcss.config.js       # PostCSS plugin chain
├── app/
│   ├── layout.js           # Root layout with SEO metadata
│   ├── page.js             # Main dashboard (client component)
│   ├── globals.css         # Design system (cards, buttons, animations)
│   └── api/
│       └── explain/
│           └── route.js    # AI inference endpoint (server-only)
└── README.md               # This document
```

---

## License

MIT
