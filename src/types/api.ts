export type Errors = Record<string, string[]>;

export type ErrorsFrom<Response extends { errors?: Errors }> = Required<Pick<Response, 'errors'>>;

export interface User {
  email: string;
  token: string;
  username: string;
  bio: string;
  image: string | null;
}

export interface Profile {
  username: string;
  bio: string;
  image: string | null;
  following: boolean;
}

export type DateTime = string;

export interface Article {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: DateTime;
  updatedAt: DateTime;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

export interface Comment {
  id: number;
  createdAt: DateTime;
  updatedAt: DateTime;
  body: string;
  author: Profile;
}

export interface APIError {
  body: string[];
}

export interface BaseResponse {
  errors?: Errors;
}

export interface UserResponse extends BaseResponse {
  user: User;
}

export interface ProfileResponse extends BaseResponse {
  profile: Profile;
}

export interface ArticleResponse extends BaseResponse {
  article: Article;
}

export interface ArticleListResponse extends BaseResponse {
  articles: Article[];
  articlesCount: number;
}

export interface CommentResponse extends BaseResponse {
  comment: Comment;
}

export interface CommentListResponse extends BaseResponse {
  comments: Comment[];
}

export interface TagListResponse extends BaseResponse {
  tags: string[];
}
