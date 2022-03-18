import { createMachine, EventFrom, ContextFrom } from "xstate";
import { createModel } from 'xstate/lib/model';
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

export const tagsModel = createModel(initialContext, {
  events: {
    'done.invoke.tagsRequest': (data: TagListResponse) => ({ data }),
    'error.platform': (data: ErrorsFrom<TagListResponse>) => ({ data }),
  }
})

export type TagsState =
  | {
    value: "loading";
    context: {
      tags: undefined;
      errors: undefined;
    };
  }
  | {
    value: "tagsLoaded";
    context: {
      tags: string[];
      errors: undefined;
    };
  }
  | {
    value: "errored";
    context: {
      tags: undefined;
      errors: Errors;
    };
  };

export const tagsMachine = createMachine<ContextFrom<typeof tagsModel>, EventFrom<typeof tagsModel>, TagsState>(
  {
    id: "tags",
    initial: "loading",
    context: tagsModel.initialContext,
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
  {
    actions: {
      assignData: tagsModel.assign({
        tags: (_, event) => {
          return event.data.tags;
        }
      }, 'done.invoke.tagsRequest'),
      assignErrors: tagsModel.assign({
        errors: (_, event) => {
          return event.data.errors;
        }
      }, 'error.platform')
    },
    guards: {},
    services: {
      requestTags: () => get<TagListResponse>("tags")
    }
  }
);
