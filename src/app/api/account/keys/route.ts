import {
  deleteUserProviderKey,
  getStoredProviderFlags,
  isProviderId,
  saveUserProviderKey,
} from "@/lib/account/keys";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { logKeyEvent, safeErrorMessage } from "@/lib/logging";

function errorResponse(error: unknown): Response | null {
  if (error instanceof AuthRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const configured = await getStoredProviderFlags(user.id);
    return Response.json({ configured });
  } catch (error) {
    return errorResponse(error) ?? Response.json({ error: "Could not load keys." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { provider?: unknown; key?: unknown };
    if (!isProviderId(body.provider)) {
      return Response.json({ error: "Unknown provider." }, { status: 400 });
    }
    if (typeof body.key !== "string" || body.key.trim().length === 0) {
      return Response.json({ error: "API key is required." }, { status: 400 });
    }

    const provider = body.provider;
    const action = await saveUserProviderKey(user.id, provider, body.key.trim());
    await logKeyEvent(user.id, provider, action);
    return Response.json({ ok: true });
  } catch (error) {
    const unauthorized = errorResponse(error);
    if (unauthorized) {
      return unauthorized;
    }
    console.error("Failed to save API key:", safeErrorMessage(error));
    const message =
      error instanceof Error ? safeErrorMessage(error) : "Could not save API key.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { provider?: unknown };
    if (!isProviderId(body.provider)) {
      return Response.json({ error: "Unknown provider." }, { status: 400 });
    }

    const removed = await deleteUserProviderKey(user.id, body.provider);
    if (removed) {
      await logKeyEvent(user.id, body.provider, "removed");
    }
    return Response.json({ ok: true });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not remove API key." }, { status: 500 })
    );
  }
}
