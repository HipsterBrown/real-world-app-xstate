import { setup, assign, assertEvent, sendParent, fromPromise } from "xstate";
import { appRouter } from "../App";
import { post } from "../utils/api-client";
import type { ErrorsFrom, UserResponse } from "../types/api";

type Nullable<T> = Record<keyof T, null>;

export type FormValues = {
  name?: string;
  email: string;
  password: string;
}

export type AuthContext = {
  name: string | null;
  email: string | null;
  password: string | null;
  errors: Record<string, string[]> | null;
  token: string | null;
};

const initialContext: AuthContext = {
  name: null,
  email: null,
  password: null,
  errors: null,
  token: null,
};

export const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as
      | FormValues & { type: "submit" }
      | { type: "xstate.error.actor.loginUser", error: ErrorsFrom<UserResponse> }
      | { type: "xstate.error.actor.signupUser", error: ErrorsFrom<UserResponse> }
      | { type: "xstate.done.actor.signupUser", output: UserResponse }
      | { type: "xstate.done.actor.loginUser", output: UserResponse }
  },
  actions: {
    assignFormValues: assign(({ context, event }) => {
      assertEvent(event, "submit")
      return {
        ...context,
        name: event.name,
        email: event.email,
        password: event.password
      };
    }),
    assignData: assign({
      token: ({ context, event }) => {
        if (
          event.type === "xstate.done.actor.loginUser" ||
          event.type === "xstate.done.actor.signupUser"
        ) {
          return event.output.user.token;
        }
        return context.token;
      }
    }),
    assignErrors: assign({
      errors: ({ event }) => {
        assertEvent(event, ["xstate.error.actor.signupUser", "xstate.error.actor.loginUser"])
        return event.error.errors;
      }
    }),
    saveToken: ({ context }) => {
      localStorage.setItem("conduit_token", context.token || "");
    },
    clearErrors: assign({
      errors: ({ context }) => {
        if (!!context.errors) return null;
        return context.errors;
      }
    }),
    navigateHome: () => appRouter.navigate("/"),
    notifyParent: sendParent(({ event }) => {
      if (
        event.type === "xstate.done.actor.loginUser" ||
        event.type === "xstate.done.actor.signupUser"
      ) {
        return {
          type: "LOGGED_IN",
          ...event.output
        };
      }
      return { type: "NEVER" };
    })
  },
  guards: {
    dataExists: ({ event }) => {
      if (
        event.type === "xstate.done.actor.loginUser" ||
        event.type === "xstate.done.actor.signupUser"
      ) {
        return !!event.output.user;
      }
      return false;
    },
    nameExists: ({ context }) => !!context.name
  },
  actors: {
    signupRequest: fromPromise(async ({ input }: { input: FormValues }) =>
      await post("users", {
        user: {
          username: input.name,
          email: input.email,
          password: input.password
        }
      })),
    loginRequest: fromPromise(async ({ input }: { input: Pick<FormValues, 'email' | 'password'> }) =>
      await post("users/login", {
        user: { email: input.email, password: input.password }
      }))
  }
}).createMachine(
  {
    id: "auth-request",
    initial: "idle",
    context: initialContext,
    states: {
      idle: {
        on: {
          submit: {
            target: "submitting",
            actions: "assignFormValues"
          }
        }
      },
      submitting: {
        initial: "choosing",
        states: {
          choosing: {
            always: [
              {
                guard: "nameExists",
                target: "signup"
              },
              {
                target: "login"
              }
            ]
          },
          signup: {
            invoke: {
              id: "signupUser",
              src: "signupRequest",
              input: ({ context }) => ({
                email: context.email || '',
                name: context.name || '',
                password: context.password || '',
              }),
              onDone: {
                target: "#auth-request.authenticated",
                actions: ["notifyParent", "assignData"]
              },
              onError: {
                target: "#auth-request.failed",
                actions: "assignErrors"
              }
            }
          },
          login: {
            invoke: {
              id: "loginUser",
              src: "loginRequest",
              input: ({ context }) => ({
                email: context.email || '',
                password: context.password || '',
              }),
              onDone: {
                target: "#auth-request.authenticated",
                actions: ["notifyParent", "assignData"]
              },
              onError: {
                target: "#auth-request.failed",
                actions: "assignErrors"
              }
            }
          }
        }
      },
      authenticated: {
        entry: ["saveToken", "navigateHome"]
      },
      failed: {
        exit: "clearErrors",
        on: {
          submit: {
            target: "submitting",
            actions: "assignFormValues"
          }
        }
      }
    }
  }
);
