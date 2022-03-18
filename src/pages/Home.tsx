import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useMachine } from "@xstate/react";
import { isProd } from "../utils/env";
import { Tag } from "../components/Tag";
import { Pagination } from "../components/Pagination";
import { ArticlePreview } from "../components/Article";
import { feedMachine, feedModel } from "../machines/feed.machine";
import { tagsMachine } from "../machines/tags.machine";

type HomeProps = {
  isAuthenticated: boolean;
};

export const Home: React.FC<HomeProps> = ({ isAuthenticated }) => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const feed = params.get("feed") ?? undefined;
  const offset = parseInt(params.get("offset") || "0", 10);
  const limit = parseInt(params.get("limit") || "20", 10);
  const author = params.get("author") ?? undefined;
  const tag = params.get("tag") ?? undefined;
  const favorited = params.get("favorited") ?? undefined;

  const [current, send] = useMachine(feedMachine, {
    devTools: !isProd(),
    context: {
      params: {
        limit,
        offset,
        author,
        tag,
        favorited,
        feed
      }
    },
    guards: {
      notAuthenticated: () => !isAuthenticated
    }
  });
  const [currentTags] = useMachine(tagsMachine, {
    devTools: !isProd()
  });

  React.useEffect(() => {
    if (current.matches("feedLoaded")) {
      send(feedModel.events.updateFeed({
        offset,
        limit,
        feed,
        author,
        tag,
        favorited
      }));
    }
  }, [send, offset, feed, author, tag, favorited, limit]);

  return (
    <div className="home-page">
      <div className="banner">
        <div className="container">
          <h1 className="logo-font">conduit</h1>
          <p>A place to share your knowledge.</p>
        </div>
      </div>

      <div className="container page">
        <div className="row">
          <div className="col-md-9">
            <div className="feed-toggle">
              <ul className="nav nav-pills outline-active">
                {isAuthenticated && (
                  <li className="nav-item">
                    <NavLink
                      activeClassName="active"
                      className="nav-link"
                      isActive={(match, location) =>
                        !!match && location.search.includes("feed=me")
                      }
                      to="/?feed=me"
                    >
                      Your Feed
                    </NavLink>
                  </li>
                )}
                <li className="nav-item">
                  <NavLink
                    activeClassName="active"
                    exact={true}
                    isActive={(match, location) =>
                      !!match &&
                      !location.search.includes("feed=me") &&
                      !location.search.includes("tag=")
                    }
                    className="nav-link"
                    to="/"
                  >
                    Global Feed
                  </NavLink>
                </li>
                {tag && (
                  <li className="nav-item">
                    <NavLink
                      activeClassName="active"
                      isActive={match => !!match}
                      className="nav-link"
                      to={`/?tag=${tag}`}
                    >
                      #{tag}
                    </NavLink>
                  </li>
                )}
              </ul>
            </div>

            {current.matches("loading") && (
              <div className="article-preview">
                <p>Loading articles...</p>
              </div>
            )}

            {current.matches({ feedLoaded: "articlesAvailable" }) && (
              <>
                {current.context.articles.map(article => (
                  <ArticlePreview
                    key={article.slug}
                    {...article}
                    onFavorite={slug => {
                      if (slug) {
                        send(feedModel.events.toggleFavorite(slug));
                      }
                    }}
                  />
                ))}
                <Pagination
                  pageCount={Math.ceil(current.context.articlesCount / limit)}
                  limit={limit}
                  offset={offset}
                />
              </>
            )}

            {current.matches({ feedLoaded: "noArticles" }) && (
              <div className="article-preview">
                <p>No articles are here...yet</p>
              </div>
            )}
          </div>

          <div className="col-md-3">
            <div className="sidebar">
              <p>Popular Tags</p>

              {currentTags.matches("loading") && <p>Loading tags...</p>}

              {currentTags.matches("tagsLoaded") && (
                <div className="tag-list">
                  {currentTags.context.tags.map(tag => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
