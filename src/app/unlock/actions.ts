"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSiteAccessToken,
  getSitePassword,
  isValidSitePassword,
  sanitizeReturnPath,
  SITE_ACCESS_COOKIE,
} from "@/lib/site-access";

export async function submitSitePassword(formData: FormData) {
  if (!getSitePassword()) {
    redirect("/");
  }

  const nextPath = sanitizeReturnPath(formData.get("from"));
  if (!isValidSitePassword(String(formData.get("password") ?? ""))) {
    const unlock = new URLSearchParams();
    unlock.set("error", "1");
    if (nextPath !== "/") {
      unlock.set("from", nextPath);
    }
    redirect(`/unlock?${unlock.toString()}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SITE_ACCESS_COOKIE, createSiteAccessToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(nextPath);
}
