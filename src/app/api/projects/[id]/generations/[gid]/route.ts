import {
  deleteProjectGeneration,
  GenerationNotFoundError,
} from "@/lib/account/generations";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";

function errorResponse(error: unknown): Response | null {
  if (error instanceof AuthRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (
    error instanceof ProjectNotFoundError ||
    error instanceof GenerationNotFoundError
  ) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  return null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  try {
    const user = await requireUser();
    const { id, gid } = await params;
    await deleteProjectGeneration(user.id, id, gid);
    return Response.json({ ok: true });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not delete generation." }, { status: 500 })
    );
  }
}
