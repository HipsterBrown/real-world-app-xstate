import { createMachine, ContextFrom, EventFrom } from "xstate";
import { createModel } from 'xstate/lib/model'
import { history } from "../utils/history";
import { put } from "../utils/api-client";
import type { User, UserResponse, Errors, ErrorsFrom } from "../types/api";

type SettingsState = {
  value: 'idle';
  context: {
    user: null;
    errors: null;
  }
} | {
  value: 'submitting';
  context: {
    user: null;
    errors: null;
  };
} | {
  value: 'success';
  context: {
    user: User;
    errors: null;
  };
} | {
  value: 'failed';
  context: {
    user: null;
    errors: Errors;
  };
}

export const settingsModel = createModel({
  user: null as User | null,
  errors: null as Errors | null,
}, {
  events: {
    submit: (values: User) => ({ values }),
    'done.invoke.updateUser': (data: UserResponse) => ({ data }),
    'error.platform.updateUser': (data: ErrorsFrom<UserResponse>) => ({ data })
  }
})

export const settingsMachine = createMachine<ContextFrom<typeof settingsModel>, EventFrom<typeof settingsModel>, SettingsState>(
  {
    id: "settings-request",
    initial: "idle",
    context: settingsModel.initialContext,
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
        invoke: {
          id: "updateUser",
          src: "userRequest",
          onDone: {
            target: "success",
            actions: "assignData"
          },
          onError: {
            target: "failed",
            actions: "assignErrors"
          }
        }
      },
      success: {
        entry: ["updateParent", "goToProfile"]
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
  },
  {
    actions: {
      assignFormValues: settingsModel.assign({
        user: (_, event) => event.values,
      }, 'submit'),
      assignData: settingsModel.assign({
        user: (_, event) => event.data.user,
      }, 'done.invoke.updateUser'),
      assignErrors: settingsModel.assign({
        errors: (_, event) => event.data.errors,
      }, 'error.platform.updateUser'),
      goToProfile: context =>
        history.push(`/profile/${context.user?.username}`),
      clearErrors: settingsModel.assign({ errors: null })
    },
    services: {
      userRequest: ({ user }) =>
        put<UserResponse, { user: User | null }>("user", { user })
    }
  }
);
