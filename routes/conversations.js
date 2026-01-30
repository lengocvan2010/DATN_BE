const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
var { generateProjectFiles } = require('../services/generate')
var { deployToVercel } = require('../services/deploy')
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Conversation = require('../models/Conversation');
var Message = require('../models/Message');
var BaDocument = require('../models/BaDocument');
var { requestText, requestImage } = require('../services/gpt');
const PROJECT_NAME = "ui-generated-nextjs";
const PROJECT_PATH = path.resolve(PROJECT_NAME);
const VERCEL_TOKEN = "hnAybBm8we7V3OXQZqrKVdfX";
const TEAM_ID = "team_ZKCstd4SQonwPOCksdvaTqzc";
// ==================== Utility ====================

async function getOrCreateBaDocument(conversationId) {
    const doc = await BaDocument.findOneAndUpdate(
        { conversation_id: conversationId },
        {
            $setOnInsert: {
                conversation_id: conversationId,
                project: {},
                design: {},
                pages: [],
                references: {},
                status: {
                    currentStep: 'pages',
                    missing: [],
                },
            },
        },
        { new: true, upsert: true }
    );
    return doc;
}

function flatten(obj, prefix = '', res = {}) {
    for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, newKey, res);
        } else {
            res[newKey] = value;
        }
    }
    return res;
}

// ==================== BA Agent ====================

async function extractAndUpdate(conversationId, userMessage) {
    const baDoc = await getOrCreateBaDocument(conversationId);

    const prompt = `
You are a Business Analyst AI.

Current BA Document:
${JSON.stringify(baDoc, null, 2)}

New user message:
"${userMessage}"

Task:
1. Extract any new information provided by the user.
2. Update the BA Document accordingly.
3. Do NOT remove existing information unless the user explicitly corrects it.
4. Return ONLY valid JSON in this format:

{
  "updatedFields": { ... },
  "missingFields": [ ... ],
  "currentStep": "project | design | pages | references"
}
`;

    let gptResponse = await requestText(prompt);

    let parsed;
    try {
        parsed = JSON.parse(gptResponse);
    } catch (err) {
        console.error('Failed to parse GPT response:', gptResponse);
        parsed = { updatedFields: {}, missingFields: [], currentStep: 'pages' };
    }

    const update = {
        ...flatten(parsed.updatedFields),
        'status.currentStep': parsed.currentStep,
        'status.missing': parsed.missingFields,
    };

    const updatedDoc = await BaDocument.findOneAndUpdate(
        { conversation_id: conversationId },
        { $set: update },
        { new: true, upsert: true }
    );

    return updatedDoc;
}

async function generateNextQuestion(baDocument) {
    const missing = baDocument.status.missing || [];
    if (missing.length === 0) return null;

    const prompt = `
You are a BA assistant chatting with a user.

Current BA Document:
${JSON.stringify(baDocument, null, 2)}

Missing information:
${JSON.stringify(missing)}

Rules:
- Ask ONLY one question.
- The question must help fill the most important missing field.
- Be short, clear, and friendly.
- Do not mention internal fields or JSON.

Return ONLY the question text.
`;

    const question = await requestText(prompt);
    return question;
}

// ==================== UI GENERATION ====================

async function generateUIDraft(baDoc) {
    const prompt = `
You are a senior UI/UX designer.

Your task is to generate a UI draft based on the BA Document below.

IMPORTANT OUTPUT RULES (STRICT):
- Return ONLY valid JSON
- The ROOT JSON MUST be an ARRAY
- Do NOT wrap the array inside any object
- Do NOT include markdown, comments, or explanation text

Each array item represents ONE PAGE and MUST have this structure:
{
  "pageName": string,
  "layout": string,
  "mainComponents": string[],
  "primaryActions": string[],
  "notes": string
}

Rules:
- One array item = one UI page
- mainComponents MUST be an array of strings
- primaryActions MUST be an array of strings

BA DOCUMENT:
${JSON.stringify(baDoc, null, 2)}
`;


    const result = await requestText(prompt);
    const parsed = JSON.parse(result);

    // ✅ Chuẩn hóa về array
    if (Array.isArray(parsed)) {
        return parsed;
    }

    if (Array.isArray(parsed.pages)) {
        return parsed.pages;
    }

    // fallback an toàn
    return [parsed];
}

