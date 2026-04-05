import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { gateways, transactions } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CreateGatewayBody } from "@workspace/api-zod";

const router: IRouter = Router();

function buildGatewayPrompt(gw: typeof gateways.$inferSelect, txCount: number, totalVol: number): string {
  return `Você é um especialista em infraestrutura de pagamentos e análise de performance de gateways financeiros.

Analise o seguinte gateway de pagamento e forneça:
1. **Diagnóstico de Performance**: avaliação da taxa de sucesso, latência e volume
2. **Comparação com Benchmarks do Setor**: o que é esperado para um gateway desta categoria
3. **Riscos Operacionais**: pontos de falha, gargalos, riscos de disponibilidade
4. **Riscos de Compliance**: questões regulatórias, PCI-DSS, BACEN
5. **Recomendações**: melhorias técnicas e operacionais prioritárias
6. **Score de Saúde** (0-100): saúde geral do gateway — inclua no início como SAÚDE: [score]/100

**Dados do Gateway:**
- Nome: ${gw.name}
- Provedor: ${gw.provider}
- Status: ${gw.status}
- Volume Total Processado: ${gw.totalVolume ?? "N/A"}
- Transações Registradas: ${txCount} (${gw.transactionCount ?? 0} acumuladas)
- Volume Total Calculado: ${new Intl.NumberFormat("pt-BR").format(totalVol)}
- Taxa de Sucesso: ${gw.successRate ?? "N/A"}%
- Latência Média: ${gw.avgLatencyMs ?? "N/A"}ms
- Cadastrado em: ${gw.createdAt.toISOString()}

Responda de forma técnica e executiva.`;
}

router.get("/gateways", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(gateways)
      .orderBy(sql`${gateways.createdAt} desc`);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list gateways" });
  }
});

router.post("/gateways", async (req, res) => {
  try {
    const body = CreateGatewayBody.parse(req.body);
    const [gw] = await db
      .insert(gateways)
      .values({
        name: body.name,
        provider: body.provider,
        totalVolume: body.totalVolume ?? null,
        transactionCount: body.transactionCount ?? null,
        successRate: body.successRate ?? null,
        avgLatencyMs: body.avgLatencyMs ?? null,
        status: body.status ?? "active",
      })
      .returning();
    res.status(201).json(gw);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create gateway" });
  }
});

router.get("/gateways/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [gw] = await db
      .select()
      .from(gateways)
      .where(eq(gateways.id, id));
    if (!gw) {
      res.status(404).json({ error: "Gateway not found" });
      return;
    }
    res.json(gw);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get gateway" });
  }
});

router.post("/gateways/:id/analyze", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [gw] = await db
      .select()
      .from(gateways)
      .where(eq(gateways.id, id));
    if (!gw) {
      res.status(404).json({ error: "Gateway not found" });
      return;
    }

    const gwTxs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.gateway, gw.name));

    const totalVol = gwTxs.reduce((s, t) => s + parseFloat(t.amount), 0);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const prompt = buildGatewayPrompt(gw, gwTxs.length, totalVol);
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let fullAnalysis = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullAnalysis += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db
      .update(gateways)
      .set({
        aiAnalysis: fullAnalysis,
        lastAnalyzedAt: new Date(),
        transactionCount: gwTxs.length,
        totalVolume: totalVol.toFixed(2),
      })
      .where(eq(gateways.id, id));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Gateway analysis failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

export default router;
