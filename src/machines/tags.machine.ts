import { assign, assertEvent, setup, fromPromise } from "xstate";
import { get } from "../utils/api-client";
import type { TagListResponse, Errors, ErrorsFrom } from "../types/api";

export type TagsContext = {
  tags?: string[];
  errors?: Errors;
};

const initialContext: TagsContext = {
  tags: undefined,
  errors: undefined,
}

export const tagsMachine = setup({
  types: {
    context: {} as TagsContext,
    events: {} as
      | { type: 'xstate.done.actor.tagsRequest', output: TagListResponse }
      | { type: 'xstate.error.actor', error: ErrorsFrom<TagListResponse> }
  },
  actions: {
    assignData: assign({
      tags: ({ event }) => {
        assertEvent(event, 'xstate.done.actor.tagsRequest');
        return event.output.tags;
      }
    }),
    assignErrors: assign({
      errors: ({ event }) => {
        assertEvent(event, 'xstate.error.actor')
        return event.error.errors;
      }
    })
  },
  guards: {},
  actors: {
    requestTags: fromPromise(() => get<TagListResponse>("tags"))
  }
}).createMachine(
  {
    id: "tags",
    initial: "loading",
    context: initialContext,
    states: {
      loading: {
        invoke: {
          id: "tagsRequest",
          src: "requestTags",
          onDone: {
            target: "tagsLoaded",
            actions: "assignData"
          },
          onError: {
            target: "errored",
            actions: "assignErrors"
          }
        }
      },
      tagsLoaded: {},
      errored: {}
    }
  },
);
