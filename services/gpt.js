const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment variables");

const openai = new OpenAI({ apiKey });

async function requestText(prompt) {
  const response = await openai.responses.create({
    model: "gpt-5.1",
    input: prompt,
  });
  return response.output_text ?? "";
}

async function requestCode(prompt) {
  const response = await openai.responses.create({
    model: "gpt-5.1",
    input: [
      { role: "system", content: "You are a senior software engineer. Write clean, correct, production-ready code. Avoid unnecessary explanation unless requested." },
      { role: "user", content: prompt },
    ],
  });
  return response.output_text ?? "";
}

async function requestImage(prompt) {
  const result = await openai.images.generate({
    model: "gpt-image-1-mini",
    prompt,
    size: "1024x1024",
  });

  if (!result.data?.length) {
    throw new Error("Image generation failed");
  }

  return `data:image/png;base64,${result.data[0].b64_json}`;
}

module.exports = { openai, requestText, requestCode, requestImage };
