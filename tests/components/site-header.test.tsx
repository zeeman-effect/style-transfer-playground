// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";

const { usePathname, push, refresh, useSession, signOut, useProjectChrome } =
  vi.hoisted(() => ({
    usePathname: vi.fn(() => "/"),
    push: vi.fn(),
    refresh: vi.fn(),
    useSession: vi.fn(),
    signOut: vi.fn(),
    useProjectChrome: vi.fn(() => null),
  }));

vi.mock("next/navigation", () => ({
  usePathname,
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession,
    signOut,
  },
}));

vi.mock("@/components/project-chrome", () => ({
  useProjectChrome,
}));

afterEach(cleanup);

describe("SiteHeader", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/");
    useSession.mockReturnValue({ data: null, isPending: false });
    useProjectChrome.mockReturnValue(null);
    push.mockReset();
    refresh.mockReset();
    signOut.mockReset();
  });

  it("shows Sign in when logged out", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("shows Home on the sign-in page", () => {
    usePathname.mockReturnValue("/sign-in");
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows name, Settings, and Sign out when logged in", async () => {
    const user = userEvent.setup();
    useSession.mockReturnValue({
      data: { user: { name: "Zach", email: "zach@example.com" } },
      isPending: false,
    });
    signOut.mockResolvedValue(undefined);

    render(<SiteHeader />);

    expect(screen.getByText("Zach")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });

  it("hides account controls on /unlock", () => {
    usePathname.mockReturnValue("/unlock");
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("shows Loading... while the session is pending", () => {
    useSession.mockReturnValue({ data: null, isPending: true });
    render(<SiteHeader />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
