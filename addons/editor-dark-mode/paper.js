import { textColor, multiply, brighten, alphaBlend } from "../../libraries/common/cs/text-color.esm.js";

export default async function ({ addon, console }) {
  const paper = await addon.tab.traps.getPaper();
  const updateColors = () => {
    let artboardBackground;
    let workspaceBackground;
    let checkerboardColor;
    let blueOutlineColor;
    if (!addon.self.disabled) {
      artboardBackground = addon.settings.get("accent");
      workspaceBackground = alphaBlend(
        addon.settings.get("accent"),
        multiply(addon.settings.get("primary"), { a: 0.1 })
      );
      checkerboardColor = alphaBlend(addon.settings.get("accent"), multiply(addon.settings.get("primary"), { a: 0.2 }));
      blueOutlineColor = textColor(
        addon.settings.get("primary"),
        multiply(addon.settings.get("primary"), { r: 0.66, g: 0.76, b: 0.8 }),
        brighten(addon.settings.get("primary"), { r: 0.75, g: 0.75, b: 0.75 }),
        60
      );
    } else {
      artboardBackground = "#ffffff";
      workspaceBackground = "#ecf1f9";
      checkerboardColor = "#d9e3f2";
      blueOutlineColor = "#4280d7";
    }
    for (let layer of paper.project.layers) {
      if (layer.data.isBackgroundGuideLayer) {
        layer.vectorBackground._children[0].fillColor = workspaceBackground;
        layer.vectorBackground._children[1]._children[0].fillColor = artboardBackground;
        layer.vectorBackground._children[1]._children[1].fillColor = checkerboardColor;
        layer.bitmapBackground._children[0].fillColor = artboardBackground;
        layer.bitmapBackground._children[1].fillColor = checkerboardColor;
      } else if (layer.data.isOutlineLayer) {
        layer._children[0].strokeColor = artboardBackground;
        layer._children[1].strokeColor = blueOutlineColor;
      }
    }
  };
  addon.settings.addEventListener("change", updateColors);
  addon.self.addEventListener("disabled", updateColors);
  addon.self.addEventListener("reenabled", updateColors);
  while (true) {
    await addon.tab.waitForElement("[class^=paper-canvas_paper-canvas_]", { markAsSeen: true });
    updateColors();
  }
}
