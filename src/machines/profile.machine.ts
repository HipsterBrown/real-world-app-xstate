import {
  assign,
  assertEvent,
  setup,
  ActorRef,
  EventObject,
  Snapshot,
  fromPromise,
  enqueueActions,
} from "xstate";
import { appRouter } from "../App";
import { get, post, del } from "../utils/api-client";
import type { Profile, ProfileResponse, Errors, ErrorsFrom } from "../types/api";

type ProfileContext = {
  profile?: Profile | Partial<Profile>;
  errors?: Errors;
  followerRef?: ActorRef<Snapshot<Omit<ProfileResponse, 'errors'>>, EventObject>;
};

const initialContext: ProfileContext = {
  profile: undefined,
  errors: undefined,
  followerRef: undefined,
}

export const profileMachine = setup({
  types: {
    context: {} as ProfileContext,
    events: {} as
      | { type: 'xstate.done.actor.profileRequest', output: ProfileResponse }
      | { type: 'xstate.done.actor.followRequest', output: ProfileResponse }
      | { type: 'xstate.error.actor.profileRequest', error: ErrorsFrom<ProfileResponse> }
      | { type: 'xstate.error.actor.followRequest', error: ErrorsFrom<ProfileResponse> }
      | { type: 'toggleFollowing' },
    input: {} as Pick<ProfileContext, 'profile'>,
  },
  actions: {
    assignData: assign({
      profile: ({ context, event }) => {
        if (
          event.type === "xstate.done.actor.profileRequest" ||
          event.type === "xstate.done.actor.followRequest"
        )
          return event.output.profile;
        return context.profile;
      }
    }),
    assignErrors: assign({
      errors: ({ event }) => {
        assertEvent(event, ['xstate.error.actor.profileRequest', 'xstate.error.actor.followRequest'])
        return event.error.errors;
      }
    }),
    followProfile: assign(({ context, spawn }) => {
      const { profile } = context;
      return {
        ...context,
        profile: {
          ...profile,
          following: true
        },
        followerRef: spawn('followProfileRequest', {
          id: "followRequest",
          input: { profile: context.profile }
        })
      };
    }),
    goToSignup: () => appRouter.navigate("/register"),
    unfollowProfile: assign(({ context, spawn }) => {
      const { profile } = context;
      return {
        ...context,
        profile: {
          ...profile,
          following: false
        },
        followerRef: spawn('unfollowProfileRequest',
          {
            id: "followRequest",
            input: { profile: context.profile }
          }
        )
      };
    })
  },
  guards: {
    isFollowing: ({ context }) => !!context.profile?.following,
    notAuthenticated: () => true,
  },
  actors: {
    getProfile: fromPromise(async ({ input }: { input: Pick<ProfileContext, 'profile'> }) =>
      await get<ProfileResponse>(`profiles/${input.profile?.username}`)),
    followProfileRequest: fromPromise(async ({ input }: { input: Pick<ProfileContext, 'profile'> }) =>
      await post<ProfileResponse, undefined>(`profiles/${input.profile?.username}/follow`, undefined)),
    unfollowProfileRequest: fromPromise(async ({ input }: { input: Pick<ProfileContext, 'profile'> }) =>
      await del<ProfileResponse>(`profiles/${input.profile?.username}/follow`))
  }
}).createMachine(
  {
    id: "profile-loader",
    initial: "loading",
    context: ({ input }) => ({
      ...initialContext,
      ...input,
    }),
    states: {
      loading: {
        invoke: {
          id: "profileRequest",
          src: "getProfile",
          input: ({ context }) => ({ profile: context.profile }),
          onDone: {
            target: "profileLoaded",
            actions: "assignData"
          },
          onError: {
            target: "errored",
            actions: "assignErrors"
          }
        }
      },
      profileLoaded: {
        on: {
          toggleFollowing: {
            actions: enqueueActions(({ enqueue, check }) => {
              if (check('notAuthenticated')) {
                enqueue('goToSignup')
              } else if (check('isFollowing')) {
                enqueue('unfollowProfile')
              } else {
                enqueue('followProfile')
              }
            }),
          }
        }
      },
      errored: {}
    }
  },
);
