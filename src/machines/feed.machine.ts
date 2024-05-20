import {
  setup,
  assign,
  assertEvent,
  enqueueActions,
  ActorRef,
  EventObject,
  Snapshot,
  fromPromise,
} from "xstate";
import { get, del, post } from "../utils/api-client";
import { appRouter } from "../App";
import type {
  Article,
  ArticleListResponse,
  ArticleResponse,
  Errors,
  ErrorsFrom
} from "../types/api";

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
  favoriteRef?: ActorRef<Snapshot<Omit<ArticleResponse, 'errors'>>, EventObject>;
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

export const feedMachine = setup({
  types: {
    context: {} as FeedContext,
    events: {} as
      | { type: 'xstate.done.actor.getFeed', output: ArticleListResponse }
      | { type: 'xstate.done.actor.favoriting', data: ArticleResponse }
      | { type: 'xstate.error.actor.getFeed', error: ErrorsFrom<ArticleListResponse> }
      | { type: 'xstate.error.actor.favoriting', error: ErrorsFrom<ArticleResponse> }
      | { type: 'retry' }
      | { type: 'refresh' }
      | { type: 'updateFeed' } & FeedContext['params']
      | { type: 'toggleFavorite', slug: string },
    input: {} as Pick<FeedContext, 'params'>,
  },
  actions: {
    assignArticleData: assign({
      articles: ({ context, event }) => {
        assertEvent(event, 'xstate.done.actor.favoriting')
        const data = event.data.article;
        return context.articles?.map(article =>
          article.slug === data.slug ? data : article
        );
      }
    }),
    assignData: assign(({ context, event }) => {
      assertEvent(event, 'xstate.done.actor.getFeed')
      return {
        ...context,
        ...event.output
      };
    }),
    assignErrors: assign({
      errors: ({ event }) => {
        assertEvent(event, ['xstate.error.actor.getFeed', 'xstate.error.actor.favoriting'])
        return event.error.errors;
      }
    }),
    clearErrors: assign({ errors: undefined }),
    goToSignup: () => appRouter.navigate("/register"),
    deleteFavorite: assign(({ context, event, spawn }) => {
      assertEvent(event, 'toggleFavorite');
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
        favoriteRef: spawn(fromPromise(() =>
          del<ArticleResponse>(`articles/${event.slug}/favorite`),

        ), { id: "favoriting" })
      };
    }),
    favoriteArticle: assign(({ context, event, spawn }) => {
      assertEvent(event, 'toggleFavorite')
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
        favoriteRef: spawn(fromPromise(() =>
          post<ArticleResponse>(
            `articles/${event.slug}/favorite`,
            undefined
          )),
          { id: "favoriting" }
        )
      };
    }),
    updateParams: assign(({ context, event }) => {
      assertEvent(event, 'updateFeed')
      return {
        ...context,
        params: event
      };
    })
  },
  guards: {
    dataIsEmpty: ({ context }) => context.articles?.length === 0,
    articleIsFavorited: ({ context, event }) =>
      event.type === "toggleFavorite" &&
      !!context.articles?.find(
        article => article.slug === event.slug && article.favorited
      ),
    notAuthenticated: () => false,

  },
  actors: {
    feedRequest: fromPromise(({ input }: { input: Pick<FeedContext, 'params'> }) => {
      const params = new URLSearchParams({
        limit: input.params.limit.toString(),
        offset: input.params.offset.toString()
      });
      if (input.params.author) params.set("author", input.params.author);
      if (input.params.tag) params.set("tag", input.params.tag);
      if (input.params.favorited)
        params.set("favorited", input.params.favorited);

      return get<ArticleListResponse>(
        (input.params.feed === "me" ? "articles/feed?" : "articles?") +
        params.toString()
      );
    })
  }
}).createMachine(
  {
    id: "feed-loader",
    initial: "loading",
    context: ({ input }) => ({
      ...initialContext,
      ...input
    }),
    states: {
      loading: {
        invoke: {
          id: "getFeed",
          src: "feedRequest",
          input: ({ context }) => ({ params: context.params }),
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
                guard: "dataIsEmpty"
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
            actions: enqueueActions(({ enqueue, check }) => {
              if (check('notAuthenticated')) {
                enqueue('goToSignup');
              } else if (check('articleIsFavorited')) {
                enqueue('deleteFavorite')
              } else {
                enqueue('favoriteArticle')
              }
            }),
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
);
