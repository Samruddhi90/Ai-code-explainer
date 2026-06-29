import "./globals.css";

export const metadata = {
  title: "AI Code Explainer — Intelligent Code Analysis & Optimization",
  description:
    "A production-grade AI-powered code analysis dashboard. Paste Python or JavaScript code to receive instant structural explanations, Big-O complexity profiling, and intelligently optimized refactors powered by Google Gemini Flash.",
  keywords: [
    "AI code explainer",
    "code analysis",
    "Big-O complexity",
    "code optimization",
    "Gemini AI",
    "Python",
    "JavaScript",
  ],
  authors: [{ name: "AI Code Explainer" }],
  openGraph: {
    title: "AI Code Explainer — Intelligent Code Analysis & Optimization",
    description:
      "Paste code. Get instant structural breakdowns, Big-O complexity analysis, and AI-optimized refactors.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
