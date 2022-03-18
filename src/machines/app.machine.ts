import { createMachine, spawn, ActorRefFrom, EventFrom, ContextFrom } from "xstate";
import { authMachine } from "./auth.machine";
import { get } from "../utils/api-client";
import { history } from "../utils/history";
import type { ErrorsFrom, UserResponse, User } from "../types/api";
import { createModel } from "xstate/lib/model";

export type UserState =
  | "user.unauthenticated"
  | "user.authenticating"
  | "user.authenticated";

type AppContext = {
  auth: ActorRefFrom<typeof authMachine> | null;
  user?: User;
};

const initialContext: AppContext = {
  auth: null,
};

export const appModel = createModel(initialContext, {
  events: {
    'logIn': (user: User) => ({ user }),
    'updateUser': (user: User) => ({ user }),
    'done.invoke.userRequest': (data: UserResponse) => ({ data }),
    'logOut': () => ({}),
    'error.platform': (data: ErrorsFrom<UserResponse>) => ({ data }),
  }
})

export type AppState =
  | {
    value: "user";
    context: {
      auth: ActorRefFrom<typeof authMachine>;
      user?: User;
    };
  }
  | {
    value: "user.unauthenticated";
    context: {
      auth: ActorRefFrom<typeof authMachine>;
      user: undefined;
    };
  }
  | {
    value: "user.authenticating";
    context: {
      auth: ActorRefFrom<typeof authMachine>;
      user: undefined;
    };
  }
  | {
    value: "user.authenticated";
    context: {
      auth: ActorRefFrom<typeof authMachine>;
      user: User;
    };
  };

export const appMachine = createMachine<ContextFrom<typeof appModel>, EventFrom<typeof appModel>, AppState>(
  {
    id: "app",
    type: "parallel",
    context: appModel.initialContext,
    states: {
      user: {
        onEntry: "createAuthMachine",
        initial: "unauthenticated",
        states: {
          unauthenticated: {
            always: [
              {
                cond: "userExists",
                target: "#app.user.authenticated"
              },
              {
                cond: "tokenAvailable",
                target: "#app.user.authenticating"
              }
            ]
          },
          authenticating: {
            invoke: {
              id: "userRequest",
              src: "requestUser",
              onDone: {
                target: "#app.user.authenticated",
                actions: "assignUserData"
              },
              onError: "#app.user.unauthenticated"
            }
          },
          authenticated: {
            on: {
              logOut: {
                actions: ["resetUserData", "resetToken", "goHome"],
                target: "#app.user.unauthenticated"
              }
            }
          }
        },
        on: {
          logIn: {
            target: ".authenticated",
            actions: "assignUserFromEvent"
          },
          updateUser: {
            actions: "assignUserFromEvent"
          }
        }
      }
    }
  },
  {
    actions: {
      assignUserFromEvent: appModel.assign({
        user: (context, event) => {
          if (event.type === "updateUser" || event.type === "logIn") {
            return event.user;
          }
          return context.user;
        }
      }),
      assignUserData: appModel.assign({
        user: (_, event) => {
          return event.data.user;
        }
      }, 'done.invoke.userRequest'),
      createAuthMachine: appModel.assign({
        auth: () => spawn(authMachine) as ActorRefFrom<typeof authMachine>
      }),
      goHome: () => history.push("/"),
      resetToken: () => localStorage.removeItem("conduit_token"),
      resetUserData: appModel.assign({ user: undefined })
    },
    guards: {
      userExists: context => !!context.user,
      tokenAvailable: () => localStorage.getItem("conduit_token") !== null
    },
    services: {
      requestUser: () => get<UserResponse>("user")
    }
  }
);
