import * as React from "react";
import {
  useLocation,
  useParams,
  useRouteMatch,
  NavLink
} from "react-router-dom";
import { useMachine } from "@xstate/react";
import { isProd } from "../utils/env";
import { feedMachine, feedModel } from "../machines/feed.machine";
import { profileMachine, profileModel } from "../machines/profile.machine";
import { ArticlePreview } from "../components/Article";
import { Pagination } from "../components/Pagination";

type ProfileProps = {
  isAuthenticated: boolean;
};

export const Profile: React.FC<ProfileProps> = ({ isAuthenticated }) => {
  const { username } = useParams<{ username: string }>();
  const { url } = useRouteMatch();
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const offset = parseInt(queryParams.get("offset") || "0", 10);
  const limit = parseInt(queryParams.get("limit") || "20", 10);
  const showFavorites = url.includes("favorites");

  const [currentFeed, sendToFeed] = useMachine(feedMachine, {
    devTools: !isProd(),
    context: {
      params: {
        limit,
        offset,
        [showFavorites ? "favorited" : "author"]: username
      }
    },
    guards: {
      notAuthenticated: () => !isAuthenticated
    }
  });

  const [current, send] = useMachine(profileMachine, {
    devTools: !isProd(),
    context: {
      profile: { username }
    },
    guards: {
      notAuthenticated: () => !isAuthenticated
    }
  });

  React.useEffect(() => {
    if (currentFeed.matches("feedLoaded")) {
      sendToFeed(feedModel.events.updateFeed({
        limit,
        offset,
        [showFavorites ? "favorited" : "author"]: username,
        [showFavorites ? "author" : "Favorited"]: undefined
      }));
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
                <img src={profile.image || ""} className="user-img" />
                <h4>{profile.username}</h4>
                <p>{profile.bio}</p>
                <button
                  className={`btn btn-sm ${profile.following
                    ? "btn-secondary"
                    : "btn-outline-secondary"
                    } action-btn`}
                  onClick={() => send(profileModel.events.toggleFollowing())}
                >
                  <i className="ion-plus-round"></i>
                  &nbsp; Follow{profile.following && "ing"} {profile.username}
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
                      activeClassName="active"
                      className="nav-link"
                      to={`/profile/${username}`}
                      exact={true}
                    >
                      My Articles
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink
                      activeClassName="active"
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
                  {currentFeed.context.articles.map(article => (
                    <ArticlePreview
                      key={article.slug}
                      {...article}
                      onFavorite={slug => {
                        if (slug) {
                          sendToFeed(feedModel.events.toggleFavorite(slug));
                        }
                      }}
                    />
                  ))}
                  <Pagination
                    limit={limit}
                    offset={offset}
                    pageCount={Math.ceil(
                      currentFeed.context.articlesCount / limit
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
