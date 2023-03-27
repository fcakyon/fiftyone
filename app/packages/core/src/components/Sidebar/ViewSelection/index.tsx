import { Selection } from "@fiftyone/components";
import {
  savedViewsFragment,
  savedViewsFragment$key,
  savedViewsFragmentQuery,
} from "@fiftyone/relay";
import * as fos from "@fiftyone/state";
import React, { Suspense, useContext, useEffect, useMemo } from "react";
import { useRefetchableFragment } from "react-relay";
import {
  atom,
  useRecoilState,
  useRecoilValue,
  useResetRecoilState,
  useSetRecoilState,
} from "recoil";
import { shouldToggleBookMarkIconOnSelector } from "../../Actions/ActionsRow";
import { AddIcon, Box, LastOption, TextContainer } from "./styledComponents";
import ViewDialog, { viewDialogContent } from "./ViewDialog";

export const datasetQueryContext = React.createContext<
  savedViewsFragment$key | undefined
>(undefined);

export const viewSearchTerm = atom<string>({
  key: "viewSearchTerm",
  default: "",
});
export const viewDialogOpen = atom<boolean>({
  key: "viewDialogOpen",
  default: false,
});

export interface DatasetView {
  id: string;
  name: string;
  slug: string;
  datasetId: string;
  color: string | null;
  description: string | null;
  viewStages: readonly string[];
}

export default function ViewSelection() {
  const [selected, setSelected] = useRecoilState<fos.DatasetViewOption | null>(
    fos.selectedSavedViewState
  );
  const datasetName = useRecoilValue(fos.datasetName);
  const canEditSavedViews = useRecoilValue<boolean>(fos.canEditSavedViews);
  const setIsOpen = useSetRecoilState<boolean>(viewDialogOpen);
  const [savedViewParam, setViewName] = useRecoilState(fos.viewName);
  const setEditView = useSetRecoilState(viewDialogContent);
  const resetView = useResetRecoilState(fos.view);
  const [viewSearch, setViewSearch] = useRecoilState<string>(viewSearchTerm);
  const fragmentRef = useContext(datasetQueryContext);

  if (!fragmentRef) throw new Error("ref not defined");

  const [data, refetch] = useRefetchableFragment<
    savedViewsFragmentQuery,
    savedViewsFragment$key
  >(savedViewsFragment, fragmentRef);

  const items = useMemo(() => data.savedViews || [], [data]);

  const viewOptions = useMemo(
    () => [
      fos.DEFAULT_SELECTED,
      ...items.map(({ id, name, color, description, slug, viewStages }) => ({
        id,
        name,
        label: name,
        color,
        slug,
        description,
        viewStages,
      })),
    ],
    [items]
  );

  const searchData = useMemo(
    () =>
      viewOptions.filter(
        ({ id, label, description, slug }) =>
          id === fos.DEFAULT_SELECTED.id ||
          label?.toLowerCase().includes(viewSearch) ||
          description?.toLowerCase().includes(viewSearch) ||
          slug?.toLowerCase().includes(viewSearch)
      ),
    [viewOptions, viewSearch]
  );

  useEffect(() => {
    if (
      selected &&
      selected?.id !== fos.DEFAULT_SELECTED.id &&
      searchData?.length
    ) {
      const potentialView = searchData.filter(
        (v) => v.slug === selected.slug
      )?.[0];
      if (potentialView) {
        setSelected(potentialView as fos.DatasetViewOption);
      }
    }
  }, [searchData, selected]);

  const loadedView = useRecoilValue(fos.view);
  const bookmarkIconOn = useRecoilValue(shouldToggleBookMarkIconOnSelector);
  const isEmptyView = !bookmarkIconOn && !loadedView?.length;

  useEffect(() => {
    if (savedViewParam) {
      const potentialView = viewOptions.filter(
        (v) => v.label === savedViewParam
      )?.[0];
      if (potentialView) {
        if (selected && selected.id === potentialView.id) {
          return;
        }
        setSelected(potentialView as fos.DatasetViewOption);
      } else {
        const potentialUpdatedView = items.filter(
          (v) => v.name === savedViewParam
        )?.[0];
        if (potentialUpdatedView) {
          refetch(
            { name: datasetName },
            {
              fetchPolicy: "network-only",
              onComplete: () => {
                setSelected({
                  ...potentialUpdatedView,
                  label: potentialUpdatedView.name,
                  slug: potentialUpdatedView.slug,
                });
              },
            }
          );
        } else {
          // bad/old view param
          setSelected(fos.DEFAULT_SELECTED);
        }
      }
    } else {
      // no view param
      if (selected && selected.slug !== fos.DEFAULT_SELECTED.slug) {
        setSelected(fos.DEFAULT_SELECTED);
        // do not reset view to [] again. The viewbar sets it once.
      }
    }
  }, [savedViewParam]);

  useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      if (!canEditSavedViews) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyS") {
        event.preventDefault();
        if (!isEmptyView) {
          setIsOpen(true);
        }
      }
    };

    document.addEventListener("keydown", callback);
    return () => {
      document.removeEventListener("keydown", callback);
    };
  }, [isEmptyView, canEditSavedViews]);

  return (
    <Suspense fallback="Loading saved views...">
      <Box>
        <ViewDialog
          canEdit={canEditSavedViews}
          savedViews={items}
          onEditSuccess={(
            createSavedView: fos.State.SavedView,
            reload?: boolean
          ) => {
            refetch(
              { name: datasetName },
              {
                fetchPolicy: "network-only",
                onComplete: (newOptions) => {
                  if (createSavedView && reload) {
                    setViewName(createSavedView.slug);
                    setSelected({
                      ...createSavedView,
                      label: createSavedView.name,
                    });
                  }
                },
              }
            );
          }}
          onDeleteSuccess={(deletedSavedViewName: string) => {
            refetch(
              { name: datasetName },
              {
                fetchPolicy: "network-only",
                onComplete: () => {
                  if (selected?.label === deletedSavedViewName) {
                    resetView();
                  }
                },
              }
            );
          }}
        />
        <Selection
          readonly={!canEditSavedViews}
          selected={selected}
          setSelected={(item: fos.DatasetViewOption) => {
            setSelected(item);
            setViewName(item.slug);
          }}
          onClear={() => {
            setSelected(fos.DEFAULT_SELECTED);
            resetView();
          }}
          items={searchData}
          onEdit={(item) => {
            setEditView({
              color: item.color || "",
              description: item.description || "",
              isCreating: false,
              name: item.label,
            });
            setIsOpen(true);
          }}
          search={{
            value: viewSearch,
            placeholder: "Search views...",
            onSearch: (term: string) => {
              setViewSearch(term);
            },
          }}
          lastFixedOption={
            <LastOption
              onClick={() =>
                canEditSavedViews && !isEmptyView && setIsOpen(true)
              }
              disabled={isEmptyView || !canEditSavedViews}
            >
              <Box style={{ width: "12%" }}>
                <AddIcon fontSize="small" disabled={isEmptyView} />
              </Box>
              <TextContainer disabled={isEmptyView}>
                Save current filters as view
              </TextContainer>
            </LastOption>
          }
        />
      </Box>
    </Suspense>
  );
}
