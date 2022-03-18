import {
  createMachine,
  actions,
  spawn,
  ActorRef,
  EventObject,
  EventFrom,
  ContextFrom,
} from "xstate";
import { get, post, del } from "../utils/api-client";
import { history } from "../utils/history";
import type {
  ArticleResponse,
  Article,
  CommentListResponse,
  CommentResponse,
  Comment,
  ErrorsFrom,
  ProfileResponse
} from "../types/api";
import { createModel } from "xstate/lib/model";

const { choose } = actions;

type ArticleContext = {
  slug: string;
  article?: Article;
  comments?: Comment[];
  deletingRef?: ActorRef<EventObject>;
  creatingCommentRef?: ActorRef<EventObject>;
  deletingCommentRef?: ActorRef<EventObject>;
  favoritingRef?: ActorRef<EventObject>;
  followingRef?: ActorRef<EventObject>;
};

const initialContext: ArticleContext = {
  slug: '',
}

export const articleModel = createModel(initialContext, {
  events: {
    'error.platform': (data: ErrorsFrom<ArticleResponse | CommentListResponse | CommentResponse | ProfileResponse>) => ({ data }),
    'done.invoke.getArticle': (data: ArticleResponse) => ({ data }),
    'done.invoke.deletingArticle': () => ({}),
    'done.invoke.getComments': (data: CommentListResponse) => ({ data }),
    'done.invoke.creatingComment': (data: CommentResponse) => ({ data }),
    'done.invoke.favoriting': (data: ArticleResponse) => ({ data }),
    'done.invoke.following': (data: ProfileResponse) => ({ data }),
    'createComment': (comment: { body: string }) => ({ comment }),
    'toggleFollow': (username: string) => ({ username }),
    'toggleFavorite': () => ({}),
    'deleteArticle': () => ({}),
    'deleteComment': (id: Comment['id']) => ({ id }),
  }
})

type ArticleState =
  | {
    value:
    | "article"
    | { article: "fetching" }
    | "comments"
    | { comments: "fetching" };
    context: ArticleContext & {
      article: undefined;
      comments: undefined;
    };
  }
  | {
    value: { article: "hasContent" };
    context: ArticleContext & {
      article: Article;
    };
  }
  | {
    value: { comments: "hasContent" };
    context: ArticleContext & {
      comments: Comment[];
    };
  }
  | {
    value: { comments: "noContent" };
    context: ArticleContext & {
      comments: [];
    };
  };

