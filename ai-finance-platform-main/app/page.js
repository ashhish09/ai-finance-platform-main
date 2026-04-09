import React from "react";
import HeroSection from "@/components/hero";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Radar, ShoppingBag, Wallet } from "lucide-react";
import WeatherLoader from "@/components/weather-loader";

const coreBlocks = [
  {
    title: "AI Copilot Chat",
    desc: "Ask anything and get practical finance + planning answers with context memory.",
    icon: <Bot className="h-5 w-5 text-indigo-600" />,
  },
  {
    title: "Smart Product Discovery",
    desc: "Budget-based internet search with cheapest-product highlight and model suggestions.",
    icon: <ShoppingBag className="h-5 w-5 text-amber-600" />,
  },
  {
    title: "Risk & Pattern Intelligence",
    desc: "Anomaly detection, month-end forecast, recurring subscription alerts, and risk levels.",
    icon: <Radar className="h-5 w-5 text-fuchsia-600" />,
  },
  {
    title: "Balance-first Advice",
    desc: "AI recommendations are generated from your account balance and real spending data.",
    icon: <Wallet className="h-5 w-5 text-blue-600" />,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50">
      <WeatherLoader />
      <HeroSection />

      <section id="features" className="py-16">
        <div className="container mx-auto px-4 space-y-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold">A Fully New MoneyMind Experience</h2>
            <p className="text-muted-foreground mt-2">
              High-impact interface for your final year project with advanced AI workflows.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {coreBlocks.map((item) => (
              <Card key={item.title} className="border-blue-100 shadow-sm">
                <CardContent className="pt-6 space-y-3">
                  <div>{item.icon}</div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
