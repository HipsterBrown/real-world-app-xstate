import { assertEvent, assign, setup, fromPromise, ActorRefFrom } from "xstate";
import { authMachine } from "./auth.machine";
import { get } from "../utils/api-client";
import { appRouter } from "../App";
import type { ErrorsFrom, UserResponse, User } from "../types/api";

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

export const appMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as
      | { type: "updateUser", user: User }
      | { type: "logIn", user: User }
      | { type: "xstate.done.actor.userRequest", output: UserResponse }
      | { type: "logOut" }
      | { type: "xstate.error.actor", error: ErrorsFrom<UserResponse> }
  },
  actions: {
    assignUserFromEvent: assign({
      user: ({ event }) => {
        assertEvent(event, ["updateUser", "logIn"])
        return event.user;
      }
    }),
    assignUserData: assign({
      user: ({ event }) => {
        assertEvent(event, "xstate.done.actor.userRequest")
        return event.output.user;
      }
    }),
    createAuthMachine: assign({
      auth: ({ spawn }) => spawn(authMachine) as ActorRefFrom<typeof authMachine>
    }),
    goHome: () => appRouter.navigate('/'),
    resetToken: () => localStorage.removeItem("conduit_token"),
    resetUserData: assign({ user: undefined })
  },
  guards: {
    userExists: ({ context }) => !!context.user,
    tokenAvailable: () => localStorage.getItem("conduit_token") !== null
  },
  actors: {
    requestUser: fromPromise(() => get<UserResponse>("user"))
  }
}).createMachine(
  {
    id: "app",
    type: "parallel",
    context: initialContext,
    states: {
      user: {
        entry: "createAuthMachine",
        initial: "unauthenticated",
        states: {
          unauthenticated: {
            always: [
              {
                guard: "userExists",
                target: "#app.user.authenticated"
              },
              {
                guard: "tokenAvailable",
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
  }
);
