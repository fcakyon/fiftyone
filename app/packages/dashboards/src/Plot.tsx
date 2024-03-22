import { Button } from "@fiftyone/components";
import { executeOperator, OperatorIO, types } from "@fiftyone/operators";
import {
  useOperatorExecutor,
  usePromptOperatorInput,
} from "@fiftyone/operators/src/state";
import { usePanelState } from "@fiftyone/spaces";
import { useAssertedRecoilValue } from "@fiftyone/state";
import { useEffect, useState } from "react";
import * as fos from "@fiftyone/state";

function createRandomPanelId() {
  return Math.random().toString(36).substring(7);
}

export default function PlotPanel({ dimensions }) {
  const [panelId, setPanelId] = useState();
  useEffect(() => {
    setPanelId(createRandomPanelId());
  }, []);

  if (!panelId) {
    return null;
  }
  return <ActualPlotPanel panelId={panelId} dimensions={dimensions} />;
}

function ActualPlotPanel({ panelId, dimensions }) {
  const forceRerender = () => {
    setPanelState((c) => ({ ...c, r: Math.random() }));
  };
  const onExecute = (ctx, params) => {
    setPanelState((c) => {
      c = c || {};
      return { ...c, params: { ...(c.params || {}), ...params } };
    });
  };
  const promptForOperator = usePromptOperatorInput(onExecute);
  const [panelState, setPanelState] = usePanelState({}, panelId);
  const handleChooseOperator = () => {
    promptForOperator("@voxel51/operators/choose_panel_operator", {
      panelId: panelId,
    });
  };
  const handleConfigure = () => {
    promptForOperator(panelState.operator, {
      panel_id: panelId,
      ...(panelState.params || {}),
    });
  };
  const handleBuildPlot = (plot_type) => () => {
    const op = "@github_username/plugin_name/plotly_plot_operator";
    setPanelState({ operator: op, params: { plot_type } });
    promptForOperator(op, { panel_id: panelId, plot_type: plot_type });
  };
  const needsOperator = !panelState.operator;
  console.log({ dimensions });
  return (
    <div style={{ width: "100%", height: "100%" }}>
      {needsOperator && <Button onClick={handleBuildPlot()}>Build Plot</Button>}
      {needsOperator && (
        <Button onClick={handleBuildPlot("histogram")}>Build Histogram</Button>
      )}
      {needsOperator && (
        <Button onClick={handleChooseOperator}>Choose Custom Operator</Button>
      )}
      {panelState.operator && (
        <Button onClick={handleConfigure}>Configure Panel</Button>
      )}
      {/* <Button onClick={forceRerender}>Force Rerender (For Testing Only)</Button> */}
      {panelState.operator && (
        <PlotRenderer {...panelState} {...dimensions.bounds} />
      )}
      {/* <pre>{JSON.stringify(panelState, null, 2)}</pre> */}
    </div>
  );
}

function PlotRenderer({ operator, to_render, params, height, width }) {
  const view = useAssertedRecoilValue(fos.view);
  const filters = useAssertedRecoilValue(fos.filters);
  // to account for the height of the buttons (should remove)
  height = height - 60;
  useEffect(() => {
    console.log({
      view,
      filters,
      params,
    });
    executeOperator(operator, { panel_id: "plot", ...(params || {}) });
  }, [view, filters]);

  if (to_render) {
    const schema = types.Property.fromJSON(to_render.outputs);
    return (
      <OperatorIO
        schema={{
          ...schema,
          view: {
            ...schema.view,
            componentsProps: {
              gridContainer: {
                item: true,
                spacing: 0,
                sx: { pl: 0 },
                height,
                width,
              },
            },
          },
        }}
        data={to_render.data}
        type="output"
      />
    );
  }
}
