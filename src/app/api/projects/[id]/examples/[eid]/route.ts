import {
  deleteProjectExample,
  ExampleNotFoundError,
} from "@/lib/account/examples";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";

function errorResponse(error: unknown): Response | null {
  if (error instanceof AuthRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (
    error instanceof ProjectNotFoundError ||
    error instanceof ExampleNotFoundError
  ) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  return null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; eid: string }> },
) {
  try {
    const user = await requireUser();
    const { id, eid } = await params;
    await deleteProjectExample(user.id, id, eid);
    return Response.json({ ok: true });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not delete example." }, { status: 500 })
    );
  }
}
