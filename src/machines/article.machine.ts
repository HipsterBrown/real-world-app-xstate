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
    'CREATE_COMMENT': (comment: { body: string }) => ({ comment }),
    'TOGGLE_FOLLOW': (username: string) => ({ username }),
    'TOGGLE_FAVORITE': () => ({}),
    'DELETE_ARTICLE': () => ({}),
    'DELETE_COMMENT': (id: Comment['id']) => ({ id }),
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
  /** @xstate-layout N4IgpgJg5mDOIC5QEMBOAXAlgYwDZgDo0s9CAzMdbAC0wDsoBiCAezsPoDcWBrQmdAEEMOfIlAAHFrExY24kAA9EAJhUBWAgBYdAZl3qAnLoDs6gDQgAnonUAOAGwEAjCYe6ADM8MrD73SoAvoGWxKKEYaQE1MiwAMJs6GB06IwAKgDyAOJZADIAogD6AGIZubkZAOoKUjJydArKCFoqJgSG6irO+rqGzh5GhpY2COrdBL69Js5aXh526g7BoSJRkfjRsQkpyamZOQUlggBqGQBKAJJp+TXSspjySEqILboEDlomWovzunYefl0wxeHjekw6dhMdhmhg8JmWIHWEVWGxi8USu2YbA4dG4fAIZGQ3FQ9wYtzqDwaTyaLU0i2MBm+XV0zmBCBZbXBdm5X1MAK0CKRRBRhDR2ySKUYABF8gVroVBGc0hc4gVyfdHqAaSz3r1-P4vjotGyVHCJsZDG4NJ83IKRcKSKithjJax2AQuLxCBAwPgsAxhI6wOr6o0XupNAY7LMtIY7IY4yo2c4uubZh53J8HIsNHagwRsCwALZF3awAmUGj0JhunF4-iUBIlsshylhhAqBzOCbqTx2NRmXoZtnc7v9-TOaE29QCkKI+2F5spctil2pOJnfKCeVxDIAWT3+QAcmlW5rnqMdT5YzPdO5XB9k10tNoPuppiZLSZfM48+EC8WpbLps6I7JKMpykUu4Hsep5PLUGpUlqqgJhMGZdBm36Wn8xrWIgziToYBDjgY6igvYXh-lEi5Aeg5Z0Cw4qYhuW47vuh4nmeSEXp23YaH2A69rCDjJrGbQkX0Pg4bac5CjRZZYu6nr4tgqBgMg-pQE2tFce2vhOJ+GYpgslpwh4uEjCYd4uG4LLfLGah2MEc4MT68BPEKQoUFQtBkvBdyhtSiDfmyXYeAQnT3lougtIYWgOEEsn2kKq5gegulBc0bjtH8oIEfZoKhSodjmr00YeKaDj-EsSX5kiGXIc0dhsloJXgr0d4OFhLJURs8nAd5VZ+ZIAVtplJgmMmHgDDZ+gtA4HSTL+tX-v1dEgUxKQNRe9htJOLQTSoswOACSZ4Qg3S+K+3zRlorgBC0vWEGt9GMWu21NM47jtCoD39n0Xg5smAREa00X9kYOhwjVKz5i9H22EC53-CV44aARDhVa0T0Ix2FmIAAtEdBAmEZrRdndloJTVwRAA */
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
                TOGGLE_FOLLOW: {
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
                TOGGLE_FAVORITE: {
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
                DELETE_ARTICLE: {
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
                CREATE_COMMENT: {
                  actions: "createComment",
                  target: "#article.comments.hasContent",
                },
                DELETE_COMMENT: [
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
                CREATE_COMMENT: {
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
        }, 'CREATE_COMMENT'),
        deleteComment: articleModel.assign((context, event) => {
          return {
            ...context,
            deletingCommentRef: spawn(
              del(`articles/${context.slug}/comments/${event.id}`)
            ),
            comments:
              context.comments?.filter(comment => comment.id === event.id) || []
          };
        }, 'DELETE_COMMENT'),
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
        }, 'TOGGLE_FAVORITE'),
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
        }, 'TOGGLE_FAVORITE'),
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
        }, 'TOGGLE_FOLLOW'),
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
        }, 'TOGGLE_FOLLOW'),
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
