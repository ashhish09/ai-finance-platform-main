"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function cleanAiText(raw = "") {
  return String(raw).replace(/```(?:json)?\n?/g, "").trim();
}

function cleanCoachReply(text = "") {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");
}

function getAvailableProviders() {
  return {
    mistral: Boolean(process.env.MISTRAL_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };
}

function getProviderOrder() {
  const preferred = String(process.env.AI_PROVIDER || "mistral").toLowerCase();
  const has = getAvailableProviders();
  const ordered = preferred === "gemini" ? ["gemini", "mistral"] : ["mistral", "gemini"];
  return ordered.filter((provider) => has[provider]);
}

async function invokeAiModel({ systemPrompt, prompt }) {
  const providerOrder = getProviderOrder();
  const modelConfig = {
    mistral: process.env.MISTRAL_MODEL || "mistral-large-latest",
    gemini: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  };

  if (!providerOrder.length) {
    throw new Error(
      "No AI key configured. Set MISTRAL_API_KEY or GEMINI_API_KEY in .env."
    );
  }

  const providerErrors = [];
  for (const provider of providerOrder) {
    try {
      if (provider === "mistral") {
        const lcModel = new ChatMistralAI({
          apiKey: process.env.MISTRAL_API_KEY,
          model: modelConfig.mistral,
          temperature: 0.4,
        });
        const response = await lcModel.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(prompt),
        ]);
        return {
          text: cleanAiText(response.content || ""),
          aiMeta: {
            provider: "mistral",
            model: modelConfig.mistral,
            usingRealModel: true,
            fallbackUsed: false,
            note: "Using Mistral via LangChain.",
          },
        };
      }

      const model = genAI.getGenerativeModel({ model: modelConfig.gemini });
      const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
      return {
        text: cleanAiText(result.response.text()),
        aiMeta: {
          provider: "gemini",
          model: modelConfig.gemini,
          usingRealModel: true,
          fallbackUsed: false,
          note: "Using Gemini API.",
        },
      };
    } catch (error) {
      providerErrors.push(`${provider}: ${error?.message || "unknown error"}`);
    }
  }

  throw new Error(
    `AI model call failed for configured providers. ${providerErrors.join(" | ")}`
  );
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function summarizeTransactions(transactions) {
  return transactions.reduce(
    (acc, transaction) => {
      const amount = transaction.amount.toNumber();
      if (transaction.type === "INCOME") {
        acc.income += amount;
      } else {
        acc.expense += amount;
        acc.byCategory[transaction.category] =
          (acc.byCategory[transaction.category] || 0) + amount;
      }
      return acc;
    },
    { income: 0, expense: 0, byCategory: {} }
  );
}

function classifyBudgetRule(category = "") {
  const needs = [
    "housing",
    "rent",
    "utilities",
    "bills",
    "groceries",
    "food",
    "transport",
    "transportation",
    "healthcare",
    "insurance",
    "education",
  ];
  const wants = ["shopping", "entertainment", "travel", "gifts", "personal"];
  const name = String(category).toLowerCase();

  if (needs.some((item) => name.includes(item))) return "needs";
  if (wants.some((item) => name.includes(item))) return "wants";
  return "savings";
}

function getMeanAndStd(values = []) {
  if (!values.length) return { mean: 0, std: 0 };
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

async function getUserAndAccounts() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { accounts: true },
  });

  if (!user) throw new Error("User not found");

  return user;
}

export async function getAiCoachContext() {
  const user = await getUserAndAccounts();
  const { start, end } = getCurrentMonthRange();
  const defaultAccount =
    user.accounts.find((account) => account.isDefault) || user.accounts[0] || null;

  const transactions = await db.transaction.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lte: end },
    },
    orderBy: { date: "desc" },
    take: 250,
  });

  const summary = summarizeTransactions(transactions);
  const disposableIncome = Math.max(summary.income - summary.expense, 0);
  const sortedCategories = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);

  return {
    accountBalance: defaultAccount ? defaultAccount.balance.toNumber() : 0,
    disposableIncome,
    monthlyIncome: summary.income,
    monthlyExpense: summary.expense,
    topSpendingCategories: sortedCategories.slice(0, 5).map(([name, amount]) => ({
      name,
      amount,
    })),
    accountName: defaultAccount?.name || "No account",
    currency: "INR",
  };
}

export async function askFinancialCoach({
  message,
  favorites = [],
  favoriteProducts = [],
  chatHistory = [],
}) {
  const context = await getAiCoachContext();

  const prompt = `User context:
- Account: ${context.accountName}
- Current balance: Rs ${context.accountBalance.toFixed(2)}
- Monthly income: Rs ${context.monthlyIncome.toFixed(2)}
- Monthly expense: Rs ${context.monthlyExpense.toFixed(2)}
- Disposable income: Rs ${context.disposableIncome.toFixed(2)}
- Favorite goals/items: ${favorites.length ? favorites.join(", ") : "None selected"}
- Favorite specific products: ${
    favoriteProducts.length
      ? favoriteProducts
          .map((item) => `${item.name} (target Rs ${Number(item.targetPrice || 0).toFixed(0)})`)
          .join(", ")
      : "None selected"
  }
- Top spending categories: ${context.topSpendingCategories
    .map((item) => `${item.name} (Rs ${item.amount.toFixed(2)})`)
    .join(", ") || "No expenses yet"}
- Recent conversation:
${chatHistory
  .slice(-6)
  .map((item) => `${item.role}: ${item.content}`)
  .join("\n") || "No previous messages"}

User message:
${message}

Return JSON only:
{
  "reply": "3-6 short lines only. Plain text. No markdown bold. No hype. Use only numbers from user context. Do not invent funds/apps/stocks unless user explicitly asks for examples.",
  "prioritySuggestion": "single short actionable top suggestion in one line",
  "riskLevel": "LOW | MEDIUM | HIGH"
}`;

  try {
    const { text, aiMeta } = await invokeAiModel({
      systemPrompt:
        "You are MoneyMind AI. Give practical, internet-aware style advice. Use INR context for finance. Return strict JSON only.",
      prompt,
    });

    const parsed = JSON.parse(text);
    return {
      success: true,
      ...parsed,
      reply: cleanCoachReply(parsed.reply),
      context,
      aiMeta,
    };
  } catch (error) {
    return {
      success: true,
      reply:
        "Focus on needs first and keep wants below 30% of your monthly income. Build an emergency fund of at least 3 months of expenses.",
      prioritySuggestion:
        context.disposableIncome > 0
          ? "Use part of your disposable income for a high-priority goal."
          : "Reduce one high-spend category this week to create savings room.",
      riskLevel: context.monthlyExpense > context.monthlyIncome ? "HIGH" : "MEDIUM",
      context,
      aiMeta: {
        provider: "none",
        model: "offline-fallback",
        usingRealModel: false,
        fallbackUsed: true,
        note:
          error?.message ||
          "AI model call failed. Showing fallback guidance.",
      },
    };
  }
}

export async function searchProductsByBudget({ query, budget }) {
  const safeBudget = Number(budget) || 0;
  if (!query?.trim()) return { success: true, products: [] };

  let source = "real-marketplace";
  let marketProducts = [];
  const normalizedQuery = String(query).toLowerCase().replace(/\s+/g, "");
  const rawQuery = String(query).toLowerCase().trim();
  const queryTokens = String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const includesBrandIntent =
    normalizedQuery.includes("oneplus") ||
    normalizedQuery.includes("iphone") ||
    normalizedQuery.includes("samsung");

  try {
    const siteCodes = ["MLA", "MLM", "MLB"];
    const responses = await Promise.all(
      siteCodes.map((site) =>
        fetch(
          `https://api.mercadolibre.com/sites/${site}/search?q=${encodeURIComponent(query)}&limit=40`,
          { cache: "no-store" }
        )
      )
    );
    const datasets = await Promise.all(
      responses.map(async (res) => (res.ok ? await res.json() : { results: [] }))
    );

    marketProducts = datasets.flatMap((marketData, idx) =>
      (marketData.results || []).map((item) => ({
        title: item.title,
        brand: item.attributes?.find((attr) => attr.id === "BRAND")?.value_name || "Marketplace",
        image: item.thumbnail,
        link:
          item.permalink ||
          `https://listado.mercadolibre.com.${idx === 0 ? "ar" : idx === 1 ? "mx" : "br"}/${encodeURIComponent(
            query
          )}`,
        price: item.price,
        currency: item.currency_id || "ARS",
      }))
    );
  } catch (error) {
    // Ignore market source failure.
  }

  // Fallback source 1: DummyJSON (public internet API, broad product categories)
  try {
    const res = await fetch(
      `https://dummyjson.com/products/search?q=${encodeURIComponent(query)}&limit=60`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const list = (data.products || []).map((item) => ({
        title: item.title,
        brand: item.brand || "Generic",
        image: item.thumbnail || (item.images && item.images[0]) || "",
        link: `https://dummyjson.com/products/${item.id}`,
        price: Number(item.price || 0),
        currency: "USD",
      }));
      if (list.length > 0) {
        marketProducts = [...marketProducts, ...list];
        if (source === "real-marketplace") source = "real-marketplace + dummyjson";
      }
    }
  } catch (error) {
    // Ignore fallback source failure.
  }

  // Fallback source 1b: DummyJSON category fetch for common intent words
  const categoryMap = [
    { keys: ["shoe", "shoes", "sneaker"], slug: "mens-shoes" },
    { keys: ["heel", "heels", "women shoes", "sandals"], slug: "womens-shoes" },
    { keys: ["laptop", "notebook", "macbook"], slug: "laptops" },
    { keys: ["phone", "mobile", "smartphone", "oneplus", "one plus", "iphone"], slug: "smartphones" },
    { keys: ["watch", "smartwatch"], slug: "mens-watches" },
    { keys: ["bike", "motorcycle"], slug: "motorcycle" },
    { keys: ["car", "cars", "vehicle"], slug: "vehicle" },
  ];
  const categoryMatch = categoryMap.find((item) => item.keys.some((key) => rawQuery.includes(key)));
  if (categoryMatch) {
    try {
      const res = await fetch(
        `https://dummyjson.com/products/category/${encodeURIComponent(categoryMatch.slug)}?limit=40`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const list = (data.products || []).map((item) => ({
          title: item.title,
          brand: item.brand || "Generic",
          image: item.thumbnail || (item.images && item.images[0]) || "",
          link: `https://dummyjson.com/products/${item.id}`,
          price: Number(item.price || 0),
          currency: "USD",
        }));
        if (list.length > 0) {
          marketProducts = [...marketProducts, ...list];
          source = source === "real-marketplace" ? "dummyjson-category" : `${source} + dummyjson-category`;
        }
      }
    } catch (error) {
      // Ignore category fallback failure.
    }
  }

  // Fallback source 2: FakeStore API (public internet catalog)
  try {
    const res = await fetch("https://fakestoreapi.com/products", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const list = (Array.isArray(data) ? data : [])
        .filter((item) =>
          String(item.title || "")
            .toLowerCase()
            .includes(String(query).toLowerCase())
        )
        .map((item) => ({
          title: item.title,
          brand: item.category || "Generic",
          image: item.image || "",
          link: `https://fakestoreapi.com/products/${item.id}`,
          price: Number(item.price || 0),
          currency: "USD",
        }));
      if (list.length > 0) {
        marketProducts = [...marketProducts, ...list];
        if (!source.includes("fakestore")) source = `${source} + fakestore`;
      }
    }
  } catch (error) {
    // Ignore fallback source failure.
  }

  // Fallback source 3: Platzi Fake Store API (public internet catalog)
  try {
    const res = await fetch(
      `https://api.escuelajs.co/api/v1/products/?title=${encodeURIComponent(query)}&offset=0&limit=50`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const list = (Array.isArray(data) ? data : []).map((item) => ({
        title: item.title,
        brand: item.category?.name || "Generic",
        image: item.images?.[0] || "",
        link: `https://api.escuelajs.co/api/v1/products/${item.id}`,
        price: Number(item.price || 0),
        currency: "USD",
      }));
      if (list.length > 0) {
        marketProducts = [...marketProducts, ...list];
        if (!source.includes("escuelajs")) source = `${source} + escuelajs`;
      }
    }
  } catch (error) {
    // Ignore fallback source failure.
  }

  const merged = [...marketProducts];
  if (!merged.length) {
    return {
      success: false,
      products: [],
      cheapestProduct: null,
      hasAffordableResults: false,
      budgetUsed: safeBudget,
      source: "unavailable",
      message: "No live marketplace data available right now.",
    };
  }

  const usdToInr = 83;
  const arsToInr = 0.09;
  const dedupMap = new Map();
  merged.forEach((item) => {
    const key = `${String(item.title || "").trim().toLowerCase()}|${Number(item.price || 0).toFixed(2)}`;
    if (!dedupMap.has(key)) {
      const currency = String(item.currency || "USD").toUpperCase();
      const convertedPrice =
        currency === "INR"
          ? Number(item.price || 0)
          : currency === "USD"
            ? Number(item.price || 0) * usdToInr
            : Number(item.price || 0) * arsToInr;
      dedupMap.set(key, {
        id: key,
        title: item.title,
        brand: item.brand || "Generic",
        image: item.image,
        link: item.link,
        priceInr: convertedPrice,
      });
    }
  });

  const keywordMatched = Array.from(dedupMap.values())
    .filter((product) => {
      const hay = `${product.title} ${product.brand}`.toLowerCase().replace(/\s+/g, "");
      if (includesBrandIntent && normalizedQuery.includes("oneplus")) {
        return hay.includes("oneplus");
      }
      // Allow partial token matching so broad terms like "shoes" return more results.
      return queryTokens.some((token) => hay.includes(token.replace(/\s+/g, "")));
    })
    .sort((a, b) => a.priceInr - b.priceInr);

  const normalized =
    keywordMatched.length > 0
      ? keywordMatched
      : Array.from(dedupMap.values()).sort((a, b) => a.priceInr - b.priceInr);

  const underBudget = normalized.filter((product) => product.priceInr <= safeBudget);
  const products = underBudget.length > 0 ? underBudget.slice(0, 30) : normalized.slice(0, 30);
  const hasAffordableResults = underBudget.length > 0;
  const cheapestProduct = normalized[0] || null;

  return {
    success: true,
    products,
    cheapestProduct,
    hasAffordableResults,
    budgetUsed: safeBudget,
    source,
  };
}

