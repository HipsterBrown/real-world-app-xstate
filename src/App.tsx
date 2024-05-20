import * as React from "react";
import { Route, Navigate, createBrowserRouter, RouterProvider, createRoutesFromElements } from "react-router-dom";
import { createActorContext } from "@xstate/react";
import { createBrowserInspector } from "@statelyai/inspect";
import { isProd } from "./utils/env";
import { appMachine } from "./machines/app.machine";
import { Home } from "./pages/Home";
import { Auth } from "./pages/Auth";
import { Editor } from "./pages/Editor";
import { Settings } from "./pages/Settings";
import { Profile } from "./pages/Profile";
import { Article } from "./pages/Article";
import { AppLayout } from "./components/AppLayout";
import { useIsAuthenticated } from "./hooks/is-authenticated";

export const { inspect } = createBrowserInspector();

export const AppMachineContext = createActorContext(appMachine, { inspect: isProd() ? inspect : undefined });
const basename = isProd() ? String(process.env.PUBLIC_URL) : '/';

const AuthenticatedRoute: React.FC<
  { element: React.ReactElement }
> = ({ element }) => {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    return element;
  }
  return <Navigate to="/" replace={true} />;
};

export const appRouter = createBrowserRouter(createRoutesFromElements(
  <Route element={<AppLayout />} >
    <Route path="/" element={<Home />} />
    <Route path="/register" element={<Auth />} />
    <Route path="/login" element={<Auth key="login" mode="login" />} />
    <Route
      path="/editor"
      element={
        <AuthenticatedRoute
          element={<Editor />}
        />
      }
    />
    <Route path="/editor/:slug"
      element={
        <AuthenticatedRoute
          element={<Editor />}
        />
      }
    />
    <Route path="/settings"
      element={
        <AuthenticatedRoute
          element={<Settings />}
        />
      }
    />
    <Route path="/profile/:username" element={<Profile />} />
    <Route path="/profile/:username/favorites" element={<Profile />} />
    <Route path="/article/:slug" element={<Article />} />
  </Route>
), { basename })


export const App: React.FC = () => {
  return (
    <AppMachineContext.Provider>
      <RouterProvider router={appRouter} />
    </AppMachineContext.Provider>
  );
};
