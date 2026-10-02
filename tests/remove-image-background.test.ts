import { describe, expect, it } from "vitest";
import { removeConnectedEdgeBackground } from "@/lib/images/remove-background";

function pixelBuffer(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = 255;
  }
  return data;
}

describe("removeConnectedEdgeBackground", () => {
  it("retire un fond sombre relié aux bords sans effacer le sujet", () => {
    const width = 5;
    const height = 5;
    const pixels = pixelBuffer(width, height, [8, 10, 15]);
    const center = (2 * width + 2) * 4;
    pixels[center] = 220;
    pixels[center + 1] = 170;
    pixels[center + 2] = 50;

    const removed = removeConnectedEdgeBackground(pixels, width, height);

    expect(removed).toBe(24);
    expect(pixels[3]).toBe(0);
    expect(pixels[center + 3]).toBe(255);
  });

  it("préserve une zone sombre enfermée dans le sujet", () => {
    const width = 5;
    const height = 5;
    const pixels = pixelBuffer(width, height, [245, 245, 245]);
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = 12;
        pixels[offset + 1] = 15;
        pixels[offset + 2] = 22;
      }
    }

    removeConnectedEdgeBackground(pixels, width, height);

    expect(pixels[(2 * width + 2) * 4 + 3]).toBe(255);
  });

  it("ne retraitera pas une image qui possède déjà de la transparence", () => {
    const pixels = pixelBuffer(3, 3, [10, 10, 10]);
    pixels[3] = 0;

    const removed = removeConnectedEdgeBackground(pixels, 3, 3);

    expect(removed).toBe(0);
    expect(pixels[(1 * 3 + 1) * 4 + 3]).toBe(255);
  });
});