export async function getAdvancedAiInsights() {
  const user = await getUserAndAccounts();
  const now = new Date();
  const start90Days = new Date(now);
  start90Days.setDate(now.getDate() - 90);

  const transactions = await db.transaction.findMany({
    where: {
      userId: user.id,
      date: { gte: start90Days, lte: now },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  const expenses = transactions.filter((transaction) => transaction.type === "EXPENSE");
  const expenseValues = expenses.map((transaction) => transaction.amount.toNumber());
  const { mean, std } = getMeanAndStd(expenseValues);
  const anomalyThreshold = mean + std * 1.8;

  const anomalies = expenses
    .filter((transaction) => transaction.amount.toNumber() >= anomalyThreshold)
    .slice(0, 5)
    .map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount.toNumber(),
      category: transaction.category,
      description: transaction.description || "Expense",
      date: transaction.date,
    }));

  const groupedBySignature = expenses.reduce((acc, transaction) => {
    const signature = `${(transaction.description || "").trim().toLowerCase()}|${
      transaction.category
    }|${transaction.amount.toNumber().toFixed(0)}`;
    if (!acc[signature]) acc[signature] = [];
    acc[signature].push(transaction);
    return acc;
  }, {});

  const possibleSubscriptions = Object.values(groupedBySignature)
    .filter((group) => group.length >= 2)
    .map((group) => {
      const sorted = [...group].sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        name: sorted[0].description || sorted[0].category,
        amount: sorted[0].amount.toNumber(),
        category: sorted[0].category,
        occurrences: sorted.length,
      };
    })
    .slice(0, 5);

  const monthlyRange = getCurrentMonthRange();
  const monthTransactions = transactions.filter(
    (transaction) =>
      new Date(transaction.date) >= monthlyRange.start &&
      new Date(transaction.date) <= monthlyRange.end
  );
  const monthIncome = monthTransactions
    .filter((transaction) => transaction.type === "INCOME")
    .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);
  const monthExpense = monthTransactions
    .filter((transaction) => transaction.type === "EXPENSE")
    .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);

  const bucketTotals = monthTransactions
    .filter((transaction) => transaction.type === "EXPENSE")
    .reduce(
      (acc, transaction) => {
        const bucket = classifyBudgetRule(transaction.category);
        acc[bucket] += transaction.amount.toNumber();
        return acc;
      },
      { needs: 0, wants: 0, savings: 0 }
    );

  const spentBasis = monthIncome || monthExpense || 1;
  const rule503020 = {
    needsPct: (bucketTotals.needs / spentBasis) * 100,
    wantsPct: (bucketTotals.wants / spentBasis) * 100,
    savingsPct: Math.max(((monthIncome - monthExpense) / spentBasis) * 100, 0),
  };

  const elapsedDays = Math.max(now.getDate(), 1);
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const predictedMonthExpense = (monthExpense / elapsedDays) * totalDays;
  const dailySafeSpend = Math.max((monthIncome - monthExpense) / Math.max(totalDays - elapsedDays, 1), 0);
  const savingsEfficiencyScore = Math.max(
    0,
    Math.min(100, ((monthIncome - monthExpense) / Math.max(monthIncome, 1)) * 100)
  );
  const spendVelocity = monthExpense / elapsedDays;
  const start30Days = new Date(now);
  start30Days.setDate(now.getDate() - 29);

  const dailyExpenseMap = {};
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(start30Days);
    d.setDate(start30Days.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyExpenseMap[key] = 0;
  }
  expenses.forEach((transaction) => {
    const key = new Date(transaction.date).toISOString().slice(0, 10);
    if (key in dailyExpenseMap) {
      dailyExpenseMap[key] += transaction.amount.toNumber();
    }
  });
  const dailyExpenseSeries = Object.entries(dailyExpenseMap).map(([date, amount]) => ({
    date,
    amount: Number(amount.toFixed(2)),
  }));

  const categorySpendData = Object.entries(summaryTransactionsByCategory(expenses))
    .map(([name, amount]) => ({
      name,
      value: Number(amount.toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const prompt = `
Give concise JSON output for this finance user.
Data:
- month income: Rs ${monthIncome.toFixed(2)}
- month expense: Rs ${monthExpense.toFixed(2)}
- predicted month-end expense: Rs ${predictedMonthExpense.toFixed(2)}
- 50/30/20 approx => needs ${rule503020.needsPct.toFixed(
    1
  )}%, wants ${rule503020.wantsPct.toFixed(1)}%, savings ${rule503020.savingsPct.toFixed(1)}%
- anomalies count: ${anomalies.length}
- possible subscriptions count: ${possibleSubscriptions.length}

Return JSON only:
{
  "projectDemoTitle": "short showcase title",
  "coachHighlights": ["point1", "point2", "point3"],
  "nextBestAction": "single action for this week",
  "incomeBoostIdeas": ["idea1", "idea2", "idea3"]
}
`;

  let aiLayer = {
    projectDemoTitle: "AI Financial Intelligence Layer",
    coachHighlights: [
      "Anomalous expenses are flagged from your spending distribution.",
      "Possible recurring subscriptions are detected from repeated charges.",
      "Your month-end expense forecast is estimated from current trend.",
    ],
    nextBestAction: "Cut one non-essential category by 10% this week.",
    incomeBoostIdeas: [
      "Offer a weekend freelancing service based on your strongest skill.",
      "Sell underused items and transfer proceeds to your savings account.",
      "Start a small digital side gig and target one extra income stream monthly.",
    ],
  };

  try {
    const { text } = await invokeAiModel({
      systemPrompt:
        "You are MoneyMind AI. Return strict JSON only, concise and actionable.",
      prompt,
    });
    aiLayer = JSON.parse(text);
  } catch (error) {
    // Keep deterministic fallback payload for reliability.
  }

  return {
    success: true,
    anomalies,
    possibleSubscriptions,
    rule503020,
    monthIncome,
    monthExpense,
    predictedMonthExpense,
    dailySafeSpend,
    savingsEfficiencyScore,
    spendVelocity,
    dailyExpenseSeries,
    categorySpendData,
    aiLayer,
  };
}

function summaryTransactionsByCategory(expenses = []) {
  return expenses.reduce((acc, transaction) => {
    const key = transaction.category || "Other";
    acc[key] = (acc[key] || 0) + transaction.amount.toNumber();
    return acc;
  }, {});
}

export async function getHighImpactFeatureInsights({
  goalName = "Emergency Fund",
  goalAmount = 150000,
  monthlySave = 10000,
  creditUtilization = 35,
  latePayments = 0,
  emiRatio = 25,
  investmentValue = 0,
  riskStyle = "balanced",
  taxRegime = "new",
}) {
  const user = await getUserAndAccounts();
  const context = await getAiCoachContext();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const allTxStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);

  const transactions = await db.transaction.findMany({
    where: {
      userId: user.id,
      date: { gte: allTxStart, lte: now },
    },
    orderBy: { date: "asc" },
    take: 2000,
  });

  const monthKey = (d) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const monthRows = {};
  transactions.forEach((tx) => {
    const key = monthKey(tx.date);
    if (!monthRows[key]) monthRows[key] = { income: 0, expense: 0 };
    const amount = tx.amount.toNumber();
    if (tx.type === "INCOME") monthRows[key].income += amount;
    else monthRows[key].expense += amount;
  });

  const selectedMonths = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    selectedMonths.push(monthKey(d));
  }

  const baseAssets = Number(context.accountBalance || 0) + Number(investmentValue || 0);
  const cashflows = selectedMonths.map((key) => {
    const row = monthRows[key] || { income: 0, expense: 0 };
    return row.income - row.expense;
  });
  const finalCumulative = cashflows.reduce((sum, val) => sum + val, 0);
  const offset = baseAssets - finalCumulative;
  let running = 0;
  const netWorthTrend = selectedMonths.map((key, idx) => {
    running += cashflows[idx];
    return {
      month: key,
      netWorth: Math.max(offset + running, 0),
    };
  });

  const liabilitiesKeywords = ["loan", "emi", "credit", "card"];
  const estimatedLiabilities = transactions
    .filter((tx) => tx.type === "EXPENSE")
    .filter((tx) => {
      const text = `${tx.category || ""} ${tx.description || ""}`.toLowerCase();
      return liabilitiesKeywords.some((keyword) => text.includes(keyword));
    })
    .slice(-8)
    .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);

  const recurringMap = transactions
    .filter((tx) => tx.type === "EXPENSE")
    .reduce((acc, tx) => {
      const key = `${(tx.description || tx.category || "bill").toLowerCase()}|${tx.amount
        .toNumber()
        .toFixed(0)}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    }, {});

  const recurringBills = Object.values(recurringMap)
    .filter((group) => group.length >= 2)
    .map((group) => {
      const sorted = [...group].sort((a, b) => new Date(a.date) - new Date(b.date));
      const lastDate = new Date(sorted[sorted.length - 1].date);
      const dueDate = new Date(lastDate);
      dueDate.setDate(dueDate.getDate() + 30);
      const amount = sorted[0].amount.toNumber();
      const ratio = context.monthlyIncome > 0 ? (amount / context.monthlyIncome) * 100 : 0;
      const riskLevel = ratio >= 15 ? "HIGH" : ratio >= 7 ? "MEDIUM" : "LOW";
      return {
        title: sorted[0].description || sorted[0].category || "Recurring bill",
        amount,
        dueDate: dueDate.toISOString().slice(0, 10),
        riskLevel,
      };
    })
    .slice(0, 6);

  const targetAmount = Math.max(Number(goalAmount) || 0, 0);
  const saveAmount = Math.max(Number(monthlySave) || 0, 100);
  const plans = [
    { type: "Conservative", factor: 0.8 },
    { type: "Balanced", factor: 1 },
    { type: "Aggressive", factor: 1.3 },
  ].map((plan) => {
    const contribution = Math.max(Math.round(saveAmount * plan.factor), 100);
    const months = targetAmount > 0 ? Math.ceil(targetAmount / contribution) : 0;
    return {
      type: plan.type,
      monthlyContribution: contribution,
      monthsToGoal: months,
      targetDate:
        months > 0
          ? new Date(now.getFullYear(), now.getMonth() + months, 1).toISOString().slice(0, 10)
          : "Achieved",
    };
  });

  const util = Math.max(0, Math.min(100, Number(creditUtilization) || 0));
  const late = Math.max(0, Number(latePayments) || 0);
  const emi = Math.max(0, Math.min(100, Number(emiRatio) || 0));
  const creditScore = Math.max(
    300,
    Math.min(900, Math.round(900 - util * 2.2 - late * 35 - emi * 1.4))
  );
  const creditBand =
    creditScore >= 780
      ? "EXCELLENT"
      : creditScore >= 700
        ? "GOOD"
        : creditScore >= 620
          ? "FAIR"
          : "RISKY";

  const { start: monthStart } = getCurrentMonthRange();
  const monthTx = transactions.filter((tx) => new Date(tx.date) >= monthStart);
  const monthIncome = monthTx
    .filter((tx) => tx.type === "INCOME")
    .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);
  const monthExpense = monthTx
    .filter((tx) => tx.type === "EXPENSE")
    .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);
  const elapsedDays = Math.max(now.getDate(), 1);
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const predictedMonthExpense = (monthExpense / elapsedDays) * totalDays;
  const overshootPct = monthIncome > 0 ? (predictedMonthExpense / monthIncome) * 100 : 0;
  const guardrailLevel =
    overshootPct > 100 ? "HIGH RISK" : overshootPct > 85 ? "CAUTION" : "SAFE";

  const allocationByRisk = {
    conservative: { equity: 35, debt: 45, gold: 10, cash: 10 },
    balanced: { equity: 55, debt: 25, gold: 10, cash: 10 },
    aggressive: { equity: 70, debt: 15, gold: 10, cash: 5 },
  };
  const targetAllocation =
    allocationByRisk[String(riskStyle || "balanced").toLowerCase()] || allocationByRisk.balanced;
  // Approximate current allocation from user profile when explicit holdings are unavailable.
  const currentAllocation = {
    equity: Math.max(20, Math.min(80, 50 + (context.disposableIncome > 0 ? 5 : -8))),
    debt: Math.max(10, Math.min(60, 28 + (emi > 35 ? 8 : 0))),
    gold: 10,
    cash: Math.max(5, Math.min(35, 12 + (late > 0 ? 6 : 0))),
  };
  const normalizeTotal =
    currentAllocation.equity +
    currentAllocation.debt +
    currentAllocation.gold +
    currentAllocation.cash;
  currentAllocation.equity = (currentAllocation.equity / normalizeTotal) * 100;
  currentAllocation.debt = (currentAllocation.debt / normalizeTotal) * 100;
  currentAllocation.gold = (currentAllocation.gold / normalizeTotal) * 100;
  currentAllocation.cash = (currentAllocation.cash / normalizeTotal) * 100;
  const rebalanceActions = Object.keys(targetAllocation)
    .map((bucket) => {
      const currentPct = Number(currentAllocation[bucket] || 0);
      const targetPct = Number(targetAllocation[bucket] || 0);
      const diff = Number((targetPct - currentPct).toFixed(1));
      return {
        bucket,
        currentPct: Number(currentPct.toFixed(1)),
        targetPct,
        action: diff > 1 ? `Increase by ${diff}%` : diff < -1 ? `Reduce by ${Math.abs(diff)}%` : "Maintain",
      };
    })
    .sort((a, b) => Math.abs(b.targetPct - b.currentPct) - Math.abs(a.targetPct - a.currentPct));

  const annualIncome = context.monthlyIncome * 12;
  const estimatedAnnualSavings = Math.max((context.monthlyIncome - context.monthlyExpense) * 12, 0);
  const estimated80C = Math.min(150000, Math.max(Number(monthlySave || 0) * 12, 0));
  const taxableIncomeOld = Math.max(annualIncome - 50000 - estimated80C, 0);
  const taxableIncomeNew = Math.max(annualIncome - 75000, 0);
  const slabTax = (income) => {
    if (income <= 300000) return 0;
    if (income <= 600000) return (income - 300000) * 0.05;
    if (income <= 900000) return 15000 + (income - 600000) * 0.1;
    if (income <= 1200000) return 45000 + (income - 900000) * 0.15;
    if (income <= 1500000) return 90000 + (income - 1200000) * 0.2;
    return 150000 + (income - 1500000) * 0.3;
  };
  const oldRegimeTax = slabTax(taxableIncomeOld);
  const newRegimeTax = slabTax(taxableIncomeNew);
  const selectedRegime = String(taxRegime || "new").toLowerCase() === "old" ? "old" : "new";
  const normalizedRiskStyle = String(riskStyle || "balanced").toLowerCase();

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    inputEcho: {
      goalName,
      goalAmount: targetAmount,
      monthlySave: saveAmount,
      creditUtilization: util,
      latePayments: late,
      emiRatio: emi,
      investmentValue: Number(investmentValue || 0),
      riskStyle: normalizedRiskStyle,
      taxRegime: selectedRegime,
    },
    netWorth: {
      assets: baseAssets,
      liabilities: estimatedLiabilities,
      net: Math.max(baseAssets - estimatedLiabilities, 0),
      trend: netWorthTrend,
    },
    billReminder: {
      recurringBills,
    },
    goalSimulator: {
      goalName,
      goalAmount: targetAmount,
      plans,
    },
    creditHealth: {
      score: creditScore,
      band: creditBand,
      inputs: {
        creditUtilization: util,
        latePayments: late,
        emiRatio: emi,
      },
      actions: [
        util > 35
          ? "Keep credit utilization under 30% for better score."
          : "Utilization is healthy. Maintain current usage discipline.",
        late > 0
          ? "Set auto-pay for minimum dues to avoid late payment hits."
          : "No late payments recorded. Keep it consistent.",
        emi > 40
          ? "Reduce EMI burden to below 35% of income."
          : "EMI ratio is under control. Avoid adding large fixed obligations.",
      ],
    },
    spendGuardrail: {
      predictedMonthExpense,
      monthlyIncome: monthIncome,
      overshootPct: Number(overshootPct.toFixed(1)),
      level: guardrailLevel,
      message:
        guardrailLevel === "HIGH RISK"
          ? "Current pace can overshoot your income. Pause non-essential spending."
          : guardrailLevel === "CAUTION"
            ? "You are near your monthly limit. Spend carefully in discretionary categories."
            : "Spending pace is currently healthy for this month.",
    },
    portfolioRebalancer: {
      riskStyle: normalizedRiskStyle,
      investmentValue: Number(investmentValue || 0),
      actions: rebalanceActions,
    },
    taxPlanner: {
      annualIncome,
      estimatedAnnualSavings,
      selectedRegime,
      oldRegimeTax: Math.max(0, Math.round(oldRegimeTax)),
      newRegimeTax: Math.max(0, Math.round(newRegimeTax)),
      suggestedRegime:
        oldRegimeTax <= newRegimeTax ? "old" : "new",
      tips: [
        estimated80C < 150000
          ? "You can still use 80C deductions up to Rs 1,50,000 (old regime)."
          : "80C deduction capacity appears fully utilized.",
        "Track health insurance and NPS deductions if you choose old regime.",
        "Use monthly SIP automation to maintain tax-aware long-term investing discipline.",
      ],
    },
  };
}

export async function getCityCouponSuggestions({ city = "Mumbai" }) {
  const normalizedCity = String(city || "Mumbai").trim() || "Mumbai";
  const lowerCity = normalizedCity.toLowerCase();

  const foodCoupons = [
    {
      title: `${normalizedCity} Zomato offers`,
      hint: "Try bank/card and first-order offers.",
      link: `https://www.google.com/search?q=${encodeURIComponent(`zomato coupon code ${lowerCity}`)}`,
    },
    {
      title: `${normalizedCity} Swiggy offers`,
      hint: "Check restaurant-specific discount codes.",
      link: `https://www.google.com/search?q=${encodeURIComponent(`swiggy coupon code ${lowerCity}`)}`,
    },
  ];

  const movieCoupons = [
    {
      title: `${normalizedCity} BookMyShow deals`,
      hint: "Look for wallet, UPI, and card offers.",
      link: `https://www.google.com/search?q=${encodeURIComponent(`bookmyshow offers ${lowerCity}`)}`,
    },
    {
      title: `${normalizedCity} Paytm movie coupons`,
      hint: "Use cashback and promo combinations.",
      link: `https://www.google.com/search?q=${encodeURIComponent(`paytm movie coupon ${lowerCity}`)}`,
    },
    {
      title: `${normalizedCity} movie ticket discounts`,
      hint: "Compare offers across platforms before booking.",
      link: `https://www.google.com/search?q=${encodeURIComponent(`movie ticket discount offers ${lowerCity}`)}`,
    },
  ];

  return {
    success: true,
    city: normalizedCity,
    foodCoupons,
    movieCoupons,
    sources: [
      { label: "Google Search", link: "https://www.google.com/" },
    ],
  };
}

