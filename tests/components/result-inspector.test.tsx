// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultInspector } from "@/components/result-inspector";

function Harness({
  image,
  index,
  isModifying = false,
  onClose = vi.fn(),
  onModify = vi.fn(),
}: {
  image: string;
  index: number;
  isModifying?: boolean;
  onClose?: () => void;
  onModify?: () => void;
}) {
  const [updateText, setUpdateText] = useState("");
  return (
    <ResultInspector
      image={image}
      index={index}
      updateText={updateText}
      onUpdateTextChange={setUpdateText}
      onModify={onModify}
      onClose={onClose}
      isModifying={isModifying}
      modifyDisabled={false}
    />
  );
}

afterEach(cleanup);

describe("ResultInspector", () => {
  it("shows Modify Image and Modifying...", () => {
    const { rerender } = render(
      <Harness image="data:image/jpeg;base64,abc" index={0} />,
    );
    expect(screen.getByRole("button", { name: "Modify Image" })).toBeInTheDocument();

    rerender(
      <Harness image="data:image/jpeg;base64,abc" index={0} isModifying />,
    );
    expect(
      screen.getByRole("button", { name: "Modifying..." }),
    ).toBeInTheDocument();
  });

  it("closes from the button and Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Harness
        image="data:image/jpeg;base64,abc"
        index={0}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("uses png or jpg download filenames from the data URL mime", () => {
    const { rerender } = render(
      <Harness image="data:image/png;base64,abc" index={0} />,
    );
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "download",
      "meme-1.png",
    );

    rerender(<Harness image="data:image/jpeg;base64,abc" index={3} />);
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "download",
      "meme-4.jpg",
    );
  });

  it("updates the textarea", async () => {
    const user = userEvent.setup();
    render(<Harness image="data:image/jpeg;base64,abc" index={0} />);
    const field = screen.getByPlaceholderText("Update image...");
    await user.type(field, "make it funnier");
    expect(field).toHaveValue("make it funnier");
  });
});
