import {
  isElectron,
  isNotebook,
  NotFoundError,
  Resource,
} from "@fiftyone/utilities";
import {
  Action,
  createBrowserHistory,
  createMemoryHistory,
  Location,
} from "history";
import React from "react";
import { loadQuery, PreloadedQuery } from "react-relay";
import {
  ConcreteRequest,
  Environment,
  fetchQuery,
  OperationType,
  VariablesOf,
} from "relay-runtime";

import { Route } from ".";
import { IndexPageQuery } from "../pages/__generated__/IndexPageQuery.graphql";
import { DatasetPageQuery } from "../pages/datasets/__generated__/DatasetPageQuery.graphql";
import { LocationState, matchPath, MatchPathResult } from "./matchPath";
import RouteDefinition from "./RouteDefinition";

export interface RouteData<T extends OperationType> {
  path: string;
  url: string;
  variables: VariablesOf<T>;
}

interface FiftyOneLocation extends Location {
  state: LocationState<OperationType>;
}

export interface Entry<T extends OperationType> extends FiftyOneLocation {
  component: Route<T>;
  concreteRequest: ConcreteRequest;
  preloadedQuery: PreloadedQuery<T>;
  data: T["response"];
  cleanup: () => void;
}

type Subscription = (entry: Entry<OperationType>, action?: Action) => void;

type Subscribe = (
  subscription: Subscription,
  onPending?: () => void
) => () => void;

export interface RoutingContext<T extends OperationType> {
  history: ReturnType<typeof createBrowserHistory>;
  get: () => Entry<T>;
  load: (hard?: boolean) => Promise<Entry<T>>;
  subscribe: Subscribe;
}

export interface Router<T extends OperationType> {
  cleanup: () => void;
  context: RoutingContext<T>;
}

export const createRouter = (
  environment: Environment,
  routes: RouteDefinition<OperationType>[]
): Router<OperationType> => {
  const history =
    isElectron() || isNotebook()
      ? createMemoryHistory()
      : createBrowserHistory();

  let currentEntryResource: Resource<Entry<OperationType>>;

  let nextId = 0;
  const subscribers = new Map<
    number,
    [Subscription, (() => void) | undefined]
  >();

  const update = (location: FiftyOneLocation, action?: Action) => {
    requestAnimationFrame(() =>
      subscribers.forEach(([_, onPending]) => onPending && onPending())
    );
    currentEntryResource.load().then(({ cleanup }) => {
      const nextCurrentEntryResource = getEntryResource(
        environment,
        routes,
        location as FiftyOneLocation
      );
      currentEntryResource = nextCurrentEntryResource;

      currentEntryResource.load().then((entry) => {
        nextCurrentEntryResource === currentEntryResource &&
          requestAnimationFrame(() => {
            subscribers.forEach(([cb]) => cb(entry, action));
            cleanup();
          });
      });
    });
  };

  const cleanup = history.listen(({ location, action }) => {
    if (!currentEntryResource) return;
    update(location as FiftyOneLocation, action);
  });

  const context: RoutingContext<OperationType> = {
    history,

    load(hard = false) {
      const runUpdate = currentEntryResource && hard;
      if (!currentEntryResource || hard) {
        currentEntryResource = getEntryResource(
          environment,
          routes,
          history.location as FiftyOneLocation,
          hard
        );
      }
      runUpdate && update(history.location as FiftyOneLocation);
      return currentEntryResource.load();
    },
    get() {
      if (!currentEntryResource) {
        throw new Error("no entry loaded");
      }
      const entry = currentEntryResource.get();
      if (!entry) {
        throw new Error("entry is loading");
      }
      return entry;
    },
    subscribe(cb, onPending) {
      const id = nextId++;
      const dispose = () => {
        subscribers.delete(id);
      };
      subscribers.set(id, [cb, onPending]);
      return dispose;
    },
  };

  return {
    cleanup: () => cleanup && cleanup(),
    context,
  };
};

const getEntryResource = <T extends OperationType>(
  environment: Environment,
  routes: RouteDefinition<T>[],
  location: FiftyOneLocation,
  hard = false
): Resource<Entry<T>> => {
  let route: RouteDefinition<T>;
  let matchResult: MatchPathResult<T>;
  for (let index = 0; index < routes.length; index++) {
    route = routes[index];
    const match = matchPath<T>(
      location.pathname,
      route,
      location.search,
      location.state
    );

    if (match) {
      matchResult = match;
      break;
    }
  }

  if (matchResult == null) {
    throw new NotFoundError({ path: location.pathname });
  }

  const fetchPolicy = hard ? "network-only" : "store-or-network";

  return new Resource(() => {
    return Promise.all([route.component.load(), route.query.load()]).then(
      ([component, concreteRequest]) => {
        const preloadedQuery = loadQuery(
          environment,
          concreteRequest,
          matchResult.variables || {},
          {
            fetchPolicy,
          }
        );

        let resolveEntry: (entry: Entry<T>) => void;
        let rejectEntry: (reason?: any) => void;
        const promise = new Promise<Entry<T>>((resolve, reject) => {
          resolveEntry = resolve;
          rejectEntry = reject;
        });
        const subscription = fetchQuery(
          environment,
          concreteRequest,
          matchResult.variables || {},
          { fetchPolicy }
        ).subscribe({
          next: (data) => {
            const { state, ...rest } = location;
            resolveEntry({
              state: matchResult.variables as LocationState<T>,
              ...rest,
              component,
              data,
              concreteRequest,
              preloadedQuery,
              cleanup: () => {
                subscription?.unsubscribe();
              },
            });
          },

          error: (error) => rejectEntry(error),
        });

        return promise;
      }
    );
  });
};

export const RouterContext = React.createContext<
  RoutingContext<IndexPageQuery | DatasetPageQuery> | undefined
>(undefined);