function buildBookingLinks({ type, query, from, to, date, location = "Mumbai" }) {
  const encodedQuery = encodeURIComponent(query || "");
  const encodedFrom = encodeURIComponent(from || "");
  const encodedTo = encodeURIComponent(to || "");
  const encodedDate = encodeURIComponent(date || "");
  const encodedLocation = encodeURIComponent(location || "Mumbai");

  if (type === "movie") {
    return [
      {
        platform: "BookMyShow",
        link: `https://in.bookmyshow.com/explore/movies-${encodedLocation}?search=${encodedQuery}`,
      },
      {
        platform: "Paytm Movies",
        link: `https://paytm.com/movies/search?query=${encodedQuery}+${encodedLocation}`,
      },
    ];
  }

  if (type === "concert") {
    return [
      {
        platform: "BookMyShow Events",
        link: `https://in.bookmyshow.com/explore/events?search=${encodedQuery}`,
      },
      {
        platform: "Paytm Events",
        link: `https://paytm.com/events/search?q=${encodedQuery}`,
      },
      {
        platform: "District",
        link: `https://www.district.in/search?q=${encodedQuery}`,
      },
    ];
  }

  if (type === "flight") {
    return [
      {
        platform: "Skyscanner",
        link: `https://www.skyscanner.co.in/transport/flights/${encodedFrom}/${encodedTo}/${encodedDate}/`,
      },
      {
        platform: "MakeMyTrip",
        link: `https://www.makemytrip.com/flight/search?tripType=O&itinerary=${encodedFrom}-${encodedTo}-${encodedDate}`,
      },
      {
        platform: "Google Flights",
        link: `https://www.google.com/travel/flights?hl=en#flt=${encodedFrom}.${encodedTo}.${encodedDate}`,
      },
    ];
  }

  return [
    {
      platform: "Google Search",
      link: `https://www.google.com/search?q=${encodedQuery}+booking`,
    },
    {
      platform: "Paytm",
      link: `https://paytm.com/search?q=${encodedQuery}`,
    },
  ];
}

