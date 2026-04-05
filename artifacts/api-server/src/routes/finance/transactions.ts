import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { transactions } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateTransactionBody,
  BatchAnalyzeTransactionsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildTransactionPrompt(tx: typeof transactions.$inferSelect): string {
  const amountNum = parseFloat(tx.amount);
  const amountFmt = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: tx.currency ?? "BRL",
    maximumFractionDigits: 2,
  }).format(amountNum);

  return `Você é um especialista sênior em análise financeira e compliance de transações bilionárias.

Analise a seguinte transação financeira e forneça:
1. **Avaliação de Risco** (score 0-100): onde 0=sem risco e 100=altíssimo risco
2. **Indicadores de Fraude**: padrões suspeitos, se houver
3. **Análise Regulatória**: conformidade com AML/KYC/BACEN
4. **Recomendação**: Aprovar / Revisar / Bloquear / Escalar para compliance
5. **Justificativa**: explicação técnica detalhada

**Dados da Transação:**
- ID Externo: ${tx.externalId ?? "N/A"}
- Origem: ${tx.fromEntity}
- Destino: ${tx.toEntity}
- Valor: ${amountFmt} (${tx.amount} ${tx.currency})
- Tipo: ${tx.type}
- Status: ${tx.status}
- Gateway: ${tx.gateway ?? "N/A"}
- Metadados: ${tx.metadata ?? "Nenhum"}
- Data: ${tx.createdAt.toISOString()}

Responda de forma estruturada, profissional e objetiva. Inclua o score de risco no início em formato: RISCO: [score]/100`;
}

router.get("/transactions/summary", async (req, res) => {
  try {
    const all = await db.select().from(transactions);

    const totalVolume = all.reduce((s, t) => s + parseFloat(t.amount), 0);
    const avgAmount = all.length > 0 ? totalVolume / all.length : 0;
    const highRiskCount = all.filter((t) => (t.riskScore ?? 0) >= 70).length;

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byGateway: Record<string, number> = {};

    for (const t of all) {
      byType[t.type] = (byType[t.type] ?? 0) + 1;
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      if (t.gateway) byGateway[t.gateway] = (byGateway[t.gateway] ?? 0) + 1;
    }

    res.json({
      totalCount: all.length,
      totalVolume: totalVolume.toFixed(2),
      averageAmount: avgAmount.toFixed(2),
      highRiskCount,
      byType,
      byStatus,
      byGateway,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const { type, status, gateway } = req.query as Record<string, string>;
    let query = db.select().from(transactions).$dynamic();

    if (type) query = query.where(eq(transactions.type, type));
    if (status) query = query.where(eq(transactions.status, status));
    if (gateway) query = query.where(eq(transactions.gateway, gateway));

    const result = await query.orderBy(sql`${transactions.createdAt} desc`);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list transactions" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const body = CreateTransactionBody.parse(req.body);

    const [tx] = await db
      .insert(transactions)
      .values({
        externalId: body.externalId ?? null,
        fromEntity: body.fromEntity,
        toEntity: body.toEntity,
        amount: body.amount,
        currency: body.currency ?? "BRL",
        type: body.type,
        status: body.status ?? "pending",
        gateway: body.gateway ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();

    const prompt = buildTransactionPrompt(tx);
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const analysis = response.choices[0]?.message?.content ?? "";
    const riskMatch = analysis.match(/RISCO:\s*(\d+)/i);
    const riskScore = riskMatch ? Math.min(100, parseInt(riskMatch[1])) : null;

    const [updated] = await db
      .update(transactions)
      .set({ aiAnalysis: analysis, riskScore })
      .where(eq(transactions.id, tx.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create or analyze transaction" });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json(tx);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get transaction" });
  }
});

router.post("/transactions/:id/analyze", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const prompt = buildTransactionPrompt(tx);
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

    const riskMatch = fullAnalysis.match(/RISCO:\s*(\d+)/i);
    const riskScore = riskMatch ? Math.min(100, parseInt(riskMatch[1])) : null;

    await db
      .update(transactions)
      .set({ aiAnalysis: fullAnalysis, riskScore })
      .where(eq(transactions.id, id));

    res.write(`data: ${JSON.stringify({ done: true, riskScore })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Analysis failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

router.post("/transactions/batch-analyze", async (req, res) => {
  try {
    const body = BatchAnalyzeTransactionsBody.parse(req.body);

    let txList: (typeof transactions.$inferSelect)[];
    if (body.ids && body.ids.length > 0) {
      txList = await db
        .select()
        .from(transactions)
        .where(inArray(transactions.id, body.ids));
    } else {
      txList = await db
        .select()
        .from(transactions)
        .orderBy(sql`${transactions.createdAt} desc`)
        .limit(50);
    }

    if (txList.length === 0) {
      res.json({
        analyzed: 0,
        totalAmount: "0.00",
        averageRiskScore: 0,
        highRiskCount: 0,
        summary: "Nenhuma transação encontrada para análise.",
      });
      return;
    }

    const totalAmount = txList.reduce((s, t) => s + parseFloat(t.amount), 0);

    const txSummary = txList
      .map(
        (t) =>
          `- ID ${t.id}: ${t.fromEntity} → ${t.toEntity} | ${t.amount} ${t.currency} | Tipo: ${t.type} | Status: ${t.status} | Risco atual: ${t.riskScore ?? "N/A"}`
      )
      .join("\n");

    const prompt = `Você é um especialista em análise de risco financeiro e compliance de operações bilionárias.

Analise o seguinte lote de ${txList.length} transações e forneça um relatório executivo com:
1. **Padrões Identificados**: correlações, concentração de volume, entidades recorrentes
2. **Riscos Sistêmicos**: vulnerabilidades que afetam múltiplas transações
3. **Alertas Regulatórios**: possíveis violações de AML, FATF, BACEN
4. **Top Riscos**: as 3 transações de maior risco e por quê
5. **Recomendações Estratégicas**: ações imediatas e de médio prazo

**Volume total analisado:** ${new Intl.NumberFormat("pt-BR").format(totalAmount)} (${txList[0]?.currency ?? "BRL"})
**Quantidade:** ${txList.length} transações

**Transações:**
${txSummary}

Seja preciso, objetivo e use linguagem de relatório executivo de compliance financeiro.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = response.choices[0]?.message?.content ?? "";
    const riskScores = txList
      .map((t) => t.riskScore ?? 50)
      .reduce((s, r) => s + r, 0);
    const avgRisk = riskScores / txList.length;
    const highRiskCount = txList.filter((t) => (t.riskScore ?? 0) >= 70).length;

    res.json({
      analyzed: txList.length,
      totalAmount: totalAmount.toFixed(2),
      averageRiskScore: Math.round(avgRisk * 100) / 100,
      highRiskCount,
      summary,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Batch analysis failed" });
  }
});

export default router;
