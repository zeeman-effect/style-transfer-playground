import { getStoredProviderFlags } from "@/lib/account/keys";
import { getSession } from "@/lib/auth/session";
import { ANALYSIS_MODELS } from "@/lib/generation/analysis-models";
import { GENERATION_MODELS } from "@/lib/generation/models";
import { STYLE_ANALYZERS } from "@/lib/generation/style/registry";
import type { GenerationConfigResponse, ProviderId } from "@/lib/generation/types";

const ANONYMOUS_CONFIGURED: Record<ProviderId, boolean> = {
  google: false,
  openai: false,
};

export async function GET() {
  const session = await getSession();
  const configured = session?.user
    ? await getStoredProviderFlags(session.user.id)
    : ANONYMOUS_CONFIGURED;

  const body: GenerationConfigResponse = {
    models: GENERATION_MODELS,
    analysisModels: ANALYSIS_MODELS,
    analyzers: STYLE_ANALYZERS,
    configured,
  };

  return Response.json(body);
}