async function getNearbyTheaters(location = "Mumbai") {
  const loc = String(location || "Mumbai").trim();
  if (!loc) return [];
  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(loc)}`,
      {
        cache: "no-store",
        headers: {
          "User-Agent": "MoneyMind/1.0 (theater-lookup)",
        },
      }
    );
    if (!geoRes.ok) return [];
    const geoData = await geoRes.json();
    const first = geoData?.[0];
    if (!first) return [];
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

    const overpassQuery = `[out:json][timeout:15];
      (
        node["amenity"="cinema"](around:20000,${lat},${lon});
        way["amenity"="cinema"](around:20000,${lat},${lon});
        relation["amenity"="cinema"](around:20000,${lat},${lon});
      );
      out center 20;`;

    const theatersRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });
    if (!theatersRes.ok) return [];
    const theatersData = await theatersRes.json();

    return (theatersData?.elements || [])
      .map((item) => ({
        name: item.tags?.name || "Cinema",
        lat: item.lat ?? item.center?.lat,
        lon: item.lon ?? item.center?.lon,
      }))
      .filter((item) => item.name && item.lat && item.lon)
      .slice(0, 10);
  } catch (error) {
    return [];
  }
}

function normalizeTitle(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function similarityScore(a = "", b = "") {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const minLen = Math.min(x.length, y.length);
  if (!minLen) return 0;
  let same = 0;
  for (let i = 0; i < minLen; i += 1) {
    if (x[i] === y[i]) same += 1;
  }
  return same / Math.max(x.length, y.length);
}

export async function getSmartBookingOptions({
  type = "movie",
  query = "",
  location = "Mumbai",
  from = "DEL",
  to = "BOM",
  date = "",
  budget = 0,
  seatType = "silver",
  passengers = 1,
}) {
  const context = await getAiCoachContext();
  const safeBudget = Number(budget) || 0;
  const normalizedType = String(type).toLowerCase();
  const passengerCount = Math.max(1, Number(passengers) || 1);
  const normalizedSeat = String(seatType).toLowerCase();

  let estimatedPrice = 0;
  if (normalizedType === "movie") {
    estimatedPrice = 250;
  } else if (normalizedType === "concert") {
    estimatedPrice = 1800;
  } else if (normalizedType === "flight") {
    estimatedPrice = 6500;
  } else if (normalizedType === "bus") {
    estimatedPrice = 1200;
  } else if (normalizedType === "train") {
    estimatedPrice = 800;
  } else {
    estimatedPrice = 2000;
  }

  const seatMultiplier =
    normalizedSeat === "gold" ? 1.35 : normalizedSeat === "platinum" ? 1.7 : 1;
  const perPersonPrice = Math.round(estimatedPrice * seatMultiplier);
  const totalPrice = perPersonPrice * passengerCount;

  const links = buildBookingLinks({
    type: normalizedType,
    query,
    location,
    from,
    to,
    date,
  });

  let noTheaterAvailable = false;
  let nearbyTheaters = [];
  if (normalizedType === "movie" || normalizedType === "concert") {
    const suggestions = await getBookingSuggestions({
      type: normalizedType,
      query,
    });
    const hasMatchingSuggestion = (suggestions.suggestions || []).some(
      (item) => similarityScore(item.title, query) >= 0.45
    );
    nearbyTheaters = await getNearbyTheaters(location);
    // Consider "available" if we have either a close movie match or any nearby theaters.
    noTheaterAvailable = !hasMatchingSuggestion && nearbyTheaters.length === 0;
  }

  const ticketOptions =
    normalizedType === "movie"
      ? [
          {
            platform: "BookMyShow",
              rate: Math.round(perPersonPrice * 1.05) * passengerCount,
            link: links.find((item) => item.platform === "BookMyShow")?.link || links[0]?.link,
          },
          {
            platform: "Paytm Movies",
              rate: Math.round(perPersonPrice * 0.95) * passengerCount,
            link: links.find((item) => item.platform === "Paytm Movies")?.link || links[0]?.link,
          },
          {
            platform: "District by Zomato",
              rate: Math.round(perPersonPrice * 1.1) * passengerCount,
            link: `https://www.google.com/search?q=${encodeURIComponent(query + " movie tickets district")}`,
          },
        ]
      : normalizedType === "concert"
        ? [
            {
              platform: "BookMyShow Events",
              rate: Math.round(perPersonPrice * 1.05) * passengerCount,
              link: links.find((item) => item.platform === "BookMyShow Events")?.link || links[0]?.link,
            },
            {
              platform: "Paytm Events",
              rate: Math.round(perPersonPrice * 0.95) * passengerCount,
              link: links.find((item) => item.platform === "Paytm Events")?.link || links[0]?.link,
            },
            {
              platform: "District",
              rate: Math.round(perPersonPrice * 1.1) * passengerCount,
              link: links.find((item) => item.platform === "District")?.link || links[0]?.link,
            },
          ]
      : links.map((item, index) => ({
          platform: item.platform,
          rate: Math.round(perPersonPrice * (1 + index * 0.06)) * passengerCount,
          link: item.link,
        }));

  const movieTheaterOptions =
    normalizedType === "movie" && nearbyTheaters.length > 0
      ? nearbyTheaters.map((theater, index) => ({
          theaterName: theater.name,
          rate: Math.round(perPersonPrice * (0.9 + (index % 4) * 0.08)) * passengerCount,
          link: `https://www.google.com/search?q=${encodeURIComponent(
            `${query} ${theater.name} ${location} ticket booking`
          )}`,
        }))
      : [];

  const isAffordableByBudget = safeBudget > 0 ? totalPrice <= safeBudget : true;
  const isAffordableByBalance = totalPrice <= Number(context.accountBalance || 0);

  return {
    success: true,
    type: normalizedType,
    estimatedPrice: totalPrice,
    perPersonPrice,
    passengers: passengerCount,
    seatType: normalizedSeat,
    isAffordableByBudget,
    isAffordableByBalance,
    ticketOptions: noTheaterAvailable ? [] : ticketOptions,
    movieTheaterOptions: noTheaterAvailable ? [] : movieTheaterOptions,
    links,
    contextBalance: context.accountBalance,
    noTheaterAvailable,
    location,
    nearbyTheaters,
    theaterAvailabilityStatus:
      normalizedType === "movie" || normalizedType === "concert"
        ? nearbyTheaters.length > 0
          ? "Theaters found near your location."
          : "No nearby theaters found for this location."
        : null,
  };
}

