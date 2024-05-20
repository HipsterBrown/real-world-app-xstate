import { setup, assign, assertEvent, fromPromise } from "xstate";
import { get, post, put } from "../utils/api-client";
import { appRouter } from "../App";
import type { ArticleResponse, Article, Errors, ErrorsFrom } from "../types/api";

export type FormValues = Pick<
  Article,
  "title" | "description" | "body" | "tagList"
>;

type EditorContext = {
  article?: Article;
  errors?: Errors;
  formValues?: FormValues;
  slug?: string;
};

const initialContext: EditorContext = {};

export const editorMachine = setup({
  types: {
    context: {} as EditorContext,
    events: {} as
      | { type: 'xstate.done.actor.articleRequest', output: ArticleResponse }
      | { type: 'xstate.done.actor.getArticle', output: ArticleResponse }
      | { type: 'xstate.error.actor', error: ErrorsFrom<ArticleResponse> }
      | { type: 'submit', values: FormValues },
    input: {} as {
      slug?: string,
    }
  },
  actions: {
    assignArticleValues: assign({
      article: ({ event }) => {
        assertEvent(event, 'xstate.done.actor.getArticle')
        return event.output.article;
      },
      formValues: ({ event }) => {
        assertEvent(event, 'xstate.done.actor.getArticle')
        return {
          title: event.output.article.title,
          description: event.output.article.description,
          body: event.output.article.body,
          tagList: event.output.article.tagList
        };
      }
    }),
    assignData: assign({
      article: ({ event }) => {
        assertEvent(event, 'xstate.done.actor.articleRequest')
        return event.output.article;
      }
    }),
    assignErrors: assign({
      errors: ({ event }) => {
        assertEvent(event, 'xstate.error.actor');
        return event.error.errors;
      }
    }),
    assignValues: assign({
      formValues: ({ event }) => {
        assertEvent(event, 'submit');
        return event.values;
      }
    }),
    goToArticle: ({ context }) => appRouter.navigate(`/article/${context.article?.slug}`)
  },
  guards: {
    slugExists: ({ context }) => !!context.slug
  },
  actors: {
    createArticle: fromPromise(async ({ input }: { input: { formValues?: FormValues } }) => {
      if (input.formValues) {
        return await post<ArticleResponse, { article: FormValues }>("articles", {
          article: input.formValues
        });
      }
      return Promise.reject();
    }),
    getArticle: fromPromise(async ({ input }: { input: { slug?: string } }) => {
      if (input.slug) {
        return await get<ArticleResponse>(`articles/${input.slug}`);
      }
      return Promise.reject();
    }),
    updateArticle: fromPromise(async ({ input }: { input: { formValues?: FormValues, slug?: string } }) => {
      if (input.formValues && input.slug) {
        return await put<ArticleResponse, { article: FormValues }>(
          `articles/${input.slug}`,
          {
            article: input.formValues
          }
        );
      }
      return Promise.reject();
    })
  }
}).createMachine(
  {
    id: "editor",
    initial: "idle",
    context: ({ input }) => ({
      ...initialContext,
      ...input
    }),
    states: {
      idle: {
        initial: "choosing",
        states: {
          choosing: {
            always: [
              {
                target: "updating",
                guard: "slugExists"
              },
              {
                target: "creating"
              }
            ]
          },
          creating: {
            on: {
              submit: {
                target: "#editor.submitting.creating",
                actions: "assignValues"
              }
            }
          },
          updating: {
            invoke: {
              id: "getArticle",
              src: "getArticle",
              input: ({ context }) => ({ slug: context.slug }),
              onDone: {
                actions: "assignArticleValues"
              }
            },
            on: {
              submit: {
                target: "#editor.submitting.updating",
                actions: "assignValues"
              }
            }
          }
        }
      },
      submitting: {
        initial: 'creating',
        states: {
          creating: {
            invoke: {
              id: "articleRequest",
              src: "createArticle",
              input: ({ context }) => ({ formValues: context.formValues }),
              onDone: {
                target: "#success",
                actions: "assignData"
              }
            }
          },
          updating: {
            invoke: {
              id: "articleRequest",
              src: "updateArticle",
              input: ({ context }) => ({ formValues: context.formValues, slug: context.slug }),
              onDone: {
                target: "#success",
                actions: "assignData"
              }
            }
          }
        },
        on: {
          "xstate.error.actor": {
            target: "#errored",
            actions: "assignErrors"
          }
        }
      },
      success: {
        id: "success",
        entry: "goToArticle"
      },
      errored: {
        id: "errored",
        on: {
          submit: {
            target: "submitting",
            actions: "assignValues"
          }
        }
      }
    }
  },
);
