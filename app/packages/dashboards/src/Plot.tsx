import { Button } from "@fiftyone/components";
import { executeOperator, OperatorIO, types } from "@fiftyone/operators";
import {
  useOperatorExecutor,
  usePromptOperatorInput,
} from "@fiftyone/operators/src/state";
import { usePanelState } from "@fiftyone/spaces";
import { useEffect, useState } from "react";

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
  const promptForOperator = usePromptOperatorInput();
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
      {panelState.operator && <PlotRenderer {...panelState} />}
      {/* <pre>{JSON.stringify(panelState, null, 2)}</pre> */}
    </div>
  );
}

function PlotRenderer({ operator, to_render, params }) {
  useEffect(() => {
    const onLoad = async () => {
      executeOperator(operator, { panel_id: "plot", ...(params || {}) });
    };

    onLoad();
  }, []);

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
