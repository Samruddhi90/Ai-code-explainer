"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Braces,
  Clock,
  Code2,
  Database,
  History,
  Loader2,
  Play,
  Sparkles,
  Trash2,
  X,
  Zap,
  ArrowRightLeft,
  AlertTriangle,
  ChevronRight,
  TerminalSquare,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────── */
const STORAGE_KEY = "code-explainer-history";
const MAX_HISTORY = 25;

const SAMPLE_SNIPPETS = {
  python: `def fibonacci(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result`,
  javascript: `function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) {
    return obj.reduce((arr, item, i) => {
      arr[i] = deepClone(item);
      return arr;
    }, []);
  }
  if (obj instanceof Object) {
    return Object.keys(obj).reduce((newObj, key) => {
      newObj[key] = deepClone(obj[key]);
      return newObj;
    }, {});
  }
}`,
};

/* ────────────────────────────────────────────────────────────
   Utility: truncate code preview
   ──────────────────────────────────────────────────────────── */
function truncateCode(code, maxLen = 52) {
  const firstLine = code.split("\n")[0].trim();
  return firstLine.length > maxLen
    ? firstLine.substring(0, maxLen) + "…"
    : firstLine;
}

/* ────────────────────────────────────────────────────────────
   Utility: format timestamp
   ──────────────────────────────────────────────────────────── */
function formatTime(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/* ════════════════════════════════════════════════════════════
   COMPONENT: SkeletonLoader
   ════════════════════════════════════════════════════════════ */
function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Explanation skeleton */}
      <div className="card p-6 space-y-3">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-5/6 rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
      </div>
      {/* Complexity cards skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 space-y-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-6 w-32 rounded" />
          <div className="skeleton h-3 w-full rounded" />
        </div>
        <div className="card p-5 space-y-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-6 w-32 rounded" />
          <div className="skeleton h-3 w-full rounded" />
        </div>
      </div>
      {/* Diff skeleton */}
      <div className="card p-6 space-y-3">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton h-32 w-full rounded" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPONENT: ComplexityCard
   ════════════════════════════════════════════════════════════ */