export async function getBookingSuggestions({ type = "movie", query = "" }) {
  const q = String(query || "").trim();
  if (!q) return { success: true, suggestions: [] };
  const t = String(type).toLowerCase();

  try {
    if (t === "movie") {
      const [itunesRes, imdbRes] = await Promise.all([
        fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=movie&limit=12`,
          { cache: "no-store" }
        ),
        fetch(
          `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(
            q[0]?.toLowerCase() || "a"
          )}/${encodeURIComponent(q)}.json`,
          { cache: "no-store" }
        ),
      ]);

      const merged = [];
      if (itunesRes.ok) {
        const data = await itunesRes.json();
        merged.push(
          ...(data.results || []).map((item) => ({
            title: item.trackName,
            subtitle: item.primaryGenreName || "Movie",
            year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : null,
          }))
        );
      }
      if (imdbRes.ok) {
        const data = await imdbRes.json();
        merged.push(
          ...((data.d || []).map((item) => ({
            title: item.l,
            subtitle: item.q || "Movie",
            year: item.y || null,
          })) || [])
        );
      }

      const dedup = Array.from(
        new Map(
          merged
            .filter((item) => item?.title)
            .map((item) => [normalizeTitle(item.title), item])
        ).values()
      );

      const ranked = dedup
        .map((item) => ({
          ...item,
          _score: similarityScore(item.title, q),
        }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 12)
        .map(({ _score, ...item }) => item);

      if (ranked.length > 0) {
        return { success: true, suggestions: ranked };
      }
    }

    if (t === "concert") {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=12`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const suggestions = (data.results || []).map((item) => ({
          title: item.artistName,
          subtitle: "Artist / Concert",
          year: null,
        }));
        return { success: true, suggestions };
      }
    }
  } catch (error) {
    // fall through to fallback list
  }

  return {
    success: true,
    suggestions: [
      { title: q, subtitle: t === "concert" ? "Concert" : "Movie", year: null },
    ],
  };
}

