import { getUserGeneration } from "@/lib/account/generation";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireUser();
    const generation = await getUserGeneration(user.id);
    return Response.json({ generation });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Could not load last generation." }, { status: 500 });
  }
}
