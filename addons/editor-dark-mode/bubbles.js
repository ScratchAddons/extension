import { textColor } from "../../libraries/common/cs/text-color.esm.js";

export default async function ({ addon, console }) {
  const renderer = addon.tab.traps.vm.runtime.renderer;
  const oldCreateTextSkin = renderer.createTextSkin.bind(renderer);
  renderer.createTextSkin = function (...args) {
    const skinId = oldCreateTextSkin(...args);
    const skin = renderer._allSkins[skinId];
    const oldRenderTextBubble = skin._renderTextBubble.bind(skin);
    skin._renderTextBubble = (scale) => {
      // Based on code from scratch-render/src/TextBubbleSkin.js
      if (addon.self.disabled || !addon.settings.get("affectStage")) return oldRenderTextBubble(scale);

      const BubbleStyle = {
        MAX_LINE_WIDTH: 170, // Maximum width, in Scratch pixels, of a single line of text

        MIN_WIDTH: 50, // Minimum width, in Scratch pixels, of a text bubble
        STROKE_WIDTH: 4, // Thickness of the stroke around the bubble. Only half's visible because it's drawn under the fill
        PADDING: 10, // Padding around the text area
        CORNER_RADIUS: 16, // Radius of the rounded corners
        TAIL_HEIGHT: 12, // Height of the speech bubble's "tail". Probably should be a constant.

        FONT: "Helvetica", // Font to render the text with
        FONT_SIZE: 14, // Font size, in Scratch pixels
        FONT_HEIGHT_RATIO: 0.9, // Height, in Scratch pixels, of the text, as a proportion of the font's size
        LINE_HEIGHT: 16, // Spacing between each line of text

        COLORS: {
          BUBBLE_FILL: addon.settings.get("accent"),
          BUBBLE_STROKE: textColor(addon.settings.get("accent"), "rgba(0, 0, 0, 0.15)", "rgba(255, 255, 255, 0.15"),
          TEXT_FILL: textColor(addon.settings.get("accent"), "#575e75", "#ffffff"),
        },
      };

      const ctx = skin._canvas.getContext("2d");

      if (skin._textDirty) {
        skin._reflowLines();
      }

      // Calculate the canvas-space sizes of the padded text area and full text bubble
      const paddedWidth = skin._textAreaSize.width;
      const paddedHeight = skin._textAreaSize.height;

      // Resize the canvas to the correct screen-space size
      skin._canvas.width = Math.ceil(skin._size[0] * scale);
      skin._canvas.height = Math.ceil(skin._size[1] * scale);
      skin._restyleCanvas();

      // Reset the transform before clearing to ensure 100% clearage
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, skin._canvas.width, skin._canvas.height);

      ctx.scale(scale, scale);
      ctx.translate(BubbleStyle.STROKE_WIDTH * 0.5, BubbleStyle.STROKE_WIDTH * 0.5);

      // If the text bubble points leftward, flip the canvas
      ctx.save();
      if (skin._pointsLeft) {
        ctx.scale(-1, 1);
        ctx.translate(-paddedWidth, 0);
      }

      // Draw the bubble's rounded borders
      ctx.beginPath();
      ctx.moveTo(BubbleStyle.CORNER_RADIUS, paddedHeight);
      ctx.arcTo(0, paddedHeight, 0, paddedHeight - BubbleStyle.CORNER_RADIUS, BubbleStyle.CORNER_RADIUS);
      ctx.arcTo(0, 0, paddedWidth, 0, BubbleStyle.CORNER_RADIUS);
      ctx.arcTo(paddedWidth, 0, paddedWidth, paddedHeight, BubbleStyle.CORNER_RADIUS);
      ctx.arcTo(
        paddedWidth,
        paddedHeight,
        paddedWidth - BubbleStyle.CORNER_RADIUS,
        paddedHeight,
        BubbleStyle.CORNER_RADIUS
      );

      // Translate the canvas so we don't have to do a bunch of width/height arithmetic
      ctx.save();
      ctx.translate(paddedWidth - BubbleStyle.CORNER_RADIUS, paddedHeight);

      // Draw the bubble's "tail"
      if (skin._bubbleType === "say") {
        // For a speech bubble, draw one swoopy thing
        ctx.bezierCurveTo(0, 4, 4, 8, 4, 10);
        ctx.arcTo(4, 12, 2, 12, 2);
        ctx.bezierCurveTo(-1, 12, -11, 8, -16, 0);

        ctx.closePath();
      } else {
        // For a thinking bubble, draw a partial circle attached to the bubble...
        ctx.arc(-16, 0, 4, 0, Math.PI);

        ctx.closePath();

        // and two circles detached from it
        ctx.moveTo(-7, 7.25);
        ctx.arc(-9.25, 7.25, 2.25, 0, Math.PI * 2);

        ctx.moveTo(0, 9.5);
        ctx.arc(-1.5, 9.5, 1.5, 0, Math.PI * 2);
      }

      // Un-translate the canvas and fill + stroke the text bubble
      ctx.restore();

      ctx.fillStyle = BubbleStyle.COLORS.BUBBLE_FILL;
      ctx.strokeStyle = BubbleStyle.COLORS.BUBBLE_STROKE;
      ctx.lineWidth = BubbleStyle.STROKE_WIDTH;

      ctx.stroke();
      ctx.fill();

      // Un-flip the canvas if it was flipped
      ctx.restore();

      // Draw each line of text
      ctx.fillStyle = BubbleStyle.COLORS.TEXT_FILL;
      ctx.font = `${BubbleStyle.FONT_SIZE}px ${BubbleStyle.FONT}, sans-serif`;
      const lines = skin._lines;
      for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];
        ctx.fillText(
          line,
          BubbleStyle.PADDING,
          BubbleStyle.PADDING +
            BubbleStyle.LINE_HEIGHT * lineNumber +
            BubbleStyle.FONT_HEIGHT_RATIO * BubbleStyle.FONT_SIZE
        );
      }

      skin._renderedScale = scale;
    };
    return skinId;
  };

  const updateBubbles = () => {
    // Re-render all text bubbles on settings change
    for (let skin of renderer._allSkins) {
      if (skin && skin.hasOwnProperty("_bubbleType")) skin._textureDirty = true;
    }
  };
  addon.settings.addEventListener("change", updateBubbles);
  addon.self.addEventListener("disabled", updateBubbles);
  addon.self.addEventListener("reenabled", updateBubbles);
}