export async function getMarketAndInvestmentTips({
  riskProfile = "moderate",
  horizon = "3-5 years",
}) {
  const context = await getAiCoachContext();

  const prompt = `
You are a practical Indian market and investing assistant.
Provide educational guidance only (not guaranteed returns).
Use INR language.
Respond in English only.

User context:
- Monthly income: Rs ${context.monthlyIncome.toFixed(2)}
- Monthly expense: Rs ${context.monthlyExpense.toFixed(2)}
- Disposable income: Rs ${context.disposableIncome.toFixed(2)}
- Risk profile: ${riskProfile}
- Investment horizon: ${horizon}

Return JSON only:
{
  "stockMarketTips": ["tip1", "tip2", "tip3", "tip4"],
  "investingTips": ["tip1", "tip2", "tip3", "tip4"],
  "allocationHint": "single short allocation suggestion in INR context"
}
`;

  try {
    const { text } = await invokeAiModel({
      systemPrompt:
        "You are a practical Indian market and investing assistant. Provide educational guidance only, respond in English only, and return strict JSON.",
      prompt,
    });
    const parsed = JSON.parse(text);
    return { success: true, ...parsed };
  } catch (error) {
    return {
      success: true,
      stockMarketTips: [
        "Invest in diversified index ETFs instead of concentrated single bets.",
        "Use SIP style staggered entry to reduce timing risk.",
        "Track earnings quality, debt levels, and cash flow before stock picks.",
        "Always keep stop-loss and position sizing discipline.",
      ],
      investingTips: [
        "Keep 3-6 months emergency fund before aggressive investing.",
        "Follow a 50/30/20 style split and invest the savings bucket consistently.",
        "Review portfolio quarterly and rebalance if any sector exceeds your risk limit.",
        "Avoid investing money needed within 12 months.",
      ],
      allocationHint:
        "Start with core index funds and allocate a smaller satellite portion to selective stocks.",
    };
  }
}

