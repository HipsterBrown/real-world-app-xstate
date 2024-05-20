import { setup, assign, assertEvent, fromPromise } from "xstate";
import { appRouter } from "../App";
import { put } from "../utils/api-client";
import type { User, UserResponse, Errors, ErrorsFrom } from "../types/api";

type SettingsContext = {
  user: User | null;
  errors: Errors | null;
}

const initialContext: SettingsContext = {
  user: null,
  errors: null,
}

export const settingsMachine = setup({
  types: {
    context: {} as SettingsContext,
    events: {} as
      | { type: 'submit', values: User }
      | { type: 'xstate.done.actor.updateUser', output: UserResponse }
      | { type: 'xstate.error.actor.updateUser', error: ErrorsFrom<UserResponse> }
  },
  actions: {
    assignFormValues: assign({
      user: ({ event }) => {
        assertEvent(event, 'submit');
        return event.values;
      }
    }),
    assignData: assign({
      user: ({ event }) => {
        assertEvent(event, 'xstate.done.actor.updateUser');
        return event.output.user;
      }
    }),
    assignErrors: assign({
      errors: ({ event }) => {
        assertEvent(event, 'xstate.error.actor.updateUser');
        return event.error.errors;
      }
    }),
    goToProfile: ({ context }) =>
      appRouter.navigate(`/profile/${context.user?.username}`),
    clearErrors: assign({ errors: null }),
    updateParent: () => { throw new Error('updateParent must be provided when creating machine actor') }
  },
  actors: {
    userRequest: fromPromise(({ input }: { input: Pick<SettingsContext, 'user'> }) =>
      put<UserResponse, { user: User | null }>("user", { user: input.user }))
  }
}).createMachine(
  {
    id: "settings-request",
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
        invoke: {
          id: "updateUser",
          src: "userRequest",
          input: ({ context }) => ({ user: context.user }),
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
);
