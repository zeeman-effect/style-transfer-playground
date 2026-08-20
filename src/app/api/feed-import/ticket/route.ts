import { getProject } from "@/lib/account/projects";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";
import { createFeedImportToken } from "@/lib/feeds/import-token";
import { MAX_FEED_IMPORT, MIN_FEED_IMPORT } from "@/lib/images/constants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const source = typeof body.source === "string" ? body.source.trim() : "";
    const count = typeof body.count === "number" ? body.count : Number.NaN;

    if (!projectId || !source) {
      return Response.json({ error: "Missing import details." }, { status: 400 });
    }
    if (
      !Number.isInteger(count) ||
      count < MIN_FEED_IMPORT ||
      count > MAX_FEED_IMPORT
    ) {
      return Response.json(
        { error: "Image count must be a positive integer." },
        { status: 400 },
      );
    }

    await getProject(user.id, projectId);
    const token = await createFeedImportToken({
      userId: user.id,
      projectId,
      source,
      count,
    });
    return Response.json({ token });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ProjectNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json(
      { error: "Could not start the import." },
      { status: 500 },
    );
  }
}
