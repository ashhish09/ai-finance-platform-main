import { getAiCoachContext } from "@/actions/ai-coach";
import { AICoachClient } from "./_components/ai-coach-client";

export default async function AICoachPage() {
  const context = await getAiCoachContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-title">MoneyMind AI Coach</h1>
        <p className="text-muted-foreground">
          Smart balance-aware recommendations, budget shopping, and ask-anything chat support.
        </p>
      </div>

      <AICoachClient initialContext={context} />
    </div>
  );
}
