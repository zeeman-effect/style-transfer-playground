import {
  GenerationNotFoundError,
  getProjectGenerationImage,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; gid: string; iid: string }> },
) {
  try {
    const user = await requireUser();
    const { id, gid, iid } = await params;
    const image = await getProjectGenerationImage(user.id, id, gid, iid);
    return new Response(image.bytes, {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not load generation image." }, { status: 500 })
    );
  }
}
