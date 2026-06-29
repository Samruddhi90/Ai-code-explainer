import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

/* ────────────────────────────────────────────────────────────
   System prompt: forces Gemini to return ONLY valid JSON
   matching our exact schema. Includes hallucination guardrails.
   ──────────────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `You are an elite software engineering assistant that performs rigorous static code analysis.

RULES — follow every rule without exception:
1. You MUST respond with ONLY a single valid JSON object. No markdown fences, no commentary, no text outside the JSON.
2. The JSON object MUST contain exactly these four keys:
   - "explanation" (string): A concise 2–4 sentence plain-English structural breakdown of what the code achieves, covering its purpose, control flow, and key data transformations.
   - "timeComplexity" (string): Big-O time complexity in standard notation (e.g. "O(n log n)") followed by a 1-sentence analytical justification referencing specific loops, recursion, or operations.
   - "spaceComplexity" (string): Big-O space complexity in standard notation followed by a 1-sentence analytical justification referencing specific data structures or allocations.
   - "optimizedCode" (string): A clean, refactored, production-ready version of the input code that preserves identical functionality but improves performance, readability, or idiomatic style. Include brief inline comments explaining optimizations. If the code is already optimal, return it unchanged with a comment stating so.
3. HALLUCINATION GUARDRAIL: If the input is empty, contains only whitespace, is syntactically broken beyond interpretation, or contains malicious/non-code content, you MUST return:
   {"explanation":"Unable to analyze: the provided input is empty, invalid, or not recognizable code.","timeComplexity":"N/A — no valid code to analyze.","spaceComplexity":"N/A — no valid code to analyze.","optimizedCode":"// No valid code provided for optimization."}
4. Never invent functionality that is not present in the input code.
5. Never wrap the JSON in markdown code fences or backticks.
6. Ensure all string values use proper JSON escaping for newlines (\\n), tabs (\\t), quotes (\\"), and backslashes (\\\\).`;

/* ────────────────────────────────────────────────────────────
   Fallback payload returned when parsing or API calls fail.
   ──────────────────────────────────────────────────────────── */
const FALLBACK_PAYLOAD = {
  explanation:
    "Analysis could not be completed. The AI service returned an unparseable response or encountered an internal error. Please try again or simplify your input.",
  timeComplexity: "N/A — analysis failed.",
  spaceComplexity: "N/A — analysis failed.",
  optimizedCode: "// Analysis failed. Please retry with valid code.",
};

/* ────────────────────────────────────────────────────────────
   POST /api/explain
   Accepts: { code: string, language: "python" | "javascript" }
   Returns: structured JSON analysis payload
   ──────────────────────────────────────────────────────────── */
export async function POST(request) {
  try {
    /* ── 1. Parse & validate request body ──────────────────── */
    const body = await request.json();
    const { code, language } = body;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json(
        {
          explanation:
            "Unable to analyze: the provided input is empty or contains only whitespace.",
          timeComplexity: "N/A — no valid code to analyze.",
          spaceComplexity: "N/A — no valid code to analyze.",
          optimizedCode: "// No valid code provided for optimization.",
        },
        { status: 200 }
      );
    }

    const lang =
      language === "python" || language === "javascript"
        ? language
        : "javascript";

    /* ── 2. Initialize Gemini client ───────────────────────── */
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        {
          explanation:
            "Server configuration error: GEMINI_API_KEY is not set. Please add a valid Google Gemini API key to your .env file.",
          timeComplexity: "N/A — missing API key.",
          spaceComplexity: "N/A — missing API key.",
          optimizedCode:
            "// Cannot optimize: API key not configured. Visit https://aistudio.google.com/apikey",
        },
        { status: 200 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      {
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 4096,
        },
      },
      { apiVersion: "v1" }
    );

    /* ── 3. Build the user prompt ──────────────────────────── */
    const userPrompt = `Analyze the following ${lang} code and return ONLY a JSON object with the exact schema specified in your instructions.

\`\`\`${lang}
${code}
\`\`\``;

    /* ── 4. Call Gemini ─────────────────────────────────────── */
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [
            {
              text: '{"explanation":"Ready. Send me code and I will return analysis as the specified JSON schema.","timeComplexity":"N/A","spaceComplexity":"N/A","optimizedCode":"// Awaiting input."}',
            },
          ],
        },
      ],
    });

    const result = await chat.sendMessage(userPrompt);
    const responseText = result.response.text();

    /* ── 5. Parse response — strip stray markdown fences ──── */
    let parsed;
    try {
      // Gemini sometimes wraps output in ```json ... ``` despite instructions
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Attempt a more aggressive extraction: find first { to last }
      const firstBrace = responseText.indexOf("{");
      const lastBrace = responseText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(
            responseText.substring(firstBrace, lastBrace + 1)
          );
        } catch {
          parsed = null;
        }
      }
    }

    /* ── 6. Schema validation ──────────────────────────────── */
    if (
      parsed &&
      typeof parsed.explanation === "string" &&
      typeof parsed.timeComplexity === "string" &&
      typeof parsed.spaceComplexity === "string" &&
      typeof parsed.optimizedCode === "string"
    ) {
      return NextResponse.json(parsed, { status: 200 });
    }

    // If schema doesn't match, return fallback
    return NextResponse.json(FALLBACK_PAYLOAD, { status: 200 });
  } catch (error) {
    console.error("[/api/explain] Unhandled error:", error);
    return NextResponse.json(
      {
        ...FALLBACK_PAYLOAD,
        explanation: `Analysis failed due to an internal server error: ${error.message || "Unknown error"}. Please check your API key and try again.`,
      },
      { status: 200 }
    );
  }
}
