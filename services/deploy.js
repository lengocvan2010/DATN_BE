// // deploy.js
// const fs = require("fs");
// const path = require("path");

// /* ================= UTILS (GIỮ NGUYÊN) ================= */

// /**
//  * Quét file local.
//  * Bỏ qua binary/image để tránh lỗi decode khi build Vercel
//  */
// function getFilesFromLocal(dir, fileList = [], rootDir = dir) {
//     const files = fs.readdirSync(dir);

//     files.forEach(file => {
//         const filePath = path.join(dir, file);
//         const stat = fs.statSync(filePath);

//         // Blacklist folders / files
//         if ([
//             'node_modules',
//             '.next',
//             '.git',
//             '.vscode',
//             'package-lock.json',
//             'bun.lockb',
//             'yarn.lock'
//         ].includes(file)) return;

//         if (stat.isDirectory()) {
//             getFilesFromLocal(filePath, fileList, rootDir);
//         } else {
//             // Skip binary files
//             if (/\.(ico|png|jpg|jpeg|gif|webp|pdf|eot|ttf|woff|woff2)$/i.test(file)) {
//                 return;
//             }

//             if (file === '.DS_Store' || file.endsWith('.log')) return;

//             const relativePath = path
//                 .relative(rootDir, filePath)
//                 .replace(/\\/g, '/');

//             try {
//                 const content = fs.readFileSync(filePath, 'utf8');
//                 fileList.push({
//                     file: relativePath,
//                     data: content
//                 });
//             } catch (err) {
//                 console.warn(`⚠️ Cannot read file ${file}:`, err.message);
//             }
//         }
//     });

//     return fileList;
// }

// /* ================= DEPLOY ================= */

// /**
//  * @param {Object} options
//  * @param {string} options.projectPath   PROJECT_PATH
//  * @param {string} options.projectName   PROJECT_NAME
//  * @param {string} options.vercelToken   VERCEL_TOKEN
//  * @param {string} options.teamId        teamId Vercel
//  */
// async function deployToVercel({
//     projectPath,
//     projectName,
//     vercelToken,
//     teamId
// }) {
//     if (!vercelToken) {
//         console.warn("⚠️ VERCEL_TOKEN not set – skip deploy");
//         return;
//     }

//     console.log("📂 Reading ALL files from local disk...");
//     const files = getFilesFromLocal(projectPath);

//     console.log(`🚀 Deploying ${files.length} files to Vercel...`);

//     const res = await fetch(
//         `https://api.vercel.com/v13/deployments?teamId=${teamId}&skipAutoDetectionConfirmation=1`,
//         {
//             method: "POST",
//             headers: {
//                 Authorization: `Bearer ${vercelToken}`,
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify({
//                 name: projectName,
//                 files,
//                 target: "production",
//                 projectSettings: {
//                     framework: "nextjs"
//                 }
//             })
//         }
//     );

//     const data = await res.json();

//     if (!res.ok) {
//         console.error("❌ Vercel deploy error:", JSON.stringify(data, null, 2));
//         throw new Error("Vercel deploy failed");
//     }
//     const deployUrl = `https://${data.url}`;

//     console.log("🌍 Vercel URL:", deployUrl);
//     return {
//         deploymentId: data.id,
//         url: deployUrl
//     };
// }

// module.exports = {
//     deployToVercel
// };
// deploy.js
const fs = require("fs");
const path = require("path");

/* ================= UTILS ================= */

function getFilesFromLocal(dir, fileList = [], rootDir = dir) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // Blacklist folders / files rác
        if (['node_modules', '.next', '.git', 'package-lock.json', 'yarn.lock', 'bun.lockb'].includes(file)) return;

        if (stat.isDirectory()) {
            getFilesFromLocal(filePath, fileList, rootDir);
        } else {
            // Skip binary files để tránh lỗi encoding
            if (/\.(ico|png|jpg|jpeg|gif|webp|pdf|woff|woff2|ttf|eot)$/i.test(file)) return;
            if (file === '.DS_Store' || file.endsWith('.log')) return;

            const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                fileList.push({ file: relativePath, data: content });
            } catch (err) {
                console.warn(`⚠️ Skip file ${file}:`, err.message);
            }
        }
    });
    return fileList;
}

