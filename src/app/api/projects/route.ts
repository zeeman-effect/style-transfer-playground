import { createProject, listProjects } from "@/lib/account/projects";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";

function errorResponse(error: unknown): Response | null {
  if (error instanceof AuthRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const result = await listProjects(user.id);
    return Response.json(result);
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not load projects." }, { status: 500 })
    );
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const project = await createProject(user.id);
    return Response.json({ project });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json({ error: "Could not create project." }, { status: 500 })
    );
  }
}
