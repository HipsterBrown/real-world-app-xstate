import * as React from "react";
import { Link } from "react-router-dom";
import clsx from 'clsx';
import type { Profile } from "../types/api";
import { formatDate } from "../utils/dates";

type AuthorCardProps = Profile & {
  favorited?: boolean;
  favoritesCount?: number;
  onFavorite?: (slug?: string) => void;
  onFollow?: (username: string) => void;
  onDelete?: () => void;
  createdAt: string;
  slug?: string;
  variant: "preview" | "post" | "currentAuthor";
};

export const AuthorCard: React.FC<AuthorCardProps> = ({
  onDelete,
  onFollow,
  onFavorite,
  username,
  following,
  image,
  createdAt,
  favorited,
  favoritesCount,
  slug,
  variant
}) => {
  return (
    <div className="article-meta">
      <Link to={`/profile/${username}`}>
        <img src={image || ""} />
      </Link>
      <div className="info">
        <Link to={`/profile/${username}`} className="author">
          {username}
        </Link>
        <span className="date">{formatDate(createdAt)}</span>
      </div>
      {variant !== "currentAuthor" && onFollow && (
        <button
          className={clsx('btn btn-sm', { 'btn-secondary': following, 'btn-outline-secondary': !following })}
          type="button"
          onClick={() => onFollow(username)}
        >
          <i className="ion-plus-round"></i> Follow{following && "ing"}{" "}
          {username}
        </button>
      )}
      {variant === "currentAuthor" && (
        <Link to={`/editor/${slug}`}>
          <button className="btn btn-outline-secondary btn-sm" type="button">
            <i className="ion-edit"></i> Edit Article
          </button>
        </Link>
      )}
      &nbsp;
      {variant === "currentAuthor" && onDelete && (
        <button
          className="btn btn-outline-danger btn-sm"
          type="button"
          onClick={() => onDelete()}
        >
          <i className="ion-trash-a"></i> Delete Article
        </button>
      )}
      {variant !== "currentAuthor" && onFavorite && (
        <button
          className={clsx(
            'btn btn-sm',
            { 'btn-primary': favorited, 'btn-outline-primary': !favorited },
            { 'pull-xs-right': variant === 'preview' }
          )}
          type="button"
          onClick={() => onFavorite(slug)}
        >
          <i className="ion-heart"></i>
          {variant === "post" && "Favorite Post"} {favoritesCount}
        </button>
      )}
    </div>
  );
};
