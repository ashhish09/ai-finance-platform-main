"use client";

import { useEffect, useMemo, useState } from "react";
import {
  askFinancialCoach,
  getBookingSuggestions,
  getCityCouponSuggestions,
  getHighImpactFeatureInsights,
  getInvestmentSearchInsights,
  getMarketSnapshot,
  getMarketAndInvestmentTips,
  getAdvancedAiInsights,
  getSmartBookingOptions,
  searchProductsByBudget,
} from "@/actions/ai-coach";
import useFetch from "@/hooks/use-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Coins,
  Crown,
  Loader2,
  Radar,
  Ticket,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GOAL_OPTIONS = [
  "New Phone",
  "Laptop",
  "Car",
  "Bike",
  "Vacation",
  "Emergency Fund",
  "SIP Investment",
  "Headphones",
  "Watch",
];

const GOAL_MODEL_SUGGESTIONS = {
  "New Phone": ["iPhone 15", "Samsung S24", "OnePlus 12", "Nothing Phone 2"],
  Laptop: ["MacBook Air M2", "Dell XPS 13", "ASUS Vivobook", "HP Pavilion"],
  Car: ["Hyundai Creta", "Kia Seltos", "Maruti Brezza", "Tata Nexon"],
  Bike: ["Royal Enfield Classic 350", "Yamaha R15", "KTM Duke 250", "Pulsar N250"],
  Headphones: ["Sony WH-1000XM5", "AirPods Pro", "JBL Tune 770", "Boat Nirvana"],
  Watch: ["Apple Watch SE", "Samsung Galaxy Watch", "Titan Edge", "Fossil Gen 6"],
  Vacation: ["Goa Trip Package", "Manali Tour", "Bali Budget Trip", "Dubai Starter Trip"],
  "Emergency Fund": ["6 Month Emergency Buffer", "12 Month Safety Fund"],
  "SIP Investment": ["Index Fund SIP", "Flexi Cap SIP", "ELSS SIP", "Hybrid SIP"],
};

