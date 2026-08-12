import axios from "axios";
import "dotenv/config";
import { matchFaq } from "../config/botFaq";
import {
  sendMessage,
  toggleConversationStatus,
} from "./chatwoot";

const BOT_TOKEN = process.env.BOT_CHAT_TOKEN;
const AI_PROVIDER = (process.env.AI_PROVIDER || "none").toLowerCase();
const THRESHOLD = parseFloat(process.env.BOT_CONFIDENCE_THRESHOLD || "0.7");

async function callOpenAI(text) {
  const { data } = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You are a customer support bot. Answer the customer concisely in the same language they wrote. Respond with strict JSON: {"answer": "<reply text or empty string>", "confidence": <0-1 number>}. Use confidence < 0.5 and empty answer when you cannot confidently answer.',
        },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } },
  );
  return JSON.parse(data.choices[0].message.content);
}

async function callAnthropic(text) {
  const { data } = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 512,
      system:
        'You are a customer support bot. Answer concisely in the customer\'s language. Respond with strict JSON: {"answer": "...", "confidence": 0.0-1.0}. Use confidence < 0.5 and empty answer when unsure.',
      messages: [{ role: "user", content: text }],
    },
    {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    },
  );
  const content = data.content?.[0]?.text || "{}";
  const match = content.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : "{}");
}

async function callGemini(text) {
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-1.5-flash"}:generateContent`,
    {
      contents: [
        {
          parts: [
            {
              text: `You are a customer support bot. Answer concisely in the customer's language. Respond with strict JSON: {"answer": "...", "confidence": 0.0-1.0}. Use confidence < 0.5 and empty answer when unsure. Customer message: ${text}`,
            },
          ],
        },
      ],
    },
    { params: { key: process.env.GEMINI_API_KEY } },
  );
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const match = content.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : "{}");
}

export async function generateBotReply(text) {
  let result = null;
  if (AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    result = await callOpenAI(text);
  } else if (AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    result = await callAnthropic(text);
  } else if (AI_PROVIDER === "gemini" && process.env.GEMINI_API_KEY) {
    result = await callGemini(text);
  }

  if (result && typeof result.confidence === "number" && result.answer) {
    return {
      reply: String(result.answer).trim(),
      confidence: result.confidence,
    };
  }

  const faqAnswer = matchFaq(text);
  if (faqAnswer) {
    return { reply: faqAnswer, confidence: 1 };
  }
  return { reply: null, confidence: 0 };
}

export async function sendBotReply(accountId, conversationId, content) {
  if (!BOT_TOKEN) {
    console.error("BOT_CHAT_TOKEN is not set in .env");
    return null;
  }
  return sendMessage(accountId, conversationId, BOT_TOKEN, {
    content,
    message_type: "outgoing",
    private: false,
  });
}

export async function handoffToHuman(accountId, conversationId) {
  if (!BOT_TOKEN) {
    console.error("BOT_CHAT_TOKEN is not set in .env");
    return null;
  }
  return toggleConversationStatus(accountId, conversationId, BOT_TOKEN, "open");
}

export { THRESHOLD };