async function generateUIImages(uiDraft, baDoc) {
    const images = [];

    for (const page of uiDraft) {
        const prompt = `
You are a professional UI/UX designer.

Create a CLEAN, STRUCTURED UI WIREFRAME for a WEB APPLICATION.

Page name: "${page.pageName}"

Requirements:
- Type: UI wireframe (NOT illustration, NOT marketing poster)
- View: Desktop web app
- Style: Minimal, modern, product-focused
- Color usage: very light use of main color (${baDoc.design?.mainColor || 'blue'})
- Background: white or light gray
- Typography: simple sans-serif
- Layout: ${page.layout}

Components:
${page.mainComponents.map(c => `- ${c}`).join('\n')}

Rules:
- Use boxes, sections, and clear spacing
- No decorative illustrations
- No real photos
- No excessive text
- Must look like a Figma / SaaS wireframe
- Focus on usability and hierarchy

Tone: ${baDoc.design?.tone || 'professional'}
`;

        const imageUrl = await requestImage(prompt);

        images.push({
            page: page.pageName,
            imageUrl,
        });
    }

    return images;
}
function clearLocalProject(projectPath) {
    if (fs.existsSync(projectPath)) {
        console.log(`🧹 Cleaning up: Removing ${projectPath}...`);
        fs.rmSync(projectPath, { recursive: true, force: true });
        console.log("✨ Cleanup finished!");
    }
}
async function runGenerateAndDeploy(uiDraft) {
    // 1. Gen + write local (CHỜ THẬT) 
    await generateProjectFiles(uiDraft, PROJECT_PATH);

    await new Promise(r => setTimeout(r, 2000));

    // 2. Deploy ngay – an toàn
    const deployResult = await deployToVercel({
        projectPath: PROJECT_PATH,
        projectName: PROJECT_NAME,
        vercelToken: VERCEL_TOKEN,
        teamId: TEAM_ID
    });
    clearLocalProject(PROJECT_PATH);
    // 3. Return URL cho caller
    return deployResult?.url;
}

// ==================== Routes ====================

/* GET all conversations (filter by accountId) */
router.get('/', async function (req, res) {
  try {
    const { accountId } = req.query

    // nếu không có accountId → trả mảng rỗng (hoặc error tuỳ bạn)
    if (!accountId) {
      return res.json({
        success: true,
        count: 0,
        data: []
      })
    }

    const conversations = await Conversation
      .find({ accountId })
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    })
  }
})


/* GET first conversation with messages */
router.get('/first-with-messages', async function (req, res, next) {
    try {
        const firstConversation = await Conversation.findOne().sort({ createdAt: -1 });
        if (!firstConversation) return res.json({ success: true, conversation: null, messages: [] });

        const messages = await Message.find({ conversation_id: firstConversation._id }).sort({ createdAt: 1 });
        // const baDoc = await getOrCreateBaDocument(firstConversation._id);

        res.json({ success: true, conversation: firstConversation, messages, messageCount: messages.length });
    } catch (error) {
        console.error('Error fetching first conversation with messages:', error);
        res.status(500).json({ success: false, message: 'Error fetching first conversation', error: error.message });
    }
});

router.get('/with-messages/:conversationId', async function (req, res) {
    try {
        const { conversationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({
                success: false,
                message: 'conversationId không hợp lệ'
            });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.json({
                success: true,
                conversation: null,
                messages: [],
                messageCount: 0
            });
        }

        const messages = await Message
            .find({ conversation_id: conversationId })
            .sort({ createdAt: 1 });

        res.json({
            success: true,
            conversation,
            messages,
            messageCount: messages.length
        });
    } catch (error) {
        console.error('Error fetching conversation with messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching conversation',
            error: error.message
        });
    }
});

async function runBackgroundGenUI(conversationId, updatedBaDoc) {
    try {
        const uiDraft = await generateUIDraft(updatedBaDoc);
        if (!Array.isArray(uiDraft)) {
            throw new Error('UI Draft is not an array');
        }
        console.log("🤖 UI Draft generated successfully:", uiDraft.length);
        const uiImages = await generateUIImages(uiDraft, updatedBaDoc);
        console.log("🤖 UI Images generated successfully:", uiImages.length);
        // Message: UI draft + sketch
        await Message.create({
            conversation_id: conversationId,
            role: 'bot',
            uiDraft,
            uiImages,
            type: 2,
        });

    } catch (err) {
        console.error('Background GEN UI error:', err);

        await Message.create({
            conversation_id: conversationId,
            content: 'Có lỗi khi tạo UI draft / sketch.',
            role: 'bot',
            type: 1,
        });
    }
}
async function runBackgroundCodeGen(conversationId) {
    try {
        // Lấy Message cuối cùng có chứa uiDraft (thiết kế mới nhất)
        const lastDesignMessage = await Message.findOne({
            conversation_id: conversationId,
            // type: 2,
            uiDraft: {
                $exists: true,
                $ne: null,
                $not: { $size: 0 } 
            }
        }).sort({ createdAt: -1 });

        if (!lastDesignMessage || !lastDesignMessage.uiDraft) {
            throw new Error("Không tìm thấy bản thiết kế (uiDraft) để generate code.");
        }

        // Thông báo bắt đầu gen
        await Message.create({
            conversation_id: conversationId,
            content: "🚀 Hệ thống bắt đầu generate source code và deploy lên Vercel. Vui lòng đợi trong vài phút...",
            role: 'bot',
            type: 1,
        });

        // 1. Chạy gen code và deploy (Sử dụng hàm bạn đã có)
        const url = await runGenerateAndDeploy(lastDesignMessage.uiDraft);

        // 2. Thông báo hoàn tất kèm link
        await Message.create({
            conversation_id: conversationId,
            content: `Thành công, website đã được xây dựng xong!\n\n🔗 Preview URL: ${url}\n\nBạn có thể truy cập để kiểm tra thiết kế thực tế.`,
            role: 'bot',
            type: 1,
        });

    } catch (err) {
        console.error('Background CodeGen error:', err);
        await Message.create({
            conversation_id: conversationId,
            content: `Thất bại, quá trình generate code gặp lỗi: ${err.message}`,
            role: 'bot',
            type: 1,
        });
    }
}