const formatInr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export function AICoachClient({ initialContext }) {
  const chartColors = ["#4B2E2B", "#8C5A3C", "#C08552", "#D8A77A", "#E9CBAA", "#9C6D4A"];
  const [favorites, setFavorites] = useState([]);
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [selectedGoalForModel, setSelectedGoalForModel] = useState("New Phone");
  const [favoriteSearchQuery, setFavoriteSearchQuery] = useState("one plus");
  const [favoriteSearchResults, setFavoriteSearchResults] = useState([]);
  const [favoriteSearchMeta, setFavoriteSearchMeta] = useState(null);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteTargetPrice, setFavoriteTargetPrice] = useState("");
  const [message, setMessage] = useState("How should I plan this month better?");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatResult, setChatResult] = useState(null);
  const [query, setQuery] = useState("phone");
  const [products, setProducts] = useState([]);
  const [selectedBudget, setSelectedBudget] = useState(5000);
  const [productMeta, setProductMeta] = useState({
    hasAffordableResults: true,
    source: "",
    budgetUsed: 0,
  });
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [advancedInsights, setAdvancedInsights] = useState(null);
  const [highImpactInsights, setHighImpactInsights] = useState(null);
  const [cityCoupons, setCityCoupons] = useState(null);
  const [bookingType, setBookingType] = useState("movie");
  const [bookingQuery, setBookingQuery] = useState("Avengers");
  const [bookingLocation, setBookingLocation] = useState("Mumbai");
  const [locationDetected, setLocationDetected] = useState(false);
  const [bookingFrom, setBookingFrom] = useState("DEL");
  const [bookingTo, setBookingTo] = useState("BOM");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingBudget, setBookingBudget] = useState(2000);
  const [seatType, setSeatType] = useState("silver");
  const [passengers, setPassengers] = useState(1);
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingSuggestions, setBookingSuggestions] = useState([]);
  const [riskProfile, setRiskProfile] = useState("moderate");
  const [horizon, setHorizon] = useState("3-5 years");
  const [marketTips, setMarketTips] = useState(null);
  const [marketSnapshot, setMarketSnapshot] = useState(null);
  const [investmentQuery, setInvestmentQuery] = useState("NIFTY 50");
  const [investmentInsights, setInvestmentInsights] = useState(null);
  const [goalName, setGoalName] = useState("Emergency Fund");
  const [goalAmount, setGoalAmount] = useState(150000);
  const [monthlySave, setMonthlySave] = useState(10000);
  const [creditUtilization, setCreditUtilization] = useState(35);
  const [latePayments, setLatePayments] = useState(0);
  const [emiRatio, setEmiRatio] = useState(25);
  const [investmentValue, setInvestmentValue] = useState(50000);
  const [riskStyle, setRiskStyle] = useState("balanced");
  const [taxRegime, setTaxRegime] = useState("new");

  const { data: coachData, loading: coachLoading, fn: coachFn } = useFetch(askFinancialCoach);
  const { data: productData, loading: productLoading, fn: productFn } = useFetch(searchProductsByBudget);
  const {
    data: favoriteSearchData,
    loading: favoriteSearchLoading,
    fn: favoriteSearchFn,
  } = useFetch(searchProductsByBudget);
  const {
    data: advancedData,
    loading: advancedLoading,
    fn: advancedFn,
  } = useFetch(getAdvancedAiInsights);
  const { data: bookingData, loading: bookingLoading, fn: bookingFn } =
    useFetch(getSmartBookingOptions);
  const { data: marketTipsData, loading: marketTipsLoading, fn: marketTipsFn } =
    useFetch(getMarketAndInvestmentTips);
  const { data: marketSnapshotData, loading: marketSnapshotLoading, fn: marketSnapshotFn } =
    useFetch(getMarketSnapshot);
  const { data: bookingSuggestionsData, loading: bookingSuggestionsLoading, fn: bookingSuggestionsFn } =
    useFetch(getBookingSuggestions);
  const { data: investmentInsightsData, loading: investmentInsightsLoading, fn: investmentInsightsFn } =
    useFetch(getInvestmentSearchInsights);
  const { data: cityCouponsData, loading: cityCouponsLoading, fn: cityCouponsFn } =
    useFetch(getCityCouponSuggestions);
  const { data: highImpactData, loading: highImpactLoading, fn: highImpactFn } =
    useFetch(getHighImpactFeatureInsights);

  useEffect(() => {
    const stored = localStorage.getItem("ai-coach-favorites");
    if (stored) {
      setFavorites(JSON.parse(stored));
    }
    const storedProducts = localStorage.getItem("ai-coach-favorite-products");
    if (storedProducts) {
      setFavoriteProducts(JSON.parse(storedProducts));
    }
    const storedHistory = localStorage.getItem("ai-coach-chat-history");
    if (storedHistory) {
      setChatHistory(JSON.parse(storedHistory));
    }
  }, []);

  useEffect(() => {
    const autoBudget = Math.floor(
      Math.min(initialContext.accountBalance || 0, 10000) || 5000
    );
    setSelectedBudget(autoBudget);
  }, [initialContext.accountBalance]);

  useEffect(() => {
    localStorage.setItem("ai-coach-favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem("ai-coach-favorite-products", JSON.stringify(favoriteProducts));
  }, [favoriteProducts]);
  useEffect(() => {
    localStorage.setItem("ai-coach-chat-history", JSON.stringify(chatHistory.slice(-12)));
  }, [chatHistory]);

  const incomeStrength = useMemo(() => {
    if (initialContext.monthlyIncome <= 0) return "LOW";
    const ratio = initialContext.monthlyExpense / initialContext.monthlyIncome;
    if (ratio <= 0.5) return "HIGH";
    if (ratio <= 0.8) return "MEDIUM";
    return "LOW";
  }, [initialContext.monthlyExpense, initialContext.monthlyIncome]);

  const topFavoriteSuggestion =
    incomeStrength === "HIGH" && favorites.length > 0
      ? `Income looks healthy. Prioritize: ${favorites[0]}`
      : "Focus on essentials first, then pick one favorite goal.";
  const modelSuggestions = GOAL_MODEL_SUGGESTIONS[selectedGoalForModel] || [];
  const affordableFavoriteProducts = favoriteProducts
    .filter(
      (item) =>
        Number(item.targetPrice || 0) > 0 &&
        Number(item.targetPrice) <= Number(initialContext.accountBalance || 0)
    )
    .sort((a, b) => Number(a.targetPrice) - Number(b.targetPrice));
  const topAffordableFavorite = affordableFavoriteProducts[0] || null;

  useEffect(() => {
    if (coachData?.reply) {
      setChatResult(coachData);
      setChatHistory((prev) => [...prev, { role: "assistant", content: coachData.reply }].slice(-12));
    }
  }, [coachData]);

  useEffect(() => {
    if (productData?.products) {
      setProducts(productData.products);
      setProductMeta({
        hasAffordableResults: productData.hasAffordableResults,
        source: productData.source,
        budgetUsed: productData.budgetUsed,
      });
    }
  }, [productData]);
  useEffect(() => {
    if (favoriteSearchData?.products) {
      setFavoriteSearchResults(favoriteSearchData.products);
      setFavoriteSearchMeta({
        source: favoriteSearchData.source,
        cheapest: favoriteSearchData.cheapestProduct,
      });
    }
  }, [favoriteSearchData]);

  useEffect(() => {
    advancedFn();
    // Run once on mount for initial advanced AI insights.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (advancedData?.success) {
      setAdvancedInsights(advancedData);
    }
  }, [advancedData]);
  useEffect(() => {
    if (bookingData?.success) {
      setBookingResult(bookingData);
    }
  }, [bookingData]);
  useEffect(() => {
    if (marketTipsData?.success) {
      setMarketTips(marketTipsData);
    }
  }, [marketTipsData]);
  useEffect(() => {
    if (marketSnapshotData) {
      setMarketSnapshot(marketSnapshotData);
    }
  }, [marketSnapshotData]);
  useEffect(() => {
    if (bookingSuggestionsData?.success) {
      setBookingSuggestions(bookingSuggestionsData.suggestions || []);
    }
  }, [bookingSuggestionsData]);
  useEffect(() => {
    if (investmentInsightsData?.success) {
      setInvestmentInsights(investmentInsightsData);
    }
  }, [investmentInsightsData]);
  useEffect(() => {
    if (cityCouponsData?.success) {
      setCityCoupons(cityCouponsData);
    }
  }, [cityCouponsData]);
  useEffect(() => {
    if (highImpactData?.success) {
      setHighImpactInsights(highImpactData);
    }
  }, [highImpactData]);

  const onAskCoach = async () => {
    if (!message?.trim()) return;
    const nextHistory = [...chatHistory, { role: "user", content: message.trim() }];
    setChatHistory(nextHistory);
    await coachFn({
      message,
      favorites,
      favoriteProducts,
      chatHistory: nextHistory,
    });
    setMessage("");
  };

  const onSearchProducts = async () => {
    const budget = Number(selectedBudget) || 0;
    await productFn({ query, budget });
  };

  const toggleFavorite = (goal) => {
    setFavorites((prev) =>
      prev.includes(goal) ? prev.filter((item) => item !== goal) : [...prev, goal]
    );
  };
  const addFavoriteProduct = () => {
    const name = favoriteName.trim();
    const targetPrice = Number(favoriteTargetPrice);
    if (!name || !targetPrice || targetPrice <= 0) return;
    setFavoriteProducts((prev) => {
      const updated = [
        ...prev.filter((item) => item.name.toLowerCase() !== name.toLowerCase()),
        { name, targetPrice },
      ];
      return updated.sort((a, b) => a.targetPrice - b.targetPrice);
    });
    setFavoriteName("");
    setFavoriteTargetPrice("");
  };
  const applySuggestedModel = (model) => {
    setFavoriteName(model);
  };
  const removeFavoriteProduct = (name) => {
    setFavoriteProducts((prev) => prev.filter((item) => item.name !== name));
  };
  const selectProductForTarget = (product) => {
    setSelectedProductDetail(product);
    setFavoriteName(product.title || "");
    setFavoriteTargetPrice(Math.round(Number(product.priceInr || 0)));
  };
  const onSearchFavoriteProducts = async () => {
    if (!favoriteSearchQuery?.trim()) return;
    await favoriteSearchFn({
      query: favoriteSearchQuery,
      budget: 1000000000,
    });
  };
  const addFavoriteFromSearch = (product) => {
    setFavoriteName(product.title || "");
    setFavoriteTargetPrice(Math.round(Number(product.priceInr || 0)));
    setFavoriteProducts((prev) => {
      const updated = [
        ...prev.filter(
          (item) => item.name.toLowerCase() !== String(product.title || "").toLowerCase()
        ),
        { name: product.title, targetPrice: Math.round(Number(product.priceInr || 0)) },
      ];
      return updated.sort((a, b) => a.targetPrice - b.targetPrice);
    });
  };
  const onGetBookingOptions = async () => {
    await bookingFn({
      type: bookingType,
      query: bookingQuery,
      location: bookingLocation,
      from: bookingFrom,
      to: bookingTo,
      date: bookingDate,
      budget: Number(bookingBudget) || 0,
      seatType,
      passengers: Number(passengers) || 1,
    });
  };
  const onGetMarketTips = async () => {
    await marketTipsFn({
      riskProfile,
      horizon,
    });
  };
  const onSearchBookingSuggestions = async () => {
    if (!bookingQuery?.trim()) return;
    await bookingSuggestionsFn({
      type: bookingType,
      query: bookingQuery,
    });
  };
  const onSearchInvestment = async () => {
    await investmentInsightsFn({ query: investmentQuery });
  };
  const onGetCityCoupons = async () => {
    await cityCouponsFn({ city: bookingLocation || "Mumbai" });
  };
  const onGetHighImpactInsights = async () => {
    setHighImpactInsights(null);
    await highImpactFn({
      goalName,
      goalAmount: Number(goalAmount) || 0,
      monthlySave: Number(monthlySave) || 0,
      creditUtilization: Number(creditUtilization) || 0,
      latePayments: Number(latePayments) || 0,
      emiRatio: Number(emiRatio) || 0,
      investmentValue: Number(investmentValue) || 0,
      riskStyle,
      taxRegime,
    });
  };
  useEffect(() => {
    marketSnapshotFn();
    // Load once for market proof block.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let mounted = true;
    const detectCity = async () => {
      const applyCity = (city) => {
        const normalizedCity = String(city || "").trim();
        if (mounted && normalizedCity) {
          setBookingLocation(normalizedCity);
          setLocationDetected(true);
        }
      };

      const detectFromBrowserGeolocation = async () => {
        if (typeof window === "undefined" || !navigator?.geolocation) return false;
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 120000,
            });
          });
          const lat = position?.coords?.latitude;
          const lon = position?.coords?.longitude;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

          const reverseRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
              lat
            )}&lon=${encodeURIComponent(lon)}`,
            {
              headers: {
                "User-Agent": "MoneyMind/1.0 (city-detect)",
              },
            }
          );
          if (!reverseRes.ok) return false;
          const reverseData = await reverseRes.json();
          const city =
            reverseData?.address?.city ||
            reverseData?.address?.town ||
            reverseData?.address?.county ||
            reverseData?.address?.state_district ||
            "";
          if (!city) return false;
          applyCity(city);
          return true;
        } catch (error) {
          return false;
        }
      };

      try {
        const geoDetected = await detectFromBrowserGeolocation();
        if (geoDetected) return;

        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return;
        const data = await res.json();
        const city = String(data?.city || "").trim();
        if (city) {
          applyCity(city);
        }
      } catch (error) {
        // Keep manual location input fallback.
      }
    };
    detectCity();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!(bookingType === "movie" || bookingType === "concert")) return;
    const q = bookingQuery.trim();
    if (q.length < 2) {
      setBookingSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      bookingSuggestionsFn({
        type: bookingType,
        query: q,
      });
    }, 500);
    return () => clearTimeout(timer);
    // Keep dependencies minimal to avoid re-render loops from unstable function refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingQuery, bookingType]);
  useEffect(() => {
    onGetHighImpactInsights();
    // Run once for initial high-impact section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      onGetHighImpactInsights();
    }, 500);
    return () => clearTimeout(timer);
    // Auto refresh this block when controls change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    goalName,
    goalAmount,
    monthlySave,
    investmentValue,
    creditUtilization,
    latePayments,
    emiRatio,
    riskStyle,
    taxRegime,
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-3 border-none bg-gradient-to-r from-[#4B2E2B] via-[#8C5A3C] to-[#C08552] text-white shadow-xl">
        <CardContent className="py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                <Sparkles className="h-4 w-4" /> AI Powered Personal Finance
              </p>
              <h2 className="text-3xl font-bold">Your Intelligent Finance Control Room</h2>
              <p className="text-sm text-blue-100">
                Chat, forecast, detect anomalies, find products under budget, and plan smarter in one place.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/15 p-3">
                <p className="text-blue-100">Balance</p>
                <p className="font-semibold">{formatInr(initialContext.accountBalance)}</p>
              </div>
              <div className="rounded-lg bg-white/15 p-3">
                <p className="text-blue-100">Disposable</p>
                <p className="font-semibold">{formatInr(initialContext.disposableIncome)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1 bg-gradient-to-br from-slate-50 to-blue-50/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" /> Your AI Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>Balance: {formatInr(initialContext.accountBalance)}</div>
          <div>Monthly Income: {formatInr(initialContext.monthlyIncome)}</div>
          <div>Monthly Expense: {formatInr(initialContext.monthlyExpense)}</div>
          <div>Disposable: {formatInr(initialContext.disposableIncome)}</div>
          <div className="pt-2">
            <Badge variant="secondary">Income Strength: {incomeStrength}</Badge>
          </div>
          <p className="text-muted-foreground text-xs">{topFavoriteSuggestion}</p>
          {topAffordableFavorite && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2">
              <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                <Crown className="h-3.5 w-3.5" /> Auto Top Product
              </p>
              <p className="text-xs">
                {topAffordableFavorite.name} is affordable now at{" "}
                {formatInr(topAffordableFavorite.targetPrice)}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-purple-600" /> Choose Favorite Things
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {GOAL_OPTIONS.map((goal) => (
              <label key={goal} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={favorites.includes(goal)}
                  onCheckedChange={() => toggleFavorite(goal)}
                  suppressHydrationWarning
                />
                <span>{goal}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-emerald-600" /> Specific Favorite Product Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-slate-50 p-3 space-y-3">
            <p className="text-sm font-medium">Search products directly for favorite tracker</p>
            <div className="flex gap-2">
              <Input
                value={favoriteSearchQuery}
                onChange={(e) => setFavoriteSearchQuery(e.target.value)}
                placeholder="Search brand/model, e.g. one plus"
                suppressHydrationWarning
              />
              <Button onClick={onSearchFavoriteProducts} disabled={favoriteSearchLoading} suppressHydrationWarning>
                {favoriteSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
            {favoriteSearchMeta?.source && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Source: {favoriteSearchMeta.source}</Badge>
                {favoriteSearchMeta.cheapest && (
                  <Badge variant="secondary">
                    Cheapest: {formatInr(favoriteSearchMeta.cheapest.priceInr)}
                  </Badge>
                )}
              </div>
            )}
            {favoriteSearchResults.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2 max-h-56 overflow-auto">
                {favoriteSearchResults.map((product) => {
                  const affordable = Number(product.priceInr || 0) <= Number(initialContext.accountBalance || 0);
                  return (
                    <div key={`fav-search-${product.id}`} className="rounded-md border p-2 bg-white">
                      <p className="text-sm font-medium truncate">{product.title}</p>
                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-emerald-700 text-sm font-semibold">
                          {formatInr(product.priceInr)}
                        </p>
                        <Badge variant={affordable ? "default" : "outline"}>
                          {affordable ? "Affordable" : "Not Affordable"}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => addFavoriteFromSearch(product)}
                        suppressHydrationWarning
                      >
                        Add with Product Rate
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <p className="text-xs font-medium mb-2">Choose favorite type to get model suggestions</p>
              <div className="flex flex-wrap gap-2">
                {favorites.length > 0 ? (
                  favorites.map((fav) => (
                    <Button
                      key={fav}
                      type="button"
                      variant={selectedGoalForModel === fav ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedGoalForModel(fav)}
                      suppressHydrationWarning
                    >
                      {fav}
                    </Button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Select from Choose Favorite Things first.
                  </p>
                )}
              </div>
            </div>
            <div className="md:col-span-3">
              <p className="text-xs font-medium mb-2">Suggested specific models</p>
              <div className="flex flex-wrap gap-2">
                {modelSuggestions.map((model) => (
                  <Button
                    key={model}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestedModel(model)}
                    suppressHydrationWarning
                  >
                    {model}
                  </Button>
                ))}
              </div>
            </div>
            <Input
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              placeholder="Product name, e.g. iPhone 15"
              suppressHydrationWarning
            />
            <Input
              type="number"
              min="100"
              step="100"
              value={favoriteTargetPrice}
              onChange={(e) => setFavoriteTargetPrice(e.target.value)}
              placeholder="Target price (INR)"
              suppressHydrationWarning
            />
            <Button onClick={addFavoriteProduct} suppressHydrationWarning>Add Favorite Product</Button>
          </div>
          {favoriteProducts.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {favoriteProducts.map((item) => {
                const isAffordable = Number(item.targetPrice) <= Number(initialContext.accountBalance);
                return (
                  <div
                    key={item.name}
                    className={`rounded-md border p-2 flex items-center justify-between ${
                      isAffordable ? "bg-emerald-50 border-emerald-300" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Target: {formatInr(item.targetPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAffordable && <Badge>Affordable Now</Badge>}
                      <Button variant="outline" size="sm" onClick={() => removeFavoriteProduct(item.name)} suppressHydrationWarning>
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-600" /> AI Chatbot (Balance-Aware)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask anything... finance, planning, study, career, goals"
            suppressHydrationWarning
          />
          <Button onClick={onAskCoach} disabled={coachLoading} suppressHydrationWarning>
            {coachLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask Coach"}
          </Button>
          {coachLoading && (
            <div className="typing-indicator rounded-lg border p-3 text-sm">
              <span />
              <span />
              <span />
              <p className="text-xs text-muted-foreground mt-2">MoneyMind is thinking...</p>
            </div>
          )}
          {chatResult?.reply && (
            <div className="rounded-lg border p-3 text-sm space-y-2 chat-fade-in">
              <p className="whitespace-pre-line">{chatResult.reply}</p>
              <p className="font-medium">Top suggestion: {chatResult.prioritySuggestion}</p>
              <Badge variant="outline">Risk: {chatResult.riskLevel}</Badge>
              {chatResult?.aiMeta && (
                <div className="rounded-md border bg-slate-50 p-2 space-y-2">
                  <p className="text-xs font-medium">AI Model Status</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Provider: {String(chatResult.aiMeta.provider || "none").toUpperCase()}
                    </Badge>
                    <Badge variant="secondary">Model: {chatResult.aiMeta.model || "offline-fallback"}</Badge>
                    <Badge variant={chatResult.aiMeta.usingRealModel ? "default" : "destructive"}>
                      {chatResult.aiMeta.usingRealModel ? "Real Model Active" : "Fallback Active"}
                    </Badge>
                    {chatResult.aiMeta.fallbackUsed && <Badge variant="outline">Fallback Used</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {chatResult.aiMeta.note || "No model note available."}
                  </p>
                </div>
              )}
            </div>
          )}
          {chatHistory.length > 0 && (
            <div className="rounded-lg border p-3 max-h-48 overflow-auto space-y-2">
              {chatHistory.slice(-6).map((item, index) => (
                <p key={`${item.role}-${index}`} className="text-xs">
                  <span className="font-medium">{item.role === "user" ? "You" : "MoneyMind"}:</span>{" "}
                  {item.content}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-600" /> Product Search from Internet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product, e.g. shoes"
            suppressHydrationWarning
          />
          <div className="space-y-2">
            <p className="text-xs font-medium">Choose your budget limit</p>
            <Input
              type="number"
              min="100"
              step="100"
              value={selectedBudget}
              onChange={(e) => setSelectedBudget(e.target.value)}
              placeholder="Enter budget in INR"
              suppressHydrationWarning
            />
            <div className="flex flex-wrap gap-2">
              {[1000, 3000, 5000, 10000, 20000].map((value) => (
                <Button
                  key={value}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBudget(value)}
                  suppressHydrationWarning
                >
                  {formatInr(value)}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={onSearchProducts} disabled={productLoading} suppressHydrationWarning>
            {productLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching
              </>
            ) : (
              "Search Under Budget"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Shows products under your balance/disposable budget.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Budget used: {formatInr(productMeta.budgetUsed)}</Badge>
            {productMeta.source && <Badge variant="outline">Source: {productMeta.source} (real)</Badge>}
            {productData?.cheapestProduct && (
              <Badge variant="secondary">
                Cheapest: {formatInr(productData.cheapestProduct.priceInr)}
              </Badge>
            )}
          </div>
          {!productMeta.hasAffordableResults && products.length > 0 && (
            <p className="text-xs text-amber-700">
              No exact under-budget matches found. Showing the cheapest available options.
            </p>
          )}
          {productData?.success === false && (
            <p className="text-xs text-red-600">
              {productData.message || "Live product search unavailable right now."}
            </p>
          )}
          <div className="space-y-2 max-h-80 overflow-auto">
            {productData?.cheapestProduct && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm">
                <p className="font-medium text-emerald-800">Cheapest Match</p>
                <p>{productData.cheapestProduct.title}</p>
                <p className="text-emerald-700">{formatInr(productData.cheapestProduct.priceInr)}</p>
              </div>
            )}
            {products.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => selectProductForTarget(product)}
                className="block rounded-md border p-2 text-sm bg-white/80 hover:bg-white"
              >
                <div className="flex items-center gap-2">
                  <Image
                    src={product.image || "/logo-sm.png"}
                    alt={product.title}
                    width={46}
                    height={46}
                    className="h-11 w-11 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{product.title}</p>
                    <p className="text-xs text-muted-foreground">{product.brand}</p>
                    <p className="text-emerald-700 font-semibold">{formatInr(product.priceInr)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {selectedProductDetail && (
            <div className="rounded-md border p-3 bg-white">
              <p className="font-semibold">{selectedProductDetail.title}</p>
              <p className="text-xs text-muted-foreground">{selectedProductDetail.brand}</p>
              <p className="text-emerald-700 font-semibold mt-1">
                {formatInr(selectedProductDetail.priceInr)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Target price is auto-filled from selected product.
              </p>
              <a
                href={selectedProductDetail.link}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-xs text-blue-600 underline"
              >
                Open original product page
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 bg-gradient-to-br from-[#FFF8F0] to-[#f5e6d7] border-[#C08552]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#4B2E2B]">
            <Ticket className="h-5 w-5 text-[#8C5A3C]" /> Smart Booking Hub (Movie, Flight, Other)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={bookingType} onValueChange={setBookingType}>
              <SelectTrigger>
                <SelectValue placeholder="Choose ticket type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="concert">Concert</SelectItem>
                <SelectItem value="flight">Flight</SelectItem>
                <SelectItem value="bus">Bus</SelectItem>
                <SelectItem value="train">Train</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={bookingQuery}
              onChange={(e) => setBookingQuery(e.target.value)}
              placeholder={
                bookingType === "movie"
                  ? "Search movie name"
                  : bookingType === "concert"
                    ? "Search artist / concert name"
                    : "Search route/event query"
              }
              suppressHydrationWarning
            />
            <Input
              type="number"
              value={bookingBudget}
              onChange={(e) => setBookingBudget(e.target.value)}
              placeholder="Your booking budget (INR)"
              suppressHydrationWarning
            />
          </div>
          {(bookingType === "movie" || bookingType === "concert") && (
            <div className="grid gap-3 md:grid-cols-3">
              <Select value={seatType} onValueChange={setSeatType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose seat type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                placeholder="Passenger / Ticket count"
                suppressHydrationWarning
              />
              <Input
                value={bookingLocation}
                onChange={(e) => setBookingLocation(e.target.value)}
                placeholder="Your city/location (e.g., Mumbai)"
                suppressHydrationWarning
              />
            </div>
          )}
          {(bookingType === "flight" || bookingType === "bus" || bookingType === "train") && (
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={bookingFrom}
                onChange={(e) => setBookingFrom(e.target.value.toUpperCase())}
                placeholder="From city/airport code"
                suppressHydrationWarning
              />
              <Input
                value={bookingTo}
                onChange={(e) => setBookingTo(e.target.value.toUpperCase())}
                placeholder="To city/airport code"
                suppressHydrationWarning
              />
              <Input
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                placeholder="Date: YYYY-MM-DD"
                suppressHydrationWarning
              />
            </div>
          )}
          {(bookingType === "movie" || bookingType === "concert") && (
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={onSearchBookingSuggestions}
                disabled={bookingSuggestionsLoading}
                suppressHydrationWarning
              >
                {bookingSuggestionsLoading ? "Searching..." : "Suggest Names"}
              </Button>
              {bookingSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bookingSuggestions.map((item, index) => (
                    <Button
                      key={`${item.title}-${item.year || "na"}-${item.subtitle || "na"}-${index}`}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBookingQuery(item.title)}
                      suppressHydrationWarning
                    >
                      {item.title}
                      {item.year ? ` (${item.year})` : ""}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Suggestions are automatic while typing.
              </p>
              <p className="text-xs text-muted-foreground">
                {locationDetected
                  ? `Auto-detected location: ${bookingLocation}`
                  : "Location not auto-detected yet, you can type your city manually."}
              </p>
            </div>
          )}
          <Button
            onClick={onGetBookingOptions}
            disabled={bookingLoading}
            className="bg-[#4B2E2B] hover:bg-[#8C5A3C]"
            suppressHydrationWarning
          >
            {bookingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find Real Booking Links"}
          </Button>

          {bookingResult && (
            <div className="rounded-md border p-3 bg-white space-y-3">
              {bookingResult.noTheaterAvailable && (
                <p className="text-sm text-red-600">
                  No theater or event availability found for this search right now.
                </p>
              )}
              {bookingResult.theaterAvailabilityStatus && (
                <p className="text-sm text-[#8C5A3C]">
                  {bookingResult.theaterAvailabilityStatus} {bookingResult.location ? `(${bookingResult.location})` : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Estimated Price: {formatInr(bookingResult.estimatedPrice)}
                </Badge>
                <Badge variant="outline">
                  Per Person: {formatInr(bookingResult.perPersonPrice)}
                </Badge>
                <Badge variant="outline">
                  {bookingResult.passengers} passenger(s), {bookingResult.seatType}
                </Badge>
                <Badge variant={bookingResult.isAffordableByBudget ? "default" : "outline"}>
                  {bookingResult.isAffordableByBudget ? "Within Your Budget" : "Over Your Budget"}
                </Badge>
                <Badge variant={bookingResult.isAffordableByBalance ? "default" : "outline"}>
                  {bookingResult.isAffordableByBalance
                    ? "Affordable By Balance"
                    : "Not Affordable By Balance"}
                </Badge>
              </div>
              {(bookingResult.nearbyTheaters || []).length > 0 && (
                <div className="rounded-md border p-3 bg-[#FFF8F0]">
                  <p className="text-sm font-medium text-[#4B2E2B] mb-2">
                    Nearby Theaters ({bookingResult.location || bookingLocation})
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {bookingResult.nearbyTheaters.map((theater) => (
                      <a
                        key={`${theater.name}-${theater.lat}-${theater.lon}`}
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${theater.name}, ${bookingResult.location || bookingLocation}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline text-[#4B2E2B]"
                      >
                        {theater.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {(bookingResult.movieTheaterOptions || []).length > 0 && (
                <div className="rounded-md border p-3 bg-white">
                  <p className="text-sm font-medium text-[#4B2E2B] mb-2">
                    {bookingQuery} - Theater Wise Ticket Rates
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {bookingResult.movieTheaterOptions.map((item) => (
                      <div key={`${item.theaterName}-${item.rate}`} className="rounded-md border p-2 bg-[#FFF8F0]">
                        <p className="text-sm font-medium">{item.theaterName}</p>
                        <p className="text-xs text-[#8C5A3C]">Estimated Ticket: {formatInr(item.rate)}</p>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-1 text-xs underline text-[#4B2E2B]"
                        >
                          Check {bookingQuery} tickets
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-3">
                {(bookingResult.ticketOptions || []).map((item) => (
                  <div key={item.platform} className="rounded-md border p-3 text-sm bg-[#FFF8F0]">
                    <p className="font-medium text-[#4B2E2B]">{item.platform}</p>
                    <p className="text-xs text-[#8C5A3C]">
                      Ticket Rate: {formatInr(item.rate)}
                    </p>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-xs text-[#4B2E2B] underline"
                    >
                      Choose & Book Ticket
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 bg-gradient-to-br from-[#FFF8F0] to-[#f5e6d7] border-[#C08552]/30">
        <CardHeader>
          <CardTitle className="text-[#4B2E2B]">Stock Market & Investing Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={riskProfile} onValueChange={setRiskProfile}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Select risk profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Select value={horizon} onValueChange={setHorizon}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Select investment horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="less than 1 year">Less than 1 year</SelectItem>
                <SelectItem value="1-3 years">1-3 years</SelectItem>
                <SelectItem value="3-5 years">3-5 years</SelectItem>
                <SelectItem value="5+ years">5+ years</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={onGetMarketTips}
              disabled={marketTipsLoading}
              className="bg-[#4B2E2B] hover:bg-[#8C5A3C]"
              suppressHydrationWarning
            >
              {marketTipsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Tips"}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={investmentQuery}
              onChange={(e) => setInvestmentQuery(e.target.value)}
              placeholder="Search investment symbol/index (e.g., NIFTY 50, RELIANCE.NS)"
              suppressHydrationWarning
            />
            <Button variant="outline" onClick={onSearchInvestment} disabled={investmentInsightsLoading} suppressHydrationWarning>
              {investmentInsightsLoading ? "Loading chart..." : "Search Investment"}
            </Button>
          </div>
          {marketTips?.success && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3 bg-white">
                <p className="font-medium mb-2 text-[#4B2E2B]">Stock Market Tips</p>
                {(marketTips.stockMarketTips || []).map((tip) => (
                  <p key={tip} className="text-sm">
                    - {tip}
                  </p>
                ))}
              </div>
              <div className="rounded-md border p-3 bg-white">
                <p className="font-medium mb-2 text-[#4B2E2B]">Investing Tips</p>
                {(marketTips.investingTips || []).map((tip) => (
                  <p key={tip} className="text-sm">
                    - {tip}
                  </p>
                ))}
                <p className="mt-2 text-sm font-medium text-[#8C5A3C]">
                  Allocation Hint: {marketTips.allocationHint}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-md border p-3 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-[#4B2E2B]">Market Snapshot (Proof)</p>
              <Button
                variant="outline"
                size="sm"
                onClick={marketSnapshotFn}
                disabled={marketSnapshotLoading}
                suppressHydrationWarning
              >
                {marketSnapshotLoading ? "Refreshing..." : "Refresh Market Data"}
              </Button>
            </div>
            {marketSnapshot?.success && marketSnapshot?.indices?.length > 0 ? (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  {marketSnapshot.indices.map((item) => (
                    <div key={item.symbol} className="rounded border p-2">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.symbol}</p>
                      <p className="text-sm">{item.price.toFixed(2)}</p>
                      <p
                        className={`text-xs ${
                          item.changePct >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {item.changePct.toFixed(2)}%
                      </p>
                    </div>
                  ))}
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={marketSnapshot.indices.map((item) => ({
                        name: item.name,
                        value: item.price,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8C5A3C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(marketSnapshot.sources || []).map((src) => (
                    <a
                      key={src.label}
                      href={src.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-[#4B2E2B]"
                    >
                      Source: {src.label}
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {marketSnapshot?.message || "Live market snapshot is unavailable right now."}
              </p>
            )}
          </div>
          {investmentInsights?.success && (
            <div className="rounded-md border p-3 bg-white space-y-2">
              <p className="font-medium text-[#4B2E2B]">
                Investment Search Result: {investmentInsights.symbol}
              </p>
              <p className="text-sm text-muted-foreground">{investmentInsights.summary}</p>
              {investmentInsights.points?.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={investmentInsights.points}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#8C5A3C"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No chart points available for this query.</p>
              )}
              <div className="flex flex-wrap gap-3">
                {(investmentInsights.sources || []).map((src) => (
                  <a
                    key={src.label}
                    href={src.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-[#4B2E2B]"
                  >
                    Source: {src.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 bg-gradient-to-br from-[#FFF8F0] to-white border-[#C08552]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#4B2E2B]">
            <Sparkles className="h-5 w-5 text-[#8C5A3C]" /> High-Impact Finance Lab
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { name: "Emergency Fund", amount: 150000 },
              { name: "Bike", amount: 120000 },
              { name: "New Phone", amount: 70000 },
              { name: "Vacation", amount: 90000 },
            ].map((preset) => (
              <Button
                key={preset.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setGoalName(preset.name);
                  setGoalAmount(preset.amount);
                }}
                suppressHydrationWarning
              >
                {preset.name}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={goalName} onValueChange={setGoalName}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Goal name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Emergency Fund">Emergency Fund</SelectItem>
                <SelectItem value="New Phone">New Phone</SelectItem>
                <SelectItem value="Bike">Bike</SelectItem>
                <SelectItem value="Vacation">Vacation</SelectItem>
                <SelectItem value="Laptop">Laptop</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="Goal amount (INR)" suppressHydrationWarning />
            <Select value={String(monthlySave)} onValueChange={setMonthlySave}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Monthly saving" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5000">Rs 5,000 / month</SelectItem>
                <SelectItem value="10000">Rs 10,000 / month</SelectItem>
                <SelectItem value="15000">Rs 15,000 / month</SelectItem>
                <SelectItem value="25000">Rs 25,000 / month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(investmentValue)} onValueChange={setInvestmentValue}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Current investments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Rs 0</SelectItem>
                <SelectItem value="50000">Rs 50,000</SelectItem>
                <SelectItem value="100000">Rs 1,00,000</SelectItem>
                <SelectItem value="300000">Rs 3,00,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={String(creditUtilization)} onValueChange={setCreditUtilization}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Credit utilization %" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15%</SelectItem>
                <SelectItem value="30">30%</SelectItem>
                <SelectItem value="45">45%</SelectItem>
                <SelectItem value="60">60%</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(latePayments)} onValueChange={setLatePayments}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Late payments count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 late payments</SelectItem>
                <SelectItem value="1">1 late payment</SelectItem>
                <SelectItem value="2">2 late payments</SelectItem>
                <SelectItem value="3">3+ late payments</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(emiRatio)} onValueChange={setEmiRatio}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="EMI ratio %" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15%</SelectItem>
                <SelectItem value="25">25%</SelectItem>
                <SelectItem value="35">35%</SelectItem>
                <SelectItem value="45">45%</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskStyle} onValueChange={setRiskStyle}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Portfolio risk style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={taxRegime} onValueChange={setTaxRegime}>
              <SelectTrigger suppressHydrationWarning>
                <SelectValue placeholder="Tax regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New Regime</SelectItem>
                <SelectItem value="old">Old Regime</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground md:col-span-2 self-center">
              This section auto-refreshes when you change dropdown values.
            </p>
            <Button onClick={onGetHighImpactInsights} disabled={highImpactLoading} className="bg-[#4B2E2B] hover:bg-[#8C5A3C]" suppressHydrationWarning>
              {highImpactLoading ? "Generating..." : "Generate High-Impact Insights"}
            </Button>
          </div>

          {highImpactData?.generatedAt && (
            <div className="rounded-md border p-2 bg-white text-xs text-muted-foreground">
              Last refresh: {new Date(highImpactData.generatedAt).toLocaleString()} | Inputs used: goal {highImpactData.inputEcho?.goalName},{" "}
              save {formatInr(highImpactData.inputEcho?.monthlySave || 0)}, utilization {highImpactData.inputEcho?.creditUtilization || 0}%,
              EMI {highImpactData.inputEcho?.emiRatio || 0}%, risk {String(highImpactData.inputEcho?.riskStyle || "-").toUpperCase()},
              tax {String(highImpactData.inputEcho?.taxRegime || "-").toUpperCase()}
            </div>
          )}

          {highImpactInsights?.success && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3 bg-white space-y-2">
                <p className="font-medium text-[#4B2E2B]">Net Worth Tracker</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Assets: {formatInr(highImpactInsights.netWorth.assets)}</Badge>
                  <Badge variant="outline">Liabilities: {formatInr(highImpactInsights.netWorth.liabilities)}</Badge>
                  <Badge>Net: {formatInr(highImpactInsights.netWorth.net)}</Badge>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={highImpactInsights.netWorth.trend || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="netWorth" stroke="#8C5A3C" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-md border p-3 bg-white space-y-2">
                <p className="font-medium text-[#4B2E2B]">Goal Simulator - {highImpactInsights.goalSimulator.goalName}</p>
                {(highImpactInsights.goalSimulator.plans || []).map((plan) => (
                  <div key={plan.type} className="rounded-md border p-2 bg-[#FFF8F0] text-sm">
                    <p className="font-medium">{plan.type}</p>
                    <p>Monthly: {formatInr(plan.monthlyContribution)}</p>
                    <p>Time to Goal: {plan.monthsToGoal} month(s)</p>
                    <p>Target Date: {plan.targetDate}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-md border p-3 bg-white space-y-2">
                <p className="font-medium text-[#4B2E2B]">Smart Bill Reminder</p>
                {(highImpactInsights.billReminder.recurringBills || []).length > 0 ? (
                  highImpactInsights.billReminder.recurringBills.map((bill) => (
                    <div key={`${bill.title}-${bill.dueDate}`} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{bill.title}</p>
                      <p>Expected Amount: {formatInr(bill.amount)}</p>
                      <p>Likely Due Date: {bill.dueDate}</p>
                      <Badge variant={bill.riskLevel === "HIGH" ? "destructive" : "outline"}>
                        Risk if Missed: {bill.riskLevel}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recurring bill pattern found yet.</p>
                )}
              </div>

              <div className="rounded-md border p-3 bg-white space-y-2">
                <p className="font-medium text-[#4B2E2B]">Credit Health + Spend Guardrail</p>
                <p className="text-sm">
                  Credit Score: <span className="font-medium">{highImpactInsights.creditHealth.score}</span>{" "}
                  ({highImpactInsights.creditHealth.band})
                </p>
                {(highImpactInsights.creditHealth.actions || []).map((action) => (
                  <p key={action} className="text-sm">- {action}</p>
                ))}
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium">Spend Guardrail: {highImpactInsights.spendGuardrail.level}</p>
                  <p className="text-sm">Predicted month expense: {formatInr(highImpactInsights.spendGuardrail.predictedMonthExpense)}</p>
                  <p className="text-sm">Overshoot probability proxy: {highImpactInsights.spendGuardrail.overshootPct}%</p>
                  <p className="text-xs text-muted-foreground">{highImpactInsights.spendGuardrail.message}</p>
                </div>
              </div>

              <div className="rounded-md border p-3 bg-white space-y-2">
                <p className="font-medium text-[#4B2E2B]">Portfolio Rebalancer ({highImpactInsights.portfolioRebalancer.riskStyle})</p>
                {(highImpactInsights.portfolioRebalancer.actions || []).map((row) => (
                  <p key={row.bucket} className="text-sm">
                    {row.bucket.toUpperCase()}: Current {row.currentPct}% | Target {row.targetPct}% | {row.action}
                  </p>
                ))}
              </div>

              <div className="rounded-md border p-3 bg-white space-y-2">
                <p className="font-medium text-[#4B2E2B]">Basic Tax Planner (India)</p>
                <p className="text-sm">Annual Income: {formatInr(highImpactInsights.taxPlanner.annualIncome)}</p>
                <p className="text-sm">Estimated Savings: {formatInr(highImpactInsights.taxPlanner.estimatedAnnualSavings)}</p>
                <p className="text-sm">Old Regime Est. Tax: {formatInr(highImpactInsights.taxPlanner.oldRegimeTax)}</p>
                <p className="text-sm">New Regime Est. Tax: {formatInr(highImpactInsights.taxPlanner.newRegimeTax)}</p>
                <Badge variant="outline">
                  Suggested Regime: {String(highImpactInsights.taxPlanner.suggestedRegime || "").toUpperCase()}
                </Badge>
                {(highImpactInsights.taxPlanner.tips || []).map((tip) => (
                  <p key={tip} className="text-sm">- {tip}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 bg-gradient-to-br from-fuchsia-50 to-cyan-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-fuchsia-600" /> Advanced AI Insights (Final Year Demo)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={advancedFn} disabled={advancedLoading} suppressHydrationWarning>
              {advancedLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refresh AI Insights
                </>
              ) : (
                "Refresh AI Insights"
              )}
            </Button>
            {advancedInsights?.aiLayer?.projectDemoTitle && (
              <Badge>{advancedInsights.aiLayer.projectDemoTitle}</Badge>
            )}
          </div>

          {advancedInsights && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Monthly Forecast
                </p>
                <p>Income: {formatInr(advancedInsights.monthIncome)}</p>
                <p>Current Expense: {formatInr(advancedInsights.monthExpense)}</p>
                <p>
                  Predicted Month-End Expense:{" "}
                  {formatInr(advancedInsights.predictedMonthExpense)}
                </p>
                <p>Daily Safe Spend: {formatInr(advancedInsights.dailySafeSpend)}</p>
              </div>

              <div className="rounded-md border p-3">
                <p className="font-medium">50 / 30 / 20 AI Analysis</p>
                <p>Needs: {advancedInsights.rule503020.needsPct.toFixed(1)}%</p>
                <p>Wants: {advancedInsights.rule503020.wantsPct.toFixed(1)}%</p>
                <p>Savings: {advancedInsights.rule503020.savingsPct.toFixed(1)}%</p>
                <p>
                  Savings Efficiency Score:{" "}
                  {advancedInsights.savingsEfficiencyScore.toFixed(1)} / 100
                </p>
              </div>

              <div className="rounded-md border p-3">
                <p className="font-medium">Unusual Spending Detection</p>
                {advancedInsights.anomalies.length === 0 ? (
                  <p className="text-muted-foreground">No major anomalies detected.</p>
                ) : (
                  advancedInsights.anomalies.map((item) => (
                    <p key={item.id}>
                      {item.description} - {formatInr(item.amount)}
                    </p>
                  ))
                )}
              </div>

              <div className="rounded-md border p-3">
                <p className="font-medium">Recurring Subscription Detection</p>
                {advancedInsights.possibleSubscriptions.length === 0 ? (
                  <p className="text-muted-foreground">No repeated subscription patterns.</p>
                ) : (
                  advancedInsights.possibleSubscriptions.map((item) => (
                    <p key={`${item.name}-${item.amount}`}>
                      {item.name} ({item.occurrences}x) - {formatInr(item.amount)}
                    </p>
                  ))
                )}
              </div>

              <div className="rounded-md border p-3 md:col-span-2">
                <p className="font-medium">Increase Income Suggestions</p>
                <div className="mt-2 space-y-1">
                  {(advancedInsights?.aiLayer?.incomeBoostIdeas || []).map((idea) => (
                    <p key={idea}>- {idea}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-md border p-3 md:col-span-2 bg-white">
                <p className="font-medium mb-2">30-Day Expense Trend (Real Transactions)</p>
                {advancedInsights?.dailyExpenseSeries?.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={advancedInsights.dailyExpenseSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="amount" stroke="#8C5A3C" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No expense trend data for last 30 days.</p>
                )}
              </div>
              <div className="rounded-md border p-3 bg-white">
                <p className="font-medium mb-2">Category Spend Mix</p>
                {advancedInsights?.categorySpendData?.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={advancedInsights.categorySpendData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={90}
                          label
                        >
                          {advancedInsights.categorySpendData.map((entry, index) => (
                            <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No category spend data available.</p>
                )}
              </div>
              <div className="rounded-md border p-3 bg-white">
                <p className="font-medium mb-2">Top Categories (INR)</p>
                <div className="space-y-1">
                  {(advancedInsights?.categorySpendData || []).slice(0, 6).map((item) => (
                    <p key={item.name} className="text-sm flex items-center justify-between">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatInr(item.value)}</span>
                    </p>
                  ))}
                  {(!advancedInsights?.categorySpendData ||
                    advancedInsights.categorySpendData.length === 0) && (
                    <p className="text-sm text-muted-foreground">No category data yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {advancedInsights?.aiLayer?.coachHighlights?.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="font-medium mb-2">AI Coach Highlights</p>
              <div className="space-y-1">
                {advancedInsights.aiLayer.coachHighlights.map((point) => (
                  <p key={point}>- {point}</p>
                ))}
              </div>
              <p className="mt-2 font-medium">
                Next Best Action: {advancedInsights.aiLayer.nextBestAction}
              </p>
            </div>
          )}

          <div className="rounded-md border p-3 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">City Coupons (Food + Movie)</p>
              <Button variant="outline" onClick={onGetCityCoupons} disabled={cityCouponsLoading} suppressHydrationWarning>
                {cityCouponsLoading ? "Loading coupons..." : "Get Coupons by My City"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uses detected city: <span className="font-medium">{bookingLocation || "Mumbai"}</span>
            </p>
            {cityCoupons?.success && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3 bg-[#FFF8F0]">
                  <p className="font-medium mb-2">Food Coupon Picks - {cityCoupons.city}</p>
                  {(cityCoupons.foodCoupons || []).map((item) => (
                    <a
                      key={item.title}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm underline text-[#4B2E2B] mb-1"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
                <div className="rounded-md border p-3 bg-[#FFF8F0]">
                  <p className="font-medium mb-2">Movie Coupon Picks - {cityCoupons.city}</p>
                  {(cityCoupons.movieCoupons || []).map((item) => (
                    <a
                      key={item.title}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm underline text-[#4B2E2B] mb-1"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
