import {
  deleteProject,
  getProject,
  parseStoredExamples,
  parseStringArray,
  patchProject,
  ProjectNotFoundError,
  type ProjectPatch,
} from "@/lib/account/projects";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";

function errorResponse(error: unknown): Response | null {
  if (error instanceof AuthRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ProjectNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await getProject(user.id, id);
    return Response.json({ project });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not load project." }, { status: 500 })
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const patch: ProjectPatch = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return Response.json({ error: "Invalid project name." }, { status: 400 });
      }
      patch.name = body.name;
    }

    if (body.opened !== undefined) {
      if (typeof body.opened !== "boolean") {
        return Response.json({ error: "Invalid opened flag." }, { status: 400 });
      }
      patch.opened = body.opened;
    }

    if (body.prompt !== undefined) {
      if (typeof body.prompt !== "string") {
        return Response.json({ error: "Invalid prompt." }, { status: 400 });
      }
      patch.prompt = body.prompt;
    }

    if (body.modelId !== undefined) {
      if (typeof body.modelId !== "string") {
        return Response.json({ error: "Invalid model." }, { status: 400 });
      }
      patch.modelId = body.modelId;
    }

    if (body.analyzerId !== undefined) {
      if (typeof body.analyzerId !== "string") {
        return Response.json({ error: "Invalid analyzer." }, { status: 400 });
      }
      patch.analyzerId = body.analyzerId;
    }

    if (body.analysisModelId !== undefined) {
      if (body.analysisModelId !== null && typeof body.analysisModelId !== "string") {
        return Response.json({ error: "Invalid analysis model." }, { status: 400 });
      }
      patch.analysisModelId = body.analysisModelId;
    }

    if (body.styleHint !== undefined) {
      if (typeof body.styleHint !== "string") {
        return Response.json({ error: "Invalid style hint." }, { status: 400 });
      }
      patch.styleHint = body.styleHint;
    }

    if (body.images !== undefined) {
      const images = parseStringArray(body.images);
      if (!images) {
        return Response.json({ error: "Invalid images." }, { status: 400 });
      }
      patch.images = images;
    }

    if (body.examples !== undefined) {
      const examples = parseStoredExamples(body.examples);
      if (!examples) {
        return Response.json({ error: "Invalid examples." }, { status: 400 });
      }
      patch.examples = examples;
    }

    if (body.selectedIndex !== undefined) {
      if (
        body.selectedIndex !== null &&
        (typeof body.selectedIndex !== "number" ||
          !Number.isInteger(body.selectedIndex))
      ) {
        return Response.json({ error: "Invalid selected index." }, { status: 400 });
      }
      patch.selectedIndex = body.selectedIndex;
    }

    if (body.updateText !== undefined) {
      if (typeof body.updateText !== "string") {
        return Response.json({ error: "Invalid update text." }, { status: 400 });
      }
      patch.updateText = body.updateText;
    }

    const project = await patchProject(user.id, id, patch);
    return Response.json({ project });
  } catch (error) {
    if (error instanceof Error && error.message === "Project name is required.") {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not save project." }, { status: 500 })
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await deleteProject(user.id, id);
    return Response.json(result);
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not delete project." }, { status: 500 })
    );
  }
}