function ComplexityCard({ icon: Icon, label, value, color }) {
  // Extract just the Big-O notation for the badge
  const bigO = value.match(/O\([^)]*\)/)?.[0] || value.split("—")[0].trim();
  const justification = value.includes("—")
    ? value.split("—").slice(1).join("—").trim()
    : value.replace(bigO, "").replace(/^[\s—–-]+/, "").trim();

  const colorMap = {
    blue: {
      border: "border-blue-500/30",
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      icon: "text-blue-400",
      badge: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    },
    emerald: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      icon: "text-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`card p-5 ${c.border} hover:${c.bg} transition-colors`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-md ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={`complexity-badge ${c.badge} text-base mb-2`}>
        {bigO}
      </div>
      {justification && (
        <p className="text-xs text-slate-400 leading-relaxed mt-2">
          {justification}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPONENT: DiffViewer
   ════════════════════════════════════════════════════════════ */
function DiffViewer({ original, optimized, language }) {
  return (
    <div className="card overflow-hidden animate-slide-up">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800/70">
        <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-200">
          Code Comparison
        </h3>
        <span className="ml-auto text-[10px] font-mono text-slate-500 uppercase">
          {language}
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/70">
        {/* Original */}
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-950/30 border-b border-red-500/10">
            <div className="w-2 h-2 rounded-full bg-red-500/60" />
            <span className="text-[11px] font-semibold text-red-400/80 uppercase tracking-wider">
              Original
            </span>
          </div>
          <pre className="p-4 overflow-x-auto custom-scrollbar text-xs leading-relaxed font-mono text-slate-300 diff-original min-h-[180px]">
            <code>{original}</code>
          </pre>
        </div>
        {/* Optimized */}
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-950/30 border-b border-emerald-500/10">
            <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
            <span className="text-[11px] font-semibold text-emerald-400/80 uppercase tracking-wider">
              Optimized
            </span>
          </div>
          <pre className="p-4 overflow-x-auto custom-scrollbar text-xs leading-relaxed font-mono text-emerald-200/90 diff-optimized min-h-[180px]">
            <code>{optimized}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPONENT: HistorySidebar
   ════════════════════════════════════════════════════════════ */
function HistorySidebar({
  history,
  activeId,
  onSelect,
  onClear,
  isOpen,
  onClose,
}) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-[300px] z-50
          lg:relative lg:z-0
          flex flex-col
          bg-slate-950/95 backdrop-blur-md
          border-r border-slate-800/70
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/70">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-200">History</h2>
            {history.length > 0 && (
              <span className="ml-1 text-[10px] font-mono text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">
                {history.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Clear all history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-3 rounded-xl bg-slate-900/50 mb-3">
                <TerminalSquare className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your analysis history will appear here. Analyze some code to get
                started.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`
                  w-full text-left p-3 rounded-lg transition-all duration-200 group
                  ${
                    activeId === item.id
                      ? "bg-indigo-500/10 border border-indigo-500/25 shadow-glow"
                      : "hover:bg-slate-800/50 border border-transparent"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`lang-badge ${
                      item.language === "python"
                        ? "lang-badge-python"
                        : "lang-badge-javascript"
                    }`}
                  >
                    {item.language === "python" ? "PY" : "JS"}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {formatTime(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-400 truncate group-hover:text-slate-200 transition-colors">
                  {truncateCode(item.code)}
                </p>
                {item.result && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {item.result.timeComplexity
                        .match(/O\([^)]*\)/)?.[0]
                        ?.substring(0, 12) || "—"}
                    </span>
                    <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                      <Database className="w-2.5 h-2.5" />
                      {item.result.spaceComplexity
                        .match(/O\([^)]*\)/)?.[0]
                        ?.substring(0, 12) || "—"}
                    </span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function HomePage() {
  /* ── State ───────────────────────────────────────────────── */
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ── Load history from localStorage on mount ─────────────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch {
      // Silently handle corrupted storage
    }
  }, []);

  /* ── Persist history to localStorage ─────────────────────── */
  const persistHistory = useCallback((items) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or unavailable — degrade gracefully
    }
  }, []);

  /* ── Analyze code ────────────────────────────────────────── */
  const analyzeCode = async () => {
    if (!code.trim()) {
      setError("Please enter some code to analyze.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveHistoryId(null);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), language }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      const data = await res.json();

      // Validate response schema
      if (
        !data.explanation ||
        !data.timeComplexity ||
        !data.spaceComplexity ||
        !data.optimizedCode
      ) {
        throw new Error("Invalid response schema from AI service.");
      }

      setResult(data);

      // Add to history
      const newEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        code: code.trim(),
        language,
        timestamp: new Date().toISOString(),
        result: data,
      };

      const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY);
      setHistory(updatedHistory);
      setActiveHistoryId(newEntry.id);
      persistHistory(updatedHistory);
    } catch (err) {
      setError(
        err.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Restore from history ────────────────────────────────── */
  const restoreFromHistory = (item) => {
    setCode(item.code);
    setLanguage(item.language);
    setResult(item.result);
    setActiveHistoryId(item.id);
    setError(null);
    setSidebarOpen(false);
  };

  /* ── Clear history ───────────────────────────────────────── */
  const clearHistory = () => {
    setHistory([]);
    setActiveHistoryId(null);
    persistHistory([]);
  };

  /* ── Load sample ─────────────────────────────────────────── */
  const loadSample = () => {
    setCode(SAMPLE_SNIPPETS[language]);
    setResult(null);
    setError(null);
    setActiveHistoryId(null);
  };

  /* ── Keyboard shortcut: Ctrl/Cmd + Enter to analyze ──── */
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      analyzeCode();
    }
  };

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── SIDEBAR ──────────────────────────────────────── */}
      <HistorySidebar
        history={history}
        activeId={activeHistoryId}
        onSelect={restoreFromHistory}
        onClear={clearHistory}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ─── MAIN CONTENT ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Top bar */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors lg:hidden"
              >
                <History className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 shadow-lg shadow-indigo-500/20">
                  <Braces className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-100 tracking-tight">
                    AI Code Explainer
                  </h1>
                  <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                    Powered by Gemini Flash
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Engine Ready</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* ─── CODE WORKSPACE ───────────────────────────── */}
          <section className="card overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/70">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Code Workspace
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadSample}
                  className="btn-ghost text-xs py-1.5 px-3"
                >
                  <Sparkles className="w-3 h-3" />
                  Load Sample
                </button>
                <div className="relative">
                  <select
                    id="language-selector"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="appearance-none bg-slate-800/70 border border-slate-700/50 rounded-lg px-3 py-1.5 pr-7 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer transition-colors hover:bg-slate-800"
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                  <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 rotate-90 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <textarea
                id="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`// Paste your ${language} code here...\n// Press Ctrl+Enter to analyze`}
                className="code-editor"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900/40 border-t border-slate-800/50">
              <p className="text-[10px] text-slate-600">
                {code.trim().split("\n").length} lines •{" "}
                {code.trim().length} chars
                <span className="hidden sm:inline">
                  {" "}
                  • Ctrl+Enter to analyze
                </span>
              </p>
              <button
                id="analyze-button"
                onClick={analyzeCode}
                disabled={isLoading || !code.trim()}
                className="btn-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Analyze Code
                  </>
                )}
              </button>
            </div>
          </section>

          {/* ─── ERROR BANNER ─────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/30 border border-red-500/20 animate-slide-up">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">
                  Analysis Failed
                </p>
                <p className="text-xs text-red-400/80 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto p-1 rounded-md text-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── LOADING STATE ────────────────────────────── */}
          {isLoading && <SkeletonLoader />}

          {/* ─── RESULTS ──────────────────────────────────── */}
          {result && !isLoading && (
            <div className="space-y-6">
              {/* Explanation Card */}
              <section className="card p-6 animate-slide-up">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-md bg-indigo-500/10">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Structural Analysis
                  </h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {result.explanation}
                </p>
              </section>

              {/* Complexity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up">
                <ComplexityCard
                  icon={Clock}
                  label="Time Complexity"
                  value={result.timeComplexity}
                  color="blue"
                />
                <ComplexityCard
                  icon={Database}
                  label="Space Complexity"
                  value={result.spaceComplexity}
                  color="emerald"
                />
              </div>

              {/* Diff Viewer */}
              <DiffViewer
                original={code}
                optimized={result.optimizedCode}
                language={language}
              />
            </div>
          )}

          {/* ─── EMPTY STATE ──────────────────────────────── */}
          {!result && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50 mb-5">
                <Zap className="w-10 h-10 text-slate-700" />
              </div>
              <h3 className="text-lg font-semibold text-slate-400 mb-2">
                Ready to Analyze
              </h3>
              <p className="text-sm text-slate-600 text-center max-w-sm leading-relaxed">
                Paste your Python or JavaScript code above and click{" "}
                <span className="text-indigo-400 font-medium">
                  Analyze Code
                </span>{" "}
                to receive instant AI-powered insights, Big-O complexity
                profiling, and optimized refactors.
              </p>
              <button
                onClick={loadSample}
                className="btn-ghost mt-5 text-xs"
              >
                <Sparkles className="w-3 h-3" />
                Try a sample snippet
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
