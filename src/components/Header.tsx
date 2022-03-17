import * as React from "react";
import { Link, NavLink } from "react-router-dom";
import type { User } from "../types/api";
import type { UserState } from '../machines/app.machine';

type HeaderProps =
  | {
    currentUser?: User;
    userState: UserState;
  }
  | {
    currentUser: User;
    userState: "user.authenticated";
  };

export const Header: React.FC<HeaderProps> = ({ currentUser, userState }) => {
  return (
    <nav className="navbar navbar-light">
      <div className="container">
        <Link className="navbar-brand" to="/">
          conduit
        </Link>
        <ul className="nav navbar-nav pull-xs-right">
          <li className="nav-item">
            <NavLink
              className="nav-link"
              exact={true}
              activeClassName="active"
              to="/"
            >
              Home
            </NavLink>
          </li>
          {userState === "user.authenticating" && (
            <li className="nav-item">
              <span className="nav-link">Loading...</span>
            </li>
          )}
          {userState === "user.authenticated" && (
            <>
              <li className="nav-item">
                <NavLink
                  className="nav-link"
                  activeClassName="active"
                  to="/editor"
                >
                  <i className="ion-compose"></i>&nbsp;New Post
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink
                  className="nav-link"
                  activeClassName="active"
                  to="/settings"
                >
                  <i className="ion-gear-a"></i>&nbsp;Settings
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink
                  className="nav-link"
                  activeClassName="active"
                  to={`/profile/${currentUser?.username}`}
                >
                  {currentUser?.username}
                </NavLink>
              </li>
            </>
          )}
          {userState === "user.unauthenticated" && (
            <>
              <li className="nav-item">
                <NavLink
                  className="nav-link"
                  activeClassName="active"
                  to="/login"
                >
                  Sign in
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink
                  className="nav-link"
                  activeClassName="active"
                  to="/register"
                >
                  Sign up
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};
