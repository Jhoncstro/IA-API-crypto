import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import {
  voiceChatStream,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import { SendOpenaiVoiceMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/conversations/:id/voice-messages", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const body = SendOpenaiVoiceMessageBody.parse(req.body);

    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const audioBuffer = Buffer.from(body.audio, "base64");
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await voiceChatStream(buffer, "alloy", format);

    let userTranscript = "";
    let assistantTranscript = "";

    for await (const event of stream) {
      if (event.type === "user_transcript") {
        userTranscript += event.data;
      } else if (event.type === "transcript") {
        assistantTranscript += event.data;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    await db.insert(messagesTable).values([
      { conversationId: id, role: "user", content: userTranscript },
      {
        conversationId: id,
        role: "assistant",
        content: assistantTranscript,
      },
    ]);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process voice message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

export default router;
