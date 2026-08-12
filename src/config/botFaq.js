export const BOT_FAQ = [
  {
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon"],
    answer:
      "Hello! Welcome to our support. How can I help you today?",
  },
  {
    keywords: ["price", "pricing", "cost", "how much"],
    answer:
      "Could you please share more details about which product or service you are asking about? Our team will get back to you shortly.",
  },
  {
    keywords: ["hours", "open", "opening", "working hours"],
    answer:
      "Our working hours are 9:00 AM to 5:30 PM, Monday to Friday.",
  },
  {
    keywords: ["human", "agent", "support", "help", "contact"],
    answer:
      "I will connect you with one of our support agents shortly. Please hold on.",
  },
  {
    keywords: ["bye", "goodbye", "thank", "thanks"],
    answer: "You're welcome! Have a great day.",
  },
];

export function matchFaq(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .trim();
  if (!normalized) return null;
  const match = BOT_FAQ.find((item) =>
    item.keywords.some((k) => normalized.includes(k)),
  );
  return match ? match.answer : null;
}