export async function getMarketSnapshot() {
  const sources = [
    { label: "NSE India", link: "https://www.nseindia.com/" },
    { label: "BSE India", link: "https://www.bseindia.com/" },
    { label: "SEBI Investor Education", link: "https://investor.sebi.gov.in/" },
  ];
  const indexConfig = [
    { symbol: "^NSEI", name: "NIFTY 50" },
    { symbol: "^BSESN", name: "SENSEX" },
    { symbol: "^NSEBANK", name: "NIFTY BANK" },
  ];

  try {
    // Primary source: Yahoo quote endpoint for direct current values.
    const res = await fetch(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5ENSEI,%5EBSESN,%5ENSEBANK",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("live quote failed");
    const data = await res.json();
    const rows = data?.quoteResponse?.result || [];
    if (!rows.length) throw new Error("live quote empty");

    return {
      success: true,
      indices: rows.map((row) => ({
        name: indexConfig.find((item) => item.symbol === row.symbol)?.name || row.symbol,
        symbol: row.symbol,
        price: Number(row.regularMarketPrice || 0),
        changePct: Number(row.regularMarketChangePercent || 0),
      })),
      sources,
    };
  } catch (error) {
    // Fallback source: chart endpoints per index (still live internet data).
    try {
      const chartRows = await Promise.all(
        indexConfig.map(async ({ symbol, name }) => {
          const chartRes = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
              symbol
            )}?range=5d&interval=1d`,
            { cache: "no-store" }
          );
          if (!chartRes.ok) throw new Error(`chart fetch failed: ${symbol}`);
          const chartData = await chartRes.json();
          const result = chartData?.chart?.result?.[0];
          const meta = result?.meta || {};
          const closes = result?.indicators?.quote?.[0]?.close || [];
          const cleanCloses = closes.filter((val) => Number.isFinite(Number(val)));
          const latest = Number(meta.regularMarketPrice || cleanCloses[cleanCloses.length - 1] || 0);
          const previous = Number(
            meta.chartPreviousClose ||
              meta.previousClose ||
              (cleanCloses.length > 1 ? cleanCloses[cleanCloses.length - 2] : 0)
          );
          const changePct = previous > 0 ? ((latest - previous) / previous) * 100 : 0;
          if (!latest) throw new Error(`no price for ${symbol}`);
          return {
            name,
            symbol,
            price: latest,
            changePct,
          };
        })
      );

      if (chartRows.length > 0) {
        return {
          success: true,
          indices: chartRows,
          sources: [
            { label: "Yahoo Finance Chart API", link: "https://finance.yahoo.com/" },
            ...sources,
          ],
          message: "Loaded via fallback market feed.",
        };
      }
    } catch (fallbackError) {
      // Fall through to unavailable response.
    }

    return {
      success: false,
      indices: [],
      sources,
      message: "Live market snapshot is unavailable right now.",
    };
  }
}

export async function getInvestmentSearchInsights({ query = "NIFTY 50" }) {
  const q = String(query || "").trim();
  if (!q) return { success: true, points: [], summary: "Search an index or stock." };

  const aliases = {
    NIFTY: "^NSEI",
    "NIFTY 50": "^NSEI",
    SENSEX: "^BSESN",
    "BANK NIFTY": "^NSEBANK",
    "NIFTY BANK": "^NSEBANK",
  };

  async function parseChartPoints(symbol) {
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=1mo&interval=1d`,
      { cache: "no-store" }
    );
    if (!chartRes.ok) {
      throw new Error(`chart fetch failed for ${symbol}`);
    }
    const chartData = await chartRes.json();
    const result = chartData?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];

    const points = timestamps
      .map((ts, idx) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: Number(closes[idx] || 0),
      }))
      .filter((item) => item.close > 0)
      .slice(-22);

    if (!points.length) {
      throw new Error(`no points for ${symbol}`);
    }
    return points;
  }

  async function resolveSymbols(input) {
    const normalized = String(input || "").trim();
    if (!normalized) return [];
    const direct = normalized.toUpperCase();
    const mapped = aliases[direct];
    const candidates = [];

    if (mapped) candidates.push(mapped);
    candidates.push(direct);
    // Help users who type Indian equities without exchange suffix.
    if (!direct.startsWith("^") && !direct.includes(".")) {
      candidates.push(`${direct}.NS`);
      candidates.push(`${direct}.BO`);
    }

    try {
      const searchRes = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          normalized
        )}&quotesCount=12&newsCount=0`,
        { cache: "no-store" }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const quoteCandidates = (searchData?.quotes || [])
          .map((item) => item?.symbol)
          .filter(Boolean)
          .slice(0, 12);
        candidates.push(...quoteCandidates);
      }
    } catch (error) {
      // Keep direct candidates if symbol search API fails.
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  try {
    const candidateSymbols = await resolveSymbols(q);
    let symbol = candidateSymbols[0] || q.toUpperCase();
    let points = [];

    for (const candidate of candidateSymbols) {
      try {
        points = await parseChartPoints(candidate);
        symbol = candidate;
        break;
      } catch (error) {
        // Try the next candidate.
      }
    }

    if (!points.length) {
      throw new Error("no points");
    }

    const first = points[0].close;
    const last = points[points.length - 1].close;
    const changePct = ((last - first) / first) * 100;

    return {
      success: true,
      symbol,
      points,
      summary:
        changePct >= 0
          ? `${symbol} is up ${changePct.toFixed(2)}% over the selected period.`
          : `${symbol} is down ${Math.abs(changePct).toFixed(2)}% over the selected period.`,
      sources: [
        { label: "Yahoo Finance Chart API", link: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}` },
        { label: "NSE India", link: "https://www.nseindia.com/" },
        { label: "SEBI", link: "https://investor.sebi.gov.in/" },
      ],
    };
  } catch (error) {
    const fallbackSymbol = aliases[String(q).toUpperCase()] || String(q).toUpperCase();
    return {
      success: true,
      symbol: fallbackSymbol,
      points: [],
      summary: "Live investment chart data is unavailable right now. Try another symbol.",
      sources: [{ label: "NSE India", link: "https://www.nseindia.com/" }],
    };
  }
}
