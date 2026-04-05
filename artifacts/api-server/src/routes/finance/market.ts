import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { marketAssets } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateMarketAssetBody,
  GetMarketOverviewBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildAssetPrompt(asset: typeof marketAssets.$inferSelect): string {
  const change = asset.changePct ? `${parseFloat(asset.changePct) >= 0 ? "+" : ""}${asset.changePct}%` : "N/A";
  return `Você é um analista financeiro sênior especializado em mercados de capitais e ativos bilionários.

Analise o seguinte ativo financeiro e forneça:
1. **Análise Técnica**: tendências de preço, suporte/resistência, momentum
2. **Análise Fundamentalista**: valuation, market cap, liquidez
3. **Contexto de Mercado**: correlação com setor e índices relevantes
4. **Sinal de Operação**: COMPRA_FORTE / COMPRA / NEUTRO / VENDA / VENDA_FORTE — inclua no início como SINAL: [sinal]
5. **Score de Confiança** (0-100): confiança no sinal — inclua como CONFIANÇA: [score]/100
6. **Alvos de Preço**: target de alta e suporte de baixa
7. **Riscos**: fatores que podem invalidar a análise
8. **Horizonte Recomendado**: curto / médio / longo prazo

**Dados do Ativo:**
- Símbolo: ${asset.symbol}
- Nome: ${asset.name}
- Tipo: ${asset.assetType}
- Preço Atual: ${asset.currentPrice ?? "N/A"}
- Abertura: ${asset.openPrice ?? "N/A"}
- Fechamento: ${asset.closePrice ?? "N/A"}
- Máxima: ${asset.highPrice ?? "N/A"}
- Mínima: ${asset.lowPrice ?? "N/A"}
- Volume: ${asset.volume ?? "N/A"}
- Market Cap: ${asset.marketCap ?? "N/A"}
- Variação: ${change}
- Data dos Dados: ${asset.dataDate ?? "N/A"}

Responda com análise profissional no padrão de relatório de research de banco de investimentos.`;
}

router.get("/market/overview", async (req, res) => {
  res.status(405).json({ error: "Use POST /finance/market/overview" });
});

router.post("/market/overview", async (req, res) => {
  try {
    const body = GetMarketOverviewBody.parse(req.body);

    let assets: (typeof marketAssets.$inferSelect)[];
    if (body.symbols && body.symbols.length > 0) {
      assets = await db
        .select()
        .from(marketAssets)
        .where(inArray(marketAssets.symbol, body.symbols));
    } else {
      assets = await db
        .select()
        .from(marketAssets)
        .orderBy(sql`${marketAssets.updatedAt} desc`);
    }

    if (assets.length === 0) {
      res.status(404).json({ error: "No market assets found" });
      return;
    }

    const assetsSummary = assets
      .map(
        (a) =>
          `- ${a.symbol} (${a.name}) | ${a.assetType} | Preço: ${a.currentPrice ?? "N/A"} | Variação: ${a.changePct ?? "N/A"}% | Volume: ${a.volume ?? "N/A"} | Sinal IA: ${a.aiSignal ?? "não analisado"}`
      )
      .join("\n");

    const totalMarketCap = assets
      .filter((a) => a.marketCap)
      .reduce((s, a) => s + parseFloat(a.marketCap!), 0);

    const prompt = `Você é o chefe de research de um banco de investimentos com foco em ativos de alto valor.

Produza um relatório de visão geral de mercado (market overview) para a carteira monitorada:

1. **Panorama Geral**: sentimento de mercado, tendências macro
2. **Performance da Carteira**: ativos em destaque positivo e negativo
3. **Setores e Correlações**: padrões entre tipos de ativos
4. **Alertas e Oportunidades**: movimentos relevantes que merecem atenção imediata
5. **Estratégia Recomendada**: alocação sugerida por tipo de ativo
6. **Riscos Macro**: fatores externos que podem impactar o portfólio
7. **Índice de Sentimento**: OTIMISTA / NEUTRO / PESSIMISTA com justificativa

**Carteira Monitorada (${assets.length} ativos):**
${assetsSummary}

**Market Cap Total da Carteira:** ${new Intl.NumberFormat("pt-BR").format(totalMarketCap)}

Escreva no padrão de morning call de banco de investimentos — objetivo, técnico e acionável.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Market overview failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

router.get("/market", async (req, res) => {
  try {
    const { assetType } = req.query as Record<string, string>;
    let query = db.select().from(marketAssets).$dynamic();
    if (assetType) query = query.where(eq(marketAssets.assetType, assetType));
    const result = await query.orderBy(sql`${marketAssets.updatedAt} desc`);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list market assets" });
  }
});

router.post("/market", async (req, res) => {
  try {
    const body = CreateMarketAssetBody.parse(req.body);
    const [asset] = await db
      .insert(marketAssets)
      .values({
        symbol: body.symbol,
        name: body.name,
        assetType: body.assetType,
        currentPrice: body.currentPrice ?? null,
        openPrice: body.openPrice ?? null,
        closePrice: body.closePrice ?? null,
        highPrice: body.highPrice ?? null,
        lowPrice: body.lowPrice ?? null,
        volume: body.volume ?? null,
        marketCap: body.marketCap ?? null,
        changePct: body.changePct ?? null,
        dataDate: body.dataDate ?? null,
      })
      .returning();
    res.status(201).json(asset);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create market asset" });
  }
});

router.post("/market/:id/analyze", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [asset] = await db
      .select()
      .from(marketAssets)
      .where(eq(marketAssets.id, id));
    if (!asset) {
      res.status(404).json({ error: "Market asset not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const prompt = buildAssetPrompt(asset);
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

    const signalMatch = fullAnalysis.match(/SINAL:\s*([A-Z_]+)/i);
    const aiSignal = signalMatch ? signalMatch[1].toUpperCase() : null;

    await db
      .update(marketAssets)
      .set({
        aiAnalysis: fullAnalysis,
        aiSignal,
        updatedAt: new Date(),
      })
      .where(eq(marketAssets.id, id));

    res.write(`data: ${JSON.stringify({ done: true, aiSignal })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Asset analysis failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

export default router;
