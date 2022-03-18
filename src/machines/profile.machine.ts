import {
  createMachine,
  spawn,
  actions,
  ActorRef,
  EventObject,
  EventFrom,
  ContextFrom,
} from "xstate";
import { createModel } from 'xstate/lib/model';
import { history } from "../utils/history";
import { get, post, del } from "../utils/api-client";
import type { Profile, ProfileResponse, Errors, ErrorsFrom } from "../types/api";

const { choose } = actions;

type ProfileContext = {
  profile?: Profile | Partial<Profile>;
  errors?: Errors;
  followerRef?: ActorRef<EventObject>;
};

const initialContext: ProfileContext = {
  profile: undefined,
  errors: undefined,
  followerRef: undefined,
}

export const profileModel = createModel(initialContext, {
  events: {
    'done.invoke.profileRequest': (data: ProfileResponse) => ({ data }),
    'done.invoke.followRequest': (data: ProfileResponse) => ({ data }),
    'error.platform': (data: ErrorsFrom<ProfileResponse>) => ({ data }),
    'toggleFollowing': () => ({}),
  }
})

type ProfileState =
  | {
    value: "loading";
    context: {
      profile: Partial<Profile>;
      errors: undefined;
    };
  }
  | {
    value: "profileLoaded";
    context: {
      profile: Profile;
      errors: undefined;
    };
  }
  | {
    value: "errored";
    context: {
      profile: undefined;
      errors: Errors;
    };
  };

export const profileMachine = createMachine<
  ContextFrom<typeof profileModel>,
  EventFrom<typeof profileModel>,
  ProfileState
>(
  {
    id: "profile-loader",
    initial: "loading",
    context: profileModel.initialContext,
    states: {
      loading: {
        invoke: {
          id: "profileRequest",
          src: "getProfile",
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
            actions: choose([
              {
                cond: "notAuthenticated",
                actions: "goToSignup"
              },
              {
                cond: "isFollowing",
                actions: "unfollowProfile"
              },
              {
                actions: "followProfile"
              }
            ])
          }
        }
      },
      errored: {}
    }
  },
  {
    actions: {
      assignData: profileModel.assign({
        profile: (context, event) => {
          if (
            event.type === "done.invoke.profileRequest" ||
            event.type === "done.invoke.followRequest"
          )
            return event.data.profile;
          return context.profile;
        }
      }),
      assignErrors: profileModel.assign({
        errors: (_, event) => {
          return event.data.errors;
        }
      }, 'error.platform'),
      followProfile: profileModel.assign(context => {
        const { profile } = context;
        return {
          ...context,
          profile: {
            ...profile,
            following: true
          },
          followerRef: spawn(
            post<ProfileResponse, undefined>(
              `profiles/${profile?.username}/follow`,
              undefined
            ),
            "followRequest"
          )
        };
      }, 'toggleFollowing'),
      goToSignup: () => history.push("/register"),
      unfollowProfile: profileModel.assign(context => {
        const { profile } = context;
        return {
          ...context,
          profile: {
            ...profile,
            following: false
          },
          followerRef: spawn(
            del<ProfileResponse>(`profiles/${profile?.username}/follow`),
            "followRequest"
          )
        };
      }, 'toggleFollowing')
    },
    guards: {
      isFollowing: ({ profile }) => !!profile?.following
    },
    services: {
      getProfile: ({ profile }) =>
        get<ProfileResponse>(`profiles/${profile?.username}`)
    }
  }
);