/**
 * Hàm tạo các file cấu hình môi trường chuẩn TypeScript cho Next.js
 */
function injectBaseFiles(existingFiles, projectName) {
    const baseFiles = [
        {
            file: "package.json",
            data: JSON.stringify({
                name: projectName,
                version: "0.1.0",
                private: true,
                scripts: { 
                    "dev": "next dev", 
                    "build": "next build", 
                    "start": "next start",
                    "lint": "next lint"
                },
                dependencies: {
                    "next": "14.2.5",
                    "react": "18.3.1",
                    "react-dom": "18.3.1",
                    "lucide-react": "^0.344.0",
                    "tailwind-merge": "^2.2.1",
                    "clsx": "^2.1.0"
                },
                // Bổ sung DevDependencies để fix lỗi thiếu TypeScript compiler trên Vercel
                "devDependencies": {
                    "typescript": "^5",
                    "@types/node": "^20",
                    "@types/react": "^18",
                    "@types/react-dom": "^18",
                    "postcss": "^8",
                    "tailwindcss": "^3.4.1",
                    "autoprefixer": "^10.4.17"
                }
            }, null, 2)
        },
        {
            file: "tsconfig.json",
            data: JSON.stringify({
                compilerOptions: {
                    target: "es5",
                    lib: ["dom", "dom.iterable", "esnext"],
                    allowJs: true,
                    skipLibCheck: true,
                    strict: true,
                    noEmit: true,
                    esModuleInterop: true,
                    module: "esnext",
                    moduleResolution: "bundler",
                    resolveJsonModule: true,
                    isolatedModules: true,
                    jsx: "preserve",
                    incremental: true,
                    plugins: [{ name: "next" }],
                    paths: { "@/*": ["./src/*"] }
                },
                include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
                exclude: ["node_modules"]
            }, null, 2)
        },
        {
            file: "next.config.mjs",
            data: `/** @type {import('next').NextConfig} */
const nextConfig = { 
    images: { unoptimized: true },
    typescript: { ignoreBuildErrors: true }, // Tùy chọn: Bỏ qua lỗi type để build nhanh hơn
    eslint: { ignoreDuringBuilds: true }    // Tùy chọn: Bỏ qua lỗi linting khi build
};
export default nextConfig;`
        },
        {
            file: "postcss.config.mjs",
            data: `export default { plugins: { tailwindcss: {}, autoprefixer: {}, } };`
        },
        {
            file: "tailwind.config.ts",
            data: `import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [],
};
export default config;`
        },
        {
            file: "src/app/globals.css",
            data: `@tailwind base;\n@tailwind components;\n@tailwind utilities;`
        }
    ];

    // Gộp file: Ưu tiên file base chuẩn, sau đó mới tới file AI gen
    const baseFileNames = baseFiles.map(f => f.file);
    const filteredExisting = existingFiles.filter(f => !baseFileNames.includes(f.file));

    return [...baseFiles, ...filteredExisting];
}

/* ================= DEPLOY ================= */

async function deployToVercel({ projectPath, projectName, vercelToken, teamId }) {
    if (!vercelToken) throw new Error("Missing VERCEL_TOKEN");

    console.log("📂 Preparing files and environment...");
    
    // 1. Quét file từ thư mục tạm (nơi AI gen code)
    let localFiles = getFilesFromLocal(projectPath);

    // 2. Tiêm file cấu hình (Fix lỗi TypeScript và Build)
    const finalFiles = injectBaseFiles(localFiles, projectName);

    console.log(`🚀 Sending ${finalFiles.length} files to Vercel API...`);

    const res = await fetch(
        `https://api.vercel.com/v13/deployments?teamId=${teamId}`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${vercelToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: projectName,
                files: finalFiles,
                target: "production",
                projectSettings: {
                    framework: "nextjs",
                    buildCommand: "npm run build",
                    installCommand: "npm install",
                    nodeVersion: "20.x"
                }
            })
        }
    );

    const data = await res.json();

    if (!res.ok) {
        console.error("❌ Vercel Deployment Error:", JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || "Vercel deploy failed");
    }

    const deployUrl = `https://${data.url}`;
    console.log("✅ Deployment initiated!");
    console.log("🌍 Vercel URL:", deployUrl);

    return {
        deploymentId: data.id,
        url: deployUrl
    };
}

module.exports = { deployToVercel };