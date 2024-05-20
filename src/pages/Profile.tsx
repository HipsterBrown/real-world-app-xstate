import * as React from "react";
import {
  useLocation,
  useParams,
  NavLink,
  useMatches
} from "react-router-dom";
import { useMachine } from "@xstate/react";
import clsx from 'clsx';
import { isProd } from "../utils/env";
import { feedMachine } from "../machines/feed.machine";
import { profileMachine } from "../machines/profile.machine";
import { ArticlePreview } from "../components/Article";
import { Pagination } from "../components/Pagination";
import { useIsAuthenticated } from "../hooks/is-authenticated";
import { inspect } from '../App';

export const Profile: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  const { username } = useParams<{ username: string }>();
  const [{ pathname }] = useMatches();
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const offset = parseInt(queryParams.get("offset") || "0", 10);
  const limit = parseInt(queryParams.get("limit") || "20", 10);
  const showFavorites = pathname.includes("favorites");

  const [currentFeed, sendToFeed] = useMachine(feedMachine.provide({
    guards: {
      notAuthenticated: () => !isAuthenticated
    }
  }), {
    inspect: isProd() ? inspect : undefined,
    input: {
      params: {
        limit,
        offset,
        [showFavorites ? "favorited" : "author"]: username
      }
    },
  });

  const [current, send] = useMachine(profileMachine.provide({
    guards: {
      notAuthenticated: () => !isAuthenticated
    }
  }), {
    inspect: isProd() ? inspect : undefined,
    input: {
      profile: { username }
    },
  });

  React.useEffect(() => {
    if (currentFeed.matches("feedLoaded")) {
      sendToFeed({
        type: 'updateFeed',
        limit,
        offset,
        [showFavorites ? "favorited" : "author"]: username,
        [showFavorites ? "author" : "Favorited"]: undefined
      });
    }
  }, [sendToFeed, offset, limit, showFavorites, username]);

  if (current.matches("loading") || current.matches("errored")) return null;

  if (current.matches("profileLoaded")) {
    const { profile } = current.context;
    return (
      <div className="profile-page">
        <div className="user-info">
          <div className="container">
            <div className="row">
              <div className="col-xs-12 col-md-10 offset-md-1">
                <img src={profile?.image || ""} className="user-img" />
                <h4>{profile?.username}</h4>
                <p>{profile?.bio}</p>
                <button
                  className={clsx('btn btn-sm action-btn', { 'btn-secondary': profile?.following, 'btn-outline-secondary': !profile?.following })}
                  onClick={() => send({ type: 'toggleFollowing' })}
                >
                  <i className="ion-plus-round"></i>
                  &nbsp; Follow{profile?.following && "ing"} {profile?.username}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container">
          <div className="row">
            <div className="col-xs-12 col-md-10 offset-md-1">
              <div className="articles-toggle">
                <ul className="nav nav-pills outline-active">
                  <li className="nav-item">
                    <NavLink
                      className="nav-link"
                      to={`/profile/${username}`}
                    >
                      My Articles
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink
                      className="nav-link"
                      to={`/profile/${username}/favorites`}
                    >
                      Favorited Articles
                    </NavLink>
                  </li>
                </ul>
              </div>

              {currentFeed.matches("loading") && (
                <div className="article-preview">
                  <p>Loading articles...</p>
                </div>
              )}

              {currentFeed.matches({ feedLoaded: "noArticles" }) && (
                <div className="article-preview">
                  <p>No articles are here...yet</p>
                </div>
              )}

              {currentFeed.matches({ feedLoaded: "articlesAvailable" }) && (
                <>
                  {currentFeed.context.articles?.map(article => (
                    <ArticlePreview
                      key={article.slug}
                      {...article}
                      onFavorite={slug => {
                        if (slug) {
                          sendToFeed({ type: 'toggleFavorite', slug });
                        }
                      }}
                    />
                  ))}
                  <Pagination
                    limit={limit}
                    offset={offset}
                    pageCount={Math.ceil(
                      currentFeed.context.articlesCount! / limit
                    )}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};
