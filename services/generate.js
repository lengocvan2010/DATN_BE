const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/* ================= UTILS ================= */

function safeJsonParse(text) {
    try {
        const cleaned = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        
        if (start === -1 || end === -1) {
            throw new Error("Không tìm thấy đối tượng JSON trong phản hồi của AI.");
        }

        const jsonString = cleaned.substring(start, end + 1);
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("🔴 Lỗi Parse JSON. Nội dung thô từ AI:", text);
        throw e;
    }
}

function writeFileSafe(projectPath, filePath, content) {
    const fullPath = path.join(projectPath, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
}

/* ================= MAIN GENERATOR ================= */

async function generateProjectFiles(uiDraft, projectPath) {

    console.log("🤖 Đang yêu cầu OpenAI sinh mã nguồn (GPT-4o)...");

    const prompt = `
You are a senior frontend engineer.
Your task is to generate a STATIC, SAFE, MULTI-PAGE UI for a Next.js App Router project.

================ CORE PRINCIPLES ================
- ALL pages and routes MUST be derived strictly from the provided UI Draft.
- UI Draft is the single source of truth.

================ PAGE & ROUTING RULES (CRITICAL) ================
- MUST ALWAYS include a Root Layout at "src/app/layout.tsx". This file is MANDATORY for Next.js to build.
- Root Layout MUST contain <html> and <body> tags, and import "./globals.css".
- Route path MUST be generated from pageName: lowercase, remove Vietnamese diacritics, replace spaces/slashes with hyphens.
- "Trang chủ" or "Home" → route path is "/", file path is "src/app/page.tsx".
- Exactly ONE page.tsx per route in src/app.

================ INTERACTION & TECHNICAL RULES ================
- Next.js App Router using src/app.
- ALL components MUST be Server Components (NO "use client").
- ONLY navigation using <Link> from "next/link".
- NO hooks (useState, useEffect), NO event handlers, NO client-side state.
- Forms and inputs are VISUAL ONLY.
- Escape characters like '>', '<', '{', '}' using HTML entities (e.g., &gt;).

================ IMAGE RULES (CRITICAL) ================
- DO NOT use next/image, <img> tags, or reference any image URLs.
- ALL image areas MUST be represented by semantic <div> blocks with Tailwind colors.
- Example: Product image -> <div className="bg-gray-200 aspect-square rounded-lg" />

================ ARCHITECTURE & STYLE ================
- Components in src/components/ui.
- TailwindCSS ONLY, mobile-first responsive.
- Primary CTA color: blue.
- Use Lucide-react icons.
- Use modern UI patterns: large border-radius (rounded-2xl), soft shadows (shadow-sm).
- Layout: Use Flexbox and CSS Grid for spacing. NEVER use bare text without containers.
- Colors: Use Slate-600 for sub-text and Blue-600 for primary elements.
- Padding: Ensure all sections have generous padding (e.g., py-12, px-6).

================ OUTPUT FORMAT ================
Return ONLY a valid JSON object. No markdown. No conversational text.
{
  "files": [
    { 
      "path": "src/app/layout.tsx", 
      "content": "import './globals.css'; export default function RootLayout({ children }: { children: React.ReactNode }) { return (<html lang='vi'><body>{children}</body></html>); }" 
    },
    { "path": "src/app/page.tsx", "content": "..." }
  ]
}

================ UI DRAFT ================
${JSON.stringify(uiDraft, null, 2)}
`;

    try {
        const response = await openai.chat.completions.create({
            // model: "gpt-5-mini", 
            model: "gpt-5.1", 
            messages: [
                { 
                    role: "system", 
                    content: "You are a code generation engine that outputs only valid JSON. Do not explain code. Do not use markdown." 
                },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
        });

        const rawOutput = response.choices[0].message.content;
        const result = safeJsonParse(rawOutput);

        if (!result.files || !Array.isArray(result.files)) {
            throw new Error("Cấu trúc JSON không hợp lệ: Thiếu mảng 'files'");
        }

        console.log(`📝 Đang ghi ${result.files.length} file vào: ${projectPath}`);

        for (const file of result.files) {
            const normalizedPath = file.path.replace(/^\/+/, "");
            writeFileSafe(projectPath, normalizedPath, file.content);
            console.log("  ✔", normalizedPath);
        }

        return result.files;
    } catch (error) {
        console.error("❌ Lỗi trong quá trình sinh mã nguồn:", error.message);
        throw error;
    }
}

module.exports = {
    generateProjectFiles
};