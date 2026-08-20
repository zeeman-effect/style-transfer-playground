import {
  createProjectExample,
  ExampleLimitError,
  ExampleUploadError,
} from "@/lib/account/examples";
import { ProjectNotFoundError } from "@/lib/account/errors";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";

function errorResponse(error: unknown): Response | null {
  if (error instanceof AuthRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ProjectNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ExampleLimitError || error instanceof ExampleUploadError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const formData = await request.formData();
    const fileValue = formData.get("file") ?? formData.get("example");
    if (!(fileValue instanceof File) || fileValue.size <= 0) {
      return Response.json({ error: "Please choose an image file." }, { status: 400 });
    }

    const example = await createProjectExample(user.id, id, fileValue);
    return Response.json({ example });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not save example." }, { status: 500 })
    );
  }
}
