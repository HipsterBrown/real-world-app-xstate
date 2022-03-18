import { createMachine, EventFrom, ContextFrom } from "xstate";
import { createModel } from 'xstate/lib/model';
import { get, post, put } from "../utils/api-client";
import { history } from "../utils/history";
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

export const editorModel = createModel(initialContext, {
  events: {
    'done.invoke.articleRequest': (data: ArticleResponse) => ({ data }),
    'done.invoke.getArticle': (data: ArticleResponse) => ({ data }),
    'error.platform': (data: ErrorsFrom<ArticleResponse>) => ({ data }),
    'submit': (values: FormValues) => ({ values }),
  }
})

type EditorState =
  | {
    value: "idle" | { idle: "creating" };
    context: {
      article: undefined;
      errors: undefined;
      formValues: undefined;
    };
  }
  | {
    value: { idle: "updating" };
    context: EditorContext & {
      article: Article;
      formValues: FormValues;
      slug: string;
    };
  }
  | {
    value: "submitting" | { submitting: "creating" };
    context: EditorContext & {
      formValues: FormValues;
    };
  }
  | {
    value: { submitting: "updating" };
    context: EditorContext & {
      article: Article;
      formValues: FormValues;
      slug: string;
    };
  }
  | {
    value: "success";
    context: EditorContext & {
      article: Article;
      formValues: FormValues;
    };
  }
  | {
    value: "errored";
    context: EditorContext & {
      errors: Errors;
      formValues: FormValues;
    };
  };

export const editorMachine = createMachine<
  ContextFrom<typeof editorModel>,
  EventFrom<typeof editorModel>,
  EditorState
>(
  {
    id: "editor",
    initial: "idle",
    context: editorModel.initialContext,
    states: {
      idle: {
        initial: "choosing",
        states: {
          choosing: {
            always: [
              {
                target: "updating",
                cond: "slugExists"
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
        states: {
          creating: {
            invoke: {
              id: "articleRequest",
              src: "createArticle",
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
              onDone: {
                target: "#success",
                actions: "assignData"
              }
            }
          }
        },
        on: {
          "error.platform": {
            target: "#errored",
            actions: "assignErrors"
          }
        }
      },
      success: {
        id: "success",
        onEntry: "goToArticle"
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
  {
    actions: {
      assignArticleValues: editorModel.assign({
        article: (_, event) => {
          return event.data.article;
        },
        formValues: (_, event) => {
          return {
            title: event.data.article.title,
            description: event.data.article.description,
            body: event.data.article.body,
            tagList: event.data.article.tagList
          };
        }
      }, 'done.invoke.getArticle'),
      assignData: editorModel.assign({
        article: (_, event) => {
          return event.data.article;
        }
      }, 'done.invoke.articleRequest'),
      assignErrors: editorModel.assign({
        errors: (_, event) => {
          return event.data.errors;
        }
      }, 'error.platform'),
      assignValues: editorModel.assign({
        formValues: (_, event) => {
          return event.values;
        }
      }, 'submit'),
      goToArticle: context => history.push(`/article/${context.article?.slug}`)
    },
    guards: {
      slugExists: context => !!context.slug
    },
    services: {
      createArticle: context => {
        if (context.formValues) {
          return post<ArticleResponse, { article: FormValues }>("articles", {
            article: context.formValues
          });
        }
        return Promise.reject();
      },
      getArticle: context => {
        if (context.slug) {
          return get<ArticleResponse>(`articles/${context.slug}`);
        }
        return Promise.reject();
      },
      updateArticle: context => {
        if (context.formValues && context.slug) {
          return put<ArticleResponse, { article: FormValues }>(
            `articles/${context.slug}`,
            {
              article: context.formValues
            }
          );
        }
        return Promise.reject();
      }
    }
  }
);