/* POST new message (user) */
router.post('/newmessage', async function (req, res, next) {
    try {
        const { message } = req.body;
        if (!message || !message.content) return res.status(400).json({ success: false, message: 'Message is required' });

        let conversationId = message.conversation_id ?? null;

        // Tạo conversation mới nếu chưa có
        if (!conversationId) {
            const newConversation = new Conversation({
                accountId: message.accountId,
                title: message.content
                    ?.trim()
                    .split(/\s+/)
                    .slice(0, 5)
                    .join(' ') || '',
                createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
            });
            const savedConversation = await newConversation.save();
            conversationId = savedConversation._id;
        }
        console.log(message.isGenCode)
        // Lưu message user
        await Message.create({
            conversation_id: conversationId,
            content: message.content,
            uiImages: message.uiImages,
            uiDraft: message.uiDraft,
            role: message.role || 'user',
            type: message.type || 1,
            createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
        });

        if (message.isGenCode === true) {
            // Chạy ngầm logic gen & deploy


            await Message.create({
                conversation_id: conversationId,
                content: `Đang bắt đầu quá trình xây dựng. Vui lòng chờ...`,
                role: 'bot',
                type: 1,
            });
            const conversations = await Conversation.find({}).sort({ updatedAt: -1 });
            const loadMessages = await Message.find({ conversation_id: conversationId }).sort({ createdAt: 1 });
            
            setImmediate(() => {
                runBackgroundCodeGen(conversationId);
            });
            console.log("🤖 vanln :", conversations);
            console.log("🤖 vanln :", loadMessages);
            res.json({
                success: true,
                data: {
                    conversations,
                    loadMessages,
                    baDocument: null,
                    nextQuestion: null,
                },
            });
        } else {
            // STEP 1: extract info & update BaDocument
            const updatedBaDoc = await extractAndUpdate(conversationId, message.content);

            // STEP 2: generate next question
            const nextQuestion = await generateNextQuestion(updatedBaDoc);

            let uiDraft = null;
            let uiImages = null;

            if (!nextQuestion) {
                // 1. Generate UI
                // const uiDraft = await generateUIDraft(updatedBaDoc);
                // if (!Array.isArray(uiDraft)) {
                //     throw new Error('UI Draft is not an array');
                // }
                // const uiImages = await generateUIImages(uiDraft, updatedBaDoc);

                // // updatedBaDoc.uiDraft = uiDraft;
                // // updatedBaDoc.uiImages = uiImages;
                // // await updatedBaDoc.save();

                // // 2. Message: UI images
                // await Message.create({
                //     conversation_id: conversationId,
                //     role: 'bot',
                //     uiDraft: uiDraft,
                //     uiImages: uiImages,
                //     type: 2,
                // });

                // // 3. Message: waiting
                // await Message.create({
                //     conversation_id: conversationId,
                //     content: "Xin vui lòng chờ trong giây lát...",
                //     role: 'bot',
                //     type: 1,
                // });

                // // 4. Generate + deploy (PHẢI await)
                // const url = await runGenerateAndDeploy(uiDraft);

                // // 5. Message: done
                // await Message.create({
                //     conversation_id: conversationId,
                //     content: `UI đã được xây dựng xong. Truy cập ${url} để xem trước và download source code.`,
                //     role: 'bot',
                //     type: 1,
                // });

                setImmediate(() => {
                    runBackgroundGenUI(conversationId, updatedBaDoc);
                });

                await Message.create({
                    conversation_id: conversationId,
                    content: `Xin vui lòng chờ...`,
                    role: 'bot',
                    type: 1,
                });

            } else {
                await Message.create({
                    conversation_id: conversationId,
                    content: nextQuestion,
                    role: 'bot',
                    type: 1,
                });
            }

            const conversations = await Conversation.find({accountId: message.accountId}).sort({ updatedAt: -1 });
            const loadMessages = await Message.find({ conversation_id: conversationId }).sort({ createdAt: 1 });

            res.json({
                success: true,
                data: {
                    conversations,
                    loadMessages,
                    baDocument: updatedBaDoc,
                    nextQuestion,
                },
            });
        }


    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ success: false, message: 'Error saving message', error: error.message });
    }
});

module.exports = router;
