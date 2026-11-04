import { describe, expect, it } from "vitest";
import { placePanel } from "../popover";

const viewport = { width: 1000, height: 800 };
const panel = { width: 100, height: 120 };
const at = (top: number, left = 450) => ({ top, bottom: top + 20, left, width: 100 });

describe("placePanel", () => {
  it("goes below the trigger when it fits", () => {
    expect(placePanel(at(100), panel, viewport)).toEqual({ top: 128, left: 450, maxHeight: null });
  });

  it("flips above when the trigger is near the bottom of the window", () => {
    // trigger 740–760: 32px below, 732px above
    expect(placePanel(at(740), panel, viewport)).toEqual({
      top: 740 - 8 - 120,
      left: 450,
      maxHeight: null,
    });
  });

  it("stays below when it fits exactly", () => {
    // bottom 664 + 8 gap + 120 + 8 margin = 800
    expect(placePanel(at(644), panel, viewport).top).toBe(672);
    expect(placePanel(at(645), panel, viewport).top).toBe(645 - 8 - 120);
  });

  it("caps height on the roomier side when it fits on neither", () => {
    const tall = { width: 100, height: 500 };
    const small = { width: 1000, height: 400 };
    expect(placePanel(at(100), tall, small)).toEqual({ top: 128, left: 450, maxHeight: 264 });
    expect(placePanel(at(280), tall, small)).toEqual({ top: 8, left: 450, maxHeight: 264 });
  });

  it("clamps horizontally to the window edges", () => {
    expect(placePanel(at(100, 0), panel, viewport).left).toBe(8);
    expect(placePanel(at(100, 960), panel, viewport).left).toBe(1000 - 100 - 8);
  });
});
