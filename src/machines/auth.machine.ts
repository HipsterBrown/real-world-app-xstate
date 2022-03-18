import { createMachine, sendParent, EventFrom, ContextFrom } from "xstate";
import { history } from "../utils/history";
import { post } from "../utils/api-client";
import type { ErrorsFrom, UserResponse } from "../types/api";
import { createModel } from "xstate/lib/model";

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

export const authModel = createModel(initialContext, {
  events: {
    'submit': (values: FormValues) => values,
    'error.platform': (data: ErrorsFrom<UserResponse>) => ({ data }),
    'done.invoke.signupUser': (data: UserResponse) => ({ data }),
    'done.invoke.loginUser': (data: UserResponse) => ({ data }),
  }
})

export type AuthState =
  | { value: "idle"; context: Nullable<AuthContext> }
  | {
    value: "submitting" | { submitting: "choosing" };
    context: Nullable<AuthContext> & { email: string; password: string };
  }
  | {
    value: { submitting: "signup" };
    context: Nullable<AuthContext> & {
      email: string;
      password: string;
      name: string;
    };
  }
  | {
    value: { submitting: "login" };
    context: Nullable<AuthContext> & { email: string; password: string };
  }
  | {
    value: "authenticated";
    context: Nullable<AuthContext> & {
      email: string;
      password: string;
      name: string | null;
      token: string;
    };
  }
  | {
    value: "failed";
    context: AuthContext & {
      email: string;
      password: string;
      name: string | null;
      errors: Record<string, string[]>;
    };
  };

export const authMachine = createMachine<ContextFrom<typeof authModel>, EventFrom<typeof authModel>, AuthState>(
  {
    id: "auth-request",
    initial: "idle",
    context: authModel.initialContext,
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
                cond: "nameExists",
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
        onEntry: ["saveToken", "navigateHome"]
      },
      failed: {
        onExit: "clearErrors",
        on: {
          submit: {
            target: "submitting",
            actions: "assignFormValues"
          }
        }
      }
    }
  },
  {
    actions: {
      assignFormValues: authModel.assign((context, event) => {
        return {
          ...context,
          name: event.name,
          email: event.email,
          password: event.password
        };
      }, 'submit'),
      assignData: authModel.assign({
        token: (context, event) => {
          if (
            event.type === "done.invoke.loginUser" ||
            event.type === "done.invoke.signupUser"
          ) {
            return event.data.user.token;
          }
          return context.token;
        }
      }),
      assignErrors: authModel.assign({
        errors: (_, event) => {
          return event.data.errors;
        }
      }, 'error.platform'),
      saveToken: context => {
        localStorage.setItem("conduit_token", context.token || "");
      },
      clearErrors: authModel.assign({
        errors: context => {
          if (!!context.errors) return null;
          return context.errors;
        }
      }),
      navigateHome: () => history.push("/"),
      notifyParent: sendParent((_context, event) => {
        if (
          event.type === "done.invoke.loginUser" ||
          event.type === "done.invoke.signupUser"
        ) {
          return {
            type: "LOGGED_IN",
            ...event.data
          };
        }
        return { type: "NEVER" };
      })
    },
    guards: {
      dataExists: (_context, event) => {
        if (
          event.type === "done.invoke.loginUser" ||
          event.type === "done.invoke.signupUser"
        ) {
          return !!event.data.user;
        }
        return false;
      },
      nameExists: context => !!context.name
    },
    services: {
      signupRequest: context =>
        post("users", {
          user: {
            username: context.name,
            email: context.email,
            password: context.password
          }
        }),
      loginRequest: context =>
        post("users/login", {
          user: { email: context.email, password: context.password }
        })
    }
  }
);
