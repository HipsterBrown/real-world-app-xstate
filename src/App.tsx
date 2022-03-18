import * as React from "react";
import { Router, Switch, Redirect, Route, RouteProps } from "react-router-dom";
import { useMachine } from "@xstate/react";
import { inspect } from "@xstate/inspect";
import { history } from "./utils/history";
import { isProd } from "./utils/env";
import { appMachine, UserState, appModel } from "./machines/app.machine";
import type { User } from "./types/api";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Auth } from "./pages/Auth";
import { Editor } from "./pages/Editor";
import { Settings } from "./pages/Settings";
import { Profile } from "./pages/Profile";
import { Article } from "./pages/Article";

if (!isProd()) {
  inspect({
    iframe: false
  });
}

const AuthenticatedRoute: React.FC<
  RouteProps & { isAuthenticated: boolean }
> = ({ isAuthenticated, ...props }) => {
  if (isAuthenticated) {
    return <Route {...props} />;
  }
  return <Redirect to="/" />;
};

export const App: React.FC = () => {
  const [current, send] = useMachine(appMachine, { devTools: !isProd() });

  if (current.context?.auth === null) return null;
  const userState =
    (current.toStrings().find(state => state.includes("user.")) as UserState) ||
    "user.unauthenticated";
  const isAuthenticated = current.matches("user.authenticated");

  return (
    <Router history={history}>
      <Header
        userState={userState || "user.unauthenticated"}
        currentUser={current.context.user}
      />
      <Switch>
        <Route exact={true} path="/">
          <Home isAuthenticated={isAuthenticated} />
        </Route>
        <Route path="/register">
          <Auth authService={current.context.auth} />
        </Route>
        <Route path="/login">
          <Auth key="login" mode="login" authService={current.context.auth} />
        </Route>
        <AuthenticatedRoute
          isAuthenticated={isAuthenticated}
          path="/editor"
          exact={true}
        >
          <Editor />
        </AuthenticatedRoute>
        <AuthenticatedRoute
          isAuthenticated={isAuthenticated}
          path="/editor/:slug"
        >
          <Editor />
        </AuthenticatedRoute>
        <AuthenticatedRoute isAuthenticated={isAuthenticated} path="/settings">
          {current.matches("user.authenticated") && (
            <Settings
              currentUser={current.context.user}
              onLogout={() => send(appModel.events.LOGGED_OUT())}
              onUpdate={(user: User) => send(appModel.events.UPDATE_USER(user))}
            />
          )}
        </AuthenticatedRoute>
        <Route path="/profile/:username" exact={true}>
          <Profile isAuthenticated={isAuthenticated} />
        </Route>
        <Route path="/profile/:username/favorites">
          <Profile isAuthenticated={isAuthenticated} />
        </Route>
        <Route path="/article/:slug">
          <Article
            currentUser={current.context.user}
            isAuthenticated={isAuthenticated}
          />
        </Route>
      </Switch>
      <Footer />
    </Router>
  );
};
