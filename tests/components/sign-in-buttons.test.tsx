// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInButtons } from "@/app/sign-in/sign-in-buttons";

const { signInSocial } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: signInSocial,
    },
  },
}));

afterEach(cleanup);

describe("SignInButtons", () => {
  beforeEach(() => {
    signInSocial.mockReset();
  });

  it("calls Google sign-in and shows Redirecting... while pending", async () => {
    const user = userEvent.setup();
    signInSocial.mockReturnValue(new Promise(() => {}));

    render(<SignInButtons />);
    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/",
    });
    expect(
      screen.getByRole("button", { name: "Redirecting..." }),
    ).toBeDisabled();
  });

  it("shows the error message when sign-in fails", async () => {
    const user = userEvent.setup();
    signInSocial.mockRejectedValue(new Error("Google is down"));

    render(<SignInButtons />);
    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(await screen.findByText("Google is down")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
  });
});
