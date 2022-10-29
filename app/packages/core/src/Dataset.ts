import * as fos from "@fiftyone/state";
import { toCamelCase } from "@fiftyone/utilities";
import { useEffect, useState } from "react";
import { usePreloadedQuery, useQueryLoader } from "react-relay";

import {
  DatasetQuery,
  DatasetQuery$data,
} from "./__generated__/DatasetQuery.graphql";

const DatasetQueryNode = graphql`
  query DatasetQuery(
    $name: String!
    $view: BSONArray = null
    $viewName: String = null
  ) {
    dataset(name: $name, view: $view, viewName: $viewName) {
      id
      name
      mediaType
      defaultGroupSlice
      groupField
      groupMediaTypes {
        name
        mediaType
      }
      appConfig {
        gridMediaField
        mediaFields
        plugins
      }
      sampleFields {
        ftype
        subfield
        embeddedDocType
        path
        dbField
      }
      frameFields {
        ftype
        subfield
        embeddedDocType
        path
        dbField
      }
      maskTargets {
        name
        targets {
          target
          value
        }
      }
      defaultMaskTargets {
        target
        value
      }
      evaluations {
        key
        version
        timestamp
        viewStages
        config {
          cls
          predField
          gtField
        }
      }
      brainMethods {
        key
        version
        timestamp
        viewStages
        config {
          cls
          embeddingsField
          method
          patchesField
        }
      }
      views {
        datasetId
        name
        urlName
        description
        color
        viewStages
      }
      lastLoadedAt
      createdAt
      skeletons {
        name
        labels
        edges
      }
      defaultSkeleton {
        labels
        edges
      }
      version
      viewCls
      viewName
      appConfig {
        mediaFields
        gridMediaField
        plugins
        sidebarGroups {
          name
          paths
        }
      }
    }
  }
`;

export function usePrepareDataset(
  dataset,
  { colorscale, config, state },
  setReady
) {
  const update = fos.useStateUpdate();

  useEffect(() => {
    if (dataset) {
      update(() => {
        return {
          colorscale,
          config: config
            ? (toCamelCase(config) as fos.State.Config)
            : undefined,
          dataset: fos.transformDataset(dataset),
          state,
        };
      });
      setReady(true);
    }
  }, [dataset]);
}
export function usePreLoadedDataset(
  queryRef,
  { colorscale, config, state } = {}
): [DatasetQuery$data["dataset"], boolean] {
  const [ready, setReady] = useState(false);
  const { dataset } = usePreloadedQuery<DatasetQuery>(
    DatasetQueryNode,
    queryRef
  );
  usePrepareDataset(dataset, { colorscale, config, state }, setReady);
  return [dataset, ready];
}
export function useDatasetLoader() {
  const [queryRef, loadQuery] = useQueryLoader(DatasetQueryNode);
  return [
    queryRef,
    (name) => {
      loadQuery({ name });
    },
  ];
}
