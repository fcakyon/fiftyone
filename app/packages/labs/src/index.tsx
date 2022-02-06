import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { ErrorBoundary } from "react-error-boundary";
import { RelayEnvironmentProvider } from "react-relay/hooks";
import { RecoilRoot } from "recoil";
import { ThemeProvider as LegacyThemeContext } from "styled-components";

import Loading from "@fiftyone/app/src/components/Loading";
import Error from "@fiftyone/app/src/containers/Error";

import "./index.css";

import { getRelayEnvironment } from "./RelayEnvironment";
import Login from "./Login";
import { ThemeContext, useTheme } from "./Theme";

const Environment = () => {
  const auth0 = useAuth0();

  useEffect(() => {
    if (!auth0.isAuthenticated && !auth0.isLoading && !auth0.error) {
      auth0.loginWithRedirect({
        redirectUri: window.location.href,
        prompt: "login",
      });
    }
  }, [auth0.isAuthenticated, auth0.isLoading, auth0.error]);

  if (auth0.error || (!auth0.isAuthenticated && !auth0.isLoading)) {
    return (
      <Loading
        text={"Unauthorized"}
        onClick={() => auth0.logout({ federated: true })}
      />
    );
  }

  if (auth0.isLoading) {
    return <Loading text={"Pixelating..."} />;
  }

  return (
    <ErrorBoundary FallbackComponent={Error}>
      <RelayEnvironmentProvider environment={getRelayEnvironment(auth0)}>
        <Login />
      </RelayEnvironmentProvider>
    </ErrorBoundary>
  );
};

const App = () => {
  const theme = useTheme();

  return (
    <LegacyThemeContext theme={theme}>
      <ThemeContext>
        <Environment />
      </ThemeContext>
    </LegacyThemeContext>
  );
};

const Root = () => {
  return (
    <RecoilRoot>
      <Auth0Provider
        audience="api.dev.fiftyone.ai"
        clientId="pJWJhgTswZu2rF0OUOdEC5QZdNtqsUIE"
        domain="dev-uqppzklh.us.auth0.com"
        redirectUri={window.location.origin}
        organization={"org_wtMMZE61j2gnmxsm"}
      >
        <App />
      </Auth0Provider>
    </RecoilRoot>
  );
};

document.addEventListener("DOMContentLoaded", () =>
  ReactDOM.render(<Root />, document.getElementById("root"))
);
