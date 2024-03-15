import { registerComponent, PluginComponentType } from "@fiftyone/plugins";
import PlotPanel from "./Plot";

export { default as Dashboard } from "./Plot";

registerComponent({
  name: "plot",
  label: "Plot",
  component: PlotPanel,
  type: PluginComponentType.Panel,
  activator: () => true,
  Icon: null,
  panelOptions: {
    allowDuplicates: true,
  },
});
