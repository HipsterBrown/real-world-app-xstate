import * as React from "react";
import { useMachine } from "@xstate/react";
import { Formik, Form, Field } from "formik";
import { object, string } from "yup";
import { useParams } from "react-router-dom";
import { editorMachine, editorModel } from "../machines/editor.machine";
import { ErrorListItem } from "../components/ErrorListItem";
import { mapErrors } from "../utils/errors";
import { isProd } from "../utils/env";

const EditorSchema = object({
  title: string().required(),
  description: string().required(),
  body: string().required()
});

export const Editor: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [current, send] = useMachine(editorMachine, {
    devTools: !isProd(),
    context: {
      slug
    }
  });

  return (
    <div className="editor-page">
      <div className="container page">
        <div className="row">
          <div className="col-md-10 offset-md-1 col-xs-12">
            <Formik
              initialValues={{
                title: current.context.article?.title || "",
                description: current.context.article?.description || "",
                body: current.context.article?.body || "",
                tagList: current.context.article?.tagList?.join(",") || ""
              }}
              validationSchema={EditorSchema}
              onSubmit={values => {
                send(editorModel.events.submit({
                  ...values,
                  tagList: values.tagList.split(",")
                }));
              }}
              enableReinitialize={current.matches({ idle: "updating" })}
            >
              <>
                <ul className="error-messages">
                  <ErrorListItem name="title" />
                  <ErrorListItem name="description" />
                  <ErrorListItem name="body" />
                  {current.matches("errored") &&
                    mapErrors(current.context.errors).map(message => (
                      <li key={message}>{message}</li>
                    ))}
                </ul>
                <Form>
                  <fieldset>
                    <fieldset className="form-group">
                      <Field
                        type="text"
                        id="title"
                        name="title"
                        className="form-control form-control-lg"
                        placeholder="Article Title"
                      />
                    </fieldset>
                    <fieldset className="form-group">
                      <Field
                        type="text"
                        id="description"
                        name="description"
                        className="form-control"
                        placeholder="What's this article about?"
                      />
                    </fieldset>
                    <fieldset className="form-group">
                      <Field
                        as="textarea"
                        id="body"
                        name="body"
                        className="form-control"
                        rows={8}
                        placeholder="Write your article (in markdown)"
                      ></Field>
                    </fieldset>
                    <fieldset className="form-group">
                      <Field
                        type="text"
                        className="form-control"
                        placeholder="Enter tags, comma-separated"
                        id="tagList"
                        name="tagList"
                      />
                      <div className="tag-list"></div>
                    </fieldset>
                    <button
                      className="btn btn-lg pull-xs-right btn-primary"
                      type="submit"
                    >
                      {current.matches("submitting")
                        ? "Publishing..."
                        : "Publish Article"}
                    </button>
                  </fieldset>
                </Form>
              </>
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
};
