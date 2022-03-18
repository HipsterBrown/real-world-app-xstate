import * as React from "react";
import { Formik, Field, Form } from "formik";
import { object, string } from "yup";
import { Link } from "react-router-dom";
import { ActorRefFrom } from "xstate";
import { useActor } from "@xstate/react";
import { authMachine, authModel } from "../machines/auth.machine";
import { ErrorListItem } from "../components/ErrorListItem";
import { mapErrors } from "../utils/errors";

interface SignUpValues {
  name: string;
  email: string;
  password: string;
}

type LogInValues = Omit<SignUpValues, "name">;

const SignUpSchema = object({
  name: string().required(),
  email: string().required().email(),
  password: string().required().min(8)
});

const LogInSchema = object({
  email: string().required().email(),
  password: string().required().min(8)
});

export const Auth: React.FC<{
  mode?: "signup" | "login";
  authService: ActorRefFrom<typeof authMachine>;
}> = ({ mode = "signup", authService }) => {
  const [current, send] = useActor(authService);

  return (
    <div className="auth-page">
      <div className="container page">
        <div className="row">
          <div className="col-md-6 offset-md-3 col-xs-12">
            <h1 className="text-xs-center">
              {mode === "signup" ? "Sign up" : "Log In"}
            </h1>
            {mode === "signup" && (
              <p className="text-xs-center">
                <Link to="/login">Have an account?</Link>
              </p>
            )}
            {mode === "login" && (
              <p className="text-xs-center">
                <Link to="/register">Need an account?</Link>
              </p>
            )}

            <Formik<SignUpValues | LogInValues>
              initialValues={{ name: "", email: "", password: "" }}
              onSubmit={values => {
                send(authModel.events.SUBMIT(values));
              }}
              validationSchema={mode === "signup" ? SignUpSchema : LogInSchema}
            >
              <>
                <ul className="error-messages">
                  <ErrorListItem name="email" />
                  <ErrorListItem name="password" />
                  <ErrorListItem name="name" />
                  {current.matches("failed") &&
                    mapErrors(current.context.errors).map(message => (
                      <li key={message}>{message}</li>
                    ))}
                </ul>
                <Form>
                  {mode === "signup" && (
                    <fieldset className="form-group">
                      <Field
                        id="name"
                        name="name"
                        className="form-control form-control-lg"
                        type="text"
                        placeholder="Your Name"
                      />
                    </fieldset>
                  )}
                  <fieldset className="form-group">
                    <Field
                      id="email"
                      name="email"
                      className="form-control form-control-lg"
                      type="email"
                      placeholder="Email"
                      autoComplete="off"
                    />
                  </fieldset>
                  <fieldset className="form-group">
                    <Field
                      id="password"
                      name="password"
                      className="form-control form-control-lg"
                      type="password"
                      placeholder="Password"
                      autoComplete="off"
                    />
                  </fieldset>
                  <button
                    type="submit"
                    className="btn btn-lg btn-primary pull-xs-right"
                    disabled={current.matches("submitting")}
                  >
                    {mode === "signup" ? "Sign up" : "Log In"}
                  </button>
                </Form>
              </>
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
};