export const articleMachine =
  createMachine<
    ContextFrom<typeof articleModel>,
    EventFrom<typeof articleModel>,
    ArticleState
  >(
    {
      id: "article",
      type: "parallel",
      states: {
        article: {
          initial: "fetching",
          states: {
            fetching: {
              invoke: {
                src: "getArticle",
                id: "getArticle",
                onDone: [
                  {
                    actions: "assignArticleData",
                    target: "#article.article.hasContent",
                  },
                ],
              },
            },
            hasContent: {
              on: {
                toggleFollow: {
                  actions: choose([
                    {
                      actions: "goToSignup",
                      cond: "notAuthenticated",
                    },
                    {
                      actions: "followAuthor",
                      cond: "notFollowing",
                    },
                    {
                      actions: "unfollowAuthor",
                    },
                  ]),
                  target: "#article.article.hasContent",
                },
                toggleFavorite: {
                  actions: choose([
                    {
                      actions: "goToSignup",
                      cond: "notAuthenticated",
                    },
                    {
                      actions: "deleteFavorite",
                      cond: "articleIsFavorited",
                    },
                    {
                      actions: "favoriteArticle",
                    },
                  ]),
                  target: "#article.article.hasContent",
                },
                deleteArticle: {
                  actions: "deleteArticle",
                  target: "#article.article.hasContent",
                },
              },
            },
          },
        },
        comments: {
          initial: "fetching",
          states: {
            fetching: {
              invoke: {
                src: "getComments",
                id: "getComments",
                onDone: [
                  {
                    actions: "assignCommentData",
                    cond: "hasCommentContent",
                    target: "#article.comments.hasContent",
                  },
                  {
                    actions: "assignCommentData",
                    target: "#article.comments.noContent",
                  },
                ],
              },
            },
            hasContent: {
              on: {
                createComment: {
                  actions: "createComment",
                  target: "#article.comments.hasContent",
                },
                deleteComment: [
                  {
                    actions: "deleteComment",
                    cond: "isOnlyComment",
                    target: "#article.comments.noContent",
                  },
                  {
                    actions: "deleteComment",
                    target: "#article.comments.hasContent",
                  },
                ],
              },
            },
            noContent: {
              on: {
                createComment: {
                  actions: "createComment",
                  target: "#article.comments.hasContent",
                },
              },
            },
          },
        },
      },
    },
    {
      actions: {
        assignArticleData: articleModel.assign({
          article: (_, event) => {
            return event.data.article;
          }
        }, 'done.invoke.getArticle'),
        assignCommentData: articleModel.assign({
          comments: (_, event) => {
            return event.data.comments;
          }
        }, 'done.invoke.getComments'),
        goToSignup: () => history.push("/register"),
        goHome: () => history.push("/"),
        deleteArticle: articleModel.assign({
          deletingRef: context =>
            spawn(del(`articles/${context.slug}`), "deletingArticle")
        }),
        createComment: articleModel.assign({
          creatingCommentRef: (context, event) => {
            return spawn(
              post<CommentResponse, { comment: Pick<Comment, "body"> }>(
                `articles/${context.slug}/comments`,
                { comment: event.comment }
              ),
              "creatingComment"
            );
          }
        }, 'createComment'),
        deleteComment: articleModel.assign((context, event) => {
          return {
            ...context,
            deletingCommentRef: spawn(
              del(`articles/${context.slug}/comments/${event.id}`)
            ),
            comments:
              context.comments?.filter(comment => comment.id === event.id) || []
          };
        }, 'deleteComment'),
        deleteFavorite: articleModel.assign((context) => {
          const article: Article = {
            ...context.article!,
            favorited: false,
            favoritesCount: context.article!.favoritesCount - 1
          };

          return {
            ...context,
            article,
            favoriteRef: spawn(
              del<ArticleResponse>(`articles/${context.slug}/favorite`),
              "favoriting"
            )
          };
        }, 'toggleFavorite'),
        favoriteArticle: articleModel.assign((context) => {
          const article: Article = {
            ...context.article!,
            favorited: true,
            favoritesCount: context.article!.favoritesCount + 1
          };
          return {
            ...context,
            article,
            favoriteRef: spawn(
              post<ArticleResponse>(
                `articles/${context.slug}/favorite`,
                undefined
              ),
              "favoriting"
            )
          };
        }, 'toggleFavorite'),
        followAuthor: articleModel.assign((context, event) => {
          return {
            ...context,
            followingRef: spawn(
              post<ProfileResponse>(
                `profiles/${event.username}/follow`,
                undefined
              )
            ),
            article: {
              ...context.article!,
              author: {
                ...context.article!.author,
                following: true
              }
            }
          };
        }, 'toggleFollow'),
        unfollowAuthor: articleModel.assign((context, event) => {
          return {
            ...context,
            followingRef: spawn(
              del<ProfileResponse>(`profiles/${event.username}/follow`)
            ),
            article: {
              ...context.article!,
              author: {
                ...context.article!.author,
                following: false
              }
            }
          };
        }, 'toggleFollow'),
        assignNewComment: articleModel.assign({
          comments: (context, event) => {
            return [event.data.comment].concat(context.comments!);
          }
        }, 'done.invoke.creatingComment')
      },
      guards: {
        hasCommentContent: (_context, event) => {
          if (event.type === "done.invoke.getComments") {
            return !!event.data.comments.length;
          }
          return false;
        },
        isOnlyComment: context => context.comments?.length === 1,
        notFollowing: context => !context.article?.author?.following,
        articleIsFavorited: context => !!context.article?.favorited
      },
      services: {
        getArticle: context => get<ArticleResponse>(`articles/${context.slug}`),
        getComments: context =>
          get<CommentListResponse>(`articles/${context.slug}/comments`)
      }
    }
  );
