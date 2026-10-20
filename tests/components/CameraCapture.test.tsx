// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CameraCapture, { describeCameraError } from "@/components/CameraCapture";

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, "mediaDevices", { value, configurable: true });
}

afterEach(() => { cleanup(); setMediaDevices(undefined); });

describe("CameraCapture", () => {
  it("shows a permission error and offers a fallback when access is denied", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    setMediaDevices({ getUserMedia });
    const onUseFallback = vi.fn();
    render(<CameraCapture onConfirm={vi.fn()} onClose={vi.fn()} onUseFallback={onUseFallback} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission was denied/i);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }));
    await userEvent.click(screen.getByRole("button", { name: /use device camera app/i }));
    expect(onUseFallback).toHaveBeenCalled();
  });

  it("explains when the camera API is unavailable", async () => {
    setMediaDevices(undefined);
    render(<CameraCapture onConfirm={vi.fn()} onClose={vi.fn()} onUseFallback={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/not supported in this browser/i);
  });

  it("allows retrying after a failure", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error("nf"), { name: "NotFoundError" }));
    setMediaDevices({ getUserMedia });
    render(<CameraCapture onConfirm={vi.fn()} onClose={vi.fn()} onUseFallback={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/no camera was found/i);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });

  it("maps camera error names to helpful messages", () => {
    expect(describeCameraError({ name: "NotReadableError" })).toMatch(/in use/);
    expect(describeCameraError(new Error("x"))).toMatch(/could not be started/);
  });
});
