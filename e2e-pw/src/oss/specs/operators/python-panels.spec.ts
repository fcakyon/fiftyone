import { test as base, expect } from "src/oss/fixtures";
import { HistogramPom } from "src/oss/poms/panels/histogram-panel";
import { PanelPom } from "src/oss/poms/panels/panel";
import { getUniqueDatasetNameWithPrefix } from "src/oss/utils";

const datasetName = getUniqueDatasetNameWithPrefix(`python_panels`);
const test = base.extend<{ histogram: HistogramPom; panel: PanelPom }>({
  panel: async ({ page }, use) => {
    await use(new PanelPom(page));
  },
});

test.beforeEach(async ({ page, fiftyoneLoader }) => {
  await fiftyoneLoader.waitUntilGridVisible(page, datasetName);
});

test("Python Panels: Markdown", async ({ panel }) => {
  await panel.open("E2E: Markdown panel");
});
