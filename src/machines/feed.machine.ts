import {
  createMachine,
  actions,
  spawn,
  ActorRef,
  EventObject,
  EventFrom,
  ContextFrom,
} from "xstate";
import { createModel } from 'xstate/lib/model';
import { get, del, post } from "../utils/api-client";
import { history } from "../utils/history";
import type {
  Article,
  ArticleListResponse,
  ArticleResponse,
  Errors,
  ErrorsFrom
} from "../types/api";

const { choose } = actions;

type FeedContext = {
  articles?: Article[];
  articlesCount?: number;
  errors?: Errors;
  params: {
    limit: number;
    offset: number;
    feed?: string;
    author?: string;
    tag?: string;
    favorited?: string;
  };
  favoriteRef?: ActorRef<EventObject>;
};

const initialContext: FeedContext = {
  articles: undefined,
  articlesCount: undefined,
  errors: undefined,
  params: {
    limit: 20,
    offset: 0
  }
}

export const feedModel = createModel(initialContext, {
  events: {
    'done.invoke.getFeed': (data: ArticleListResponse) => ({ data }),
    'done.invoke.favoriting': (data: ArticleResponse) => ({ data }),
    'error.platform': (data: ErrorsFrom<ArticleResponse | ArticleListResponse>) => ({ data }),
    'retry': () => ({}),
    'refresh': () => ({}),
    'updateFeed': (params: FeedContext['params']) => params,
    'toggleFavorite': (slug: string) => ({ slug }),
  }
})

type FeedState =
  | {
    value: "loading";
    context: FeedContext & {
      articles: undefined;
      articlesCount: undefined;
      errors: undefined;
    };
  }
  | {
    value: "feedLoaded";
    context: FeedContext & {
      articles: Article[] | [];
      articlesCount: number;
      errors: undefined;
    };
  }
  | {
    value: { feedLoaded: "articlesAvailable" };
    context: FeedContext & {
      articles: Article[];
      articlesCount: number;
      errors: undefined;
    };
  }
  | {
    value: { feedLoaded: "noArticles" };
    context: FeedContext & {
      articles: [];
      articlesCount: 0;
      errors: undefined;
    };
  }
  | {
    value: "failedLoadingFeed";
    context: FeedContext & {
      articles: undefined;
      articlesCount: undefined;
      errors: Errors;
    };
  };

export const feedMachine = createMachine<ContextFrom<typeof feedModel>, EventFrom<typeof feedModel>, FeedState>(
  {
    id: "feed-loader",
    initial: "loading",
    context: feedModel.initialContext,
    states: {
      loading: {
        invoke: {
          id: "getFeed",
          src: "feedRequest",
          onDone: {
            target: "feedLoaded",
            actions: "assignData"
          },
          onError: {
            target: "failedLoadingFeed",
            actions: "assignErrors"
          }
        }
      },
      feedLoaded: {
        initial: "pending",
        states: {
          pending: {
            always: [
              {
                target: "noArticles",
                cond: "dataIsEmpty"
              },
              {
                target: "articlesAvailable"
              }
            ]
          },
          noArticles: {},
          articlesAvailable: {}
        },
        on: {
          refresh: "loading",
          updateFeed: {
            target: "loading",
            actions: "updateParams"
          },
          toggleFavorite: {
            actions: choose([
              {
                cond: "notAuthenticated",
                actions: "goToSignup"
              },
              {
                cond: "articleIsFavorited",
                actions: "deleteFavorite"
              },
              {
                actions: "favoriteArticle"
              }
            ])
          },
          "done.invoke.favoriting": {
            actions: "assignArticleData"
          }
        }
      },
      failedLoadingFeed: {
        on: {
          retry: "loading"
        }
      }
    }
  },
  {
    actions: {
      assignArticleData: feedModel.assign({
        articles: (context, event) => {
          const data = event.data.article;
          return context.articles?.map(article =>
            article.slug === data.slug ? data : article
          );
        }
      }, 'done.invoke.favoriting'),
      assignData: feedModel.assign((context, event) => {
        return {
          ...context,
          ...event.data
        };
      }, 'done.invoke.getFeed'),
      assignErrors: feedModel.assign({
        errors: (_, event) => {
          return event.data.errors;
        }
      }, 'error.platform'),
      clearErrors: feedModel.assign({ errors: undefined }),
      goToSignup: () => history.push("/register"),
      deleteFavorite: feedModel.assign((context, event) => {
        const articles = context.articles?.map(article => {
          if (article.slug === event.slug) {
            return {
              ...article,
              favorited: false,
              favoritesCount: article.favoritesCount - 1
            };
          }
          return article;
        });
        return {
          ...context,
          articles,
          favoriteRef: spawn(
            del<ArticleResponse>(`articles/${event.slug}/favorite`),
            "favoriting"
          )
        };
      }, 'toggleFavorite'),
      favoriteArticle: feedModel.assign((context, event) => {
        const articles = context.articles?.map(article => {
          if (article.slug === event.slug) {
            return {
              ...article,
              favorited: true,
              favoritesCount: article.favoritesCount + 1
            };
          }
          return article;
        });
        return {
          ...context,
          articles,
          favoriteRef: spawn(
            post<ArticleResponse>(
              `articles/${event.slug}/favorite`,
              undefined
            ),
            "favoriting"
          )
        };
      }, 'toggleFavorite'),
      updateParams: feedModel.assign((context, event) => {
        return {
          ...context,
          params: event
        };
      }, 'updateFeed')
    },
    guards: {
      dataIsEmpty: context => context.articles?.length === 0,
      articleIsFavorited: (context, event) =>
        event.type === "toggleFavorite" &&
        !!context.articles?.find(
          article => article.slug === event.slug && article.favorited
        )
    },
    services: {
      feedRequest: context => {
        const params = new URLSearchParams({
          limit: context.params.limit.toString(),
          offset: context.params.offset.toString()
        });
        if (context.params.author) params.set("author", context.params.author);
        if (context.params.tag) params.set("tag", context.params.tag);
        if (context.params.favorited)
          params.set("favorited", context.params.favorited);

        return get<ArticleListResponse>(
          (context.params.feed === "me" ? "articles/feed?" : "articles?") +
          params.toString()
        );
      }
    }
  }
);
