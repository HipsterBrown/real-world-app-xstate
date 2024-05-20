import {
  setup,
  assign,
  assertEvent,
  enqueueActions,
  fromPromise,
  ActorRef,
  EventObject,
  Snapshot,
} from "xstate";
import { get, post, del } from "../utils/api-client";
import { appRouter } from '../App';
import type {
  ArticleResponse,
  Article,
  CommentListResponse,
  CommentResponse,
  Comment,
  ErrorsFrom,
  ProfileResponse
} from "../types/api";

type ArticleContext = {
  slug: string;
  article?: Article;
  comments?: Comment[];
  deletingRef?: ActorRef<Snapshot<ArticleResponse>, EventObject>;
  creatingCommentRef?: ActorRef<Snapshot<CommentResponse>, EventObject>;
  deletingCommentRef?: ActorRef<Snapshot<CommentResponse>, EventObject>;
  favoritingRef?: ActorRef<Snapshot<ArticleResponse>, EventObject>;
  followingRef?: ActorRef<Snapshot<ProfileResponse>, EventObject>;
};

const initialContext: ArticleContext = {
  slug: '',
}

export const articleMachine =
  setup({
    types: {
      context: {} as ArticleContext,
      events: {} as
        | { type: "xstate.error.actor.getArticle", error: ErrorsFrom<ArticleResponse> }
        | { type: "xstate.error.actor.creatingComment", error: ErrorsFrom<CommentResponse> }
        | { type: "xstate.error.actor.getComments", error: ErrorsFrom<CommentListResponse> }
        | { type: "xstate.error.actor.following", error: ErrorsFrom<ProfileResponse> }
        | { type: "xstate.done.actor.getArticle", output: ArticleResponse }
        | { type: "xstate.done.actor.deletingArticle" }
        | { type: "xstate.done.actor.getComments", output: CommentListResponse }
        | { type: "xstate.done.actor.creatingComment", output: CommentResponse }
        | { type: "xstate.done.actor.favoriting", output: ArticleResponse }
        | { type: "xstate.done.actor.following", output: ProfileResponse }
        | { type: "createComment", comment: { body: string } }
        | { type: "toggleFollow", username: string }
        | { type: "toggleFavorite" }
        | { type: "deleteArticle" }
        | { type: "deleteComment", id: Comment["id"] },
      input: {} as {
        slug?: string,
      }
    },
    actions: {
      assignArticleData: assign({
        article: ({ event }) => {
          assertEvent(event, "xstate.done.actor.getArticle")
          return event.output.article;
        }
      }),
      assignCommentData: assign({
        comments: ({ event }) => {
          assertEvent(event, "xstate.done.actor.getComments")
          return event.output.comments;
        }
      }),
      goToSignup: () => appRouter.navigate("/register"),
      goHome: () => appRouter.navigate("/"),
      deleteArticle: assign({
        deletingRef: ({ context, spawn }) =>
          spawn('deleteArticleRequest', { id: "deletingArticle", input: { slug: context.slug } })
      }),
      createComment: assign({
        creatingCommentRef: ({ context, event, spawn }) => {
          assertEvent(event, "createComment");
          return spawn('createCommentRequest',
            { id: "creatingComment", input: { slug: context.slug, comment: event.comment } }
          );
        }
      }),
      deleteComment: assign(({ context, event, spawn }) => {
        assertEvent(event, "deleteComment")
        return {
          ...context,
          deletingCommentRef: spawn(
            'deleteCommentRequest', { input: { slug: context.slug, id: event.id } }
          ),
          comments:
            context.comments?.filter(comment => comment.id === event.id) || []
        };
      }),
      deleteFavorite: assign(({ context, spawn }) => {
        const article: Article = {
          ...context.article!,
          favorited: false,
          favoritesCount: context.article!.favoritesCount - 1
        };
        return {
          ...context,
          article,
          favoriteRef: spawn(
            'unfavoriteRequest',
            { id: "favoriting", input: { slug: context.slug } }
          )
        };
      }),
      favoriteArticle: assign(({ context, spawn }) => {
        const article: Article = {
          ...context.article!,
          favorited: true,
          favoritesCount: context.article!.favoritesCount + 1
        };
        return {
          ...context,
          article,
          favoriteRef: spawn(
            'favoriteRequest',
            { id: "favoriting", input: { slug: context.slug } }
          )
        };
      }),
      followAuthor: assign(({ context, event, spawn }) => {
        assertEvent(event, "toggleFollow")
        return {
          ...context,
          followingRef: spawn('followAuthorRequest', { input: { username: event.username } }),
          article: {
            ...context.article!,
            author: {
              ...context.article!.author,
              following: true
            }
          }
        };
      }),
      unfollowAuthor: assign(({ context, event, spawn }) => {
        assertEvent(event, "toggleFollow")
        return {
          ...context,
          followingRef: spawn('unfollowAuthorRequest', { input: { username: event.username } }),
          article: {
            ...context.article!,
            author: {
              ...context.article!.author,
              following: false
            }
          }
        };
      }),
      assignNewComment: assign({
        comments: ({ context, event }) => {
          assertEvent(event, "xstate.done.actor.creatingComment")
          return [event.output.comment].concat(context.comments!);
        }
      })
    },
    guards: {
      hasCommentContent: ({ event }) => {
        assertEvent(event, "xstate.done.actor.getComments")
        return !!event.output.comments.length;
      },
      isOnlyComment: ({ context }) => context.comments?.length === 1,
      notFollowing: ({ context }) => !context.article?.author?.following,
      articleIsFavorited: ({ context }) => !!context.article?.favorited,
      notAuthenticated: () => true,
    },
    actors: {
      createCommentRequest: fromPromise(async ({ input }: { input: Pick<ArticleContext, 'slug'> & { comment: Pick<Comment, 'body'> } }) => await post<CommentResponse, { comment: Pick<Comment, "body"> }>(
        `articles/${input.slug}/comments`,
        { comment: input.comment }
      )),
      deleteArticleRequest: fromPromise(async ({ input }: { input: Pick<ArticleContext, 'slug'> }) => await del<ArticleResponse>(`articles/${input.slug}`)),
      deleteCommentRequest: fromPromise(async ({ input }: { input: Pick<ArticleContext, 'slug'> & { id: number } }) => await del<CommentResponse>(`articles/${input.slug}/comments/${input.id}`)),
      favoriteRequest: fromPromise(async ({ input }: { input: Pick<ArticleContext, 'slug'> }) => await post<ArticleResponse>(
        `articles/${input.slug}/favorite`,
        undefined
      )),
      followAuthorRequest: fromPromise(async ({ input }: { input: { username: string } }) => await post<ProfileResponse>(
        `profiles/${input.username}/follow`,
        undefined
      )),
      getArticle: fromPromise(({ input }: { input: Pick<ArticleContext, 'slug'> }) => get<ArticleResponse>(`articles/${input.slug}`)),
      getComments: fromPromise(({ input }: { input: Pick<ArticleContext, 'slug'> }) =>
        get<CommentListResponse>(`articles/${input.slug}/comments`)),
      unfavoriteRequest: fromPromise(async ({ input }: { input: Pick<ArticleContext, 'slug'> }) => del<ArticleResponse>(`articles/${input.slug}/favorite`)),
      unfollowAuthorRequest: fromPromise(async ({ input }: { input: { username: string } }) =>
        await del<ProfileResponse>(`profiles/${input.username}/follow`)
      ),

    }
  }).createMachine(
    {
      id: "article",
      context: ({ input }) => ({
        ...initialContext,
        slug: input.slug ?? '',
      }),
      type: "parallel",
      states: {
        article: {
          initial: "fetching",
          states: {
            fetching: {
              invoke: {
                src: "getArticle",
                input: ({ context }) => ({ slug: context.slug }),
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
                  actions: enqueueActions(({ enqueue, check }) => {
                    if (check("notAuthenticated")) {
                      console.log("should go to signup")
                      enqueue("goToSignup")
                    } else if (check("notFollowing")) {
                      console.log("follow author")
                      enqueue("followAuthor")
                    } else {
                      console.log("unfollow author")
                      enqueue("unfollowAuthor")
                    }
                  }),
                  target: "#article.article.hasContent",
                },
                toggleFavorite: {
                  actions: enqueueActions(({ enqueue, check }) => {
                    if (check("notAuthenticated")) {
                      enqueue("goToSignup")
                    } else if (check("articleIsFavorited")) {
                      enqueue("deleteFavorite")
                    } else {
                      enqueue("favoriteArticle")
                    }
                  }),
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
                input: ({ context }) => ({ slug: context.slug }),
                onDone: [
                  {
                    actions: "assignCommentData",
                    guard: "hasCommentContent",
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
                    guard: "isOnlyComment",
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
    }
  );
