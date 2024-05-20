import type { BaseResponse } from "../types/api";

const BASE_URL = "https://api.realworld.io/api";

const getHeaders = () => {
  const authToken: string | null = localStorage.getItem("conduit_token");
  const headers: Headers = new Headers({
    "Content-Type": "application/json; charset=utf-8"
  });

  if (authToken) {
    headers.set("Authorization", `Token ${authToken}`);
  }
  return headers;
};

type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";

export const client = <
  Response extends BaseResponse = BaseResponse,
  RequestBody = any
>(
  path: string,
  method: HTTPMethod = "GET",
  body?: RequestBody
) => {
  return fetch(`${BASE_URL}/${path}`, {
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    method
  })
    .then(response => response.json() as Promise<Response>)
    .then(({ errors, ...data }) => {
      if (errors) throw { errors };
      return data;
    });
};

export const get = client;
export const post = <
  Response extends BaseResponse = BaseResponse,
  RequestBody = any
>(
  path: string,
  body: RequestBody
) => client<Response, RequestBody>(path, "POST", body);
export const put = <
  Response extends BaseResponse = BaseResponse,
  RequestBody = any
>(
  path: string,
  body: RequestBody
) => client<Response, RequestBody>(path, "PUT", body);
export const del = <Response extends BaseResponse = BaseResponse>(
  path: string
) => client<Response>(path, "DELETE");
