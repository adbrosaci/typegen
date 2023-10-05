# Typegen

A simple generator of TypeScript types from OpenAPI docs.

## Installation

- Install the NPM package: `npm install --save-dev @adbros/typegen`.
- Create a `typegen.config.js` file and export a valid config object from it. See *Configuration* (below) for details.

## Usage

Each time the OpenAPI doc changes, run `npx typegen` in the directory containing `typegen.config.js`.

## Configuration

The `typegen.config.js` file should be present in the current working directory when running the `typegen` utility. (Usually, it makes most sense for it to reside in the project's root directory -- next to `package.json`, `tsconfig.json`, etc.).

The config object exported from  `typegen.config.js` should have the following properties:

- `inputDoc` **(required)** -- A string containing the path to the input *OpenAPI 3.0.x* doc.
- `outputDir` **(required)** -- A string containing the path to the output directory.
- `hooks` -- An optional child config object containing convenience funtions to be called before/after the type generation itself. Both functions are optional. Both are called with zero arguments. Both may return a promise; the program's execution will be blocked until the promise's resolution. Both may throw or return an eventually rejected promise, in which case the program will be prematurely terminated with a nonzero exit code.
  - `before` -- Called before the input doc is loaded. Useful e.g. for fetching the doc from an external source, generating the doc from other data, performing custom validation on the doc (and throwing/rejecting on failure to prevent the type generation itself), etc.
  - `after` -- Called after the type generation is finished and the files written. Useful e.g. for custom post-processing of the generated files.
- `endpoints` -- An optional child config object containing options related to the rendering of endpoints as arbitrary TypeScript constructs. If not given, `endpoints.ts` is not generated at all. If given, it **must contain**:
  - `renderEach` -- A function that maps available info about an endpoint to a string containing arbitrary TypeScript code. It will be called for each enpdoint (i.e. each method, path pair) with an info object containing:
    - `method` (`string`) -- the name of the HTTP method in lower case, e.g. `post`; 
    - `pathType` (`string`) -- a string literal type or template literal type describing the path including path parameters, e.g. ``` `/customer/${number}/invoices` ```;
    - `requestType` (`string`) -- the type of the request body, e.g. `Invoice`;
    - `responseType` (`string`) -- the type of the response body, e.g. `{ invoices: Invoice[]; totalCount: number }`,
    - `paramsType` (`string`) -- the type describing an object, where each property corresponds to a single query parameter accepted by the endpoint, e.g. `GetInvoicesParams` (defined in `params.ts` as e.g. `{ limit: number; offset: number }`);
    - `paramsExpected` (`boolean`) -- whether there is at least one query parameter accepted by the endpoint;
    - `paramsRequired` (`boolean`) -- whether there is at least one query parameter required by the endpoint;
    - `bodyExpected` (`boolean`) -- whether the endpoint expects a request body.
  - `renderModule` -- A function which maps the concatenated output of `renderEach` calls to a string containing the final TypeScript module. It takes an object with the sole property `content`.

### Example

The following config defines the generation of a valid subtype of an [Axios](https://axios-http.com) instance, which only permits calls to existing endpoints using overloaded method signatures. This is useful because:

- calls to nonexistent endpoints are disallowed;
- correct request bodies/parameters are enforced;
- the return type -- corresponding to the matching endpoint's response type -- is automatically inferred for each valid call.

```js
module.exports = {
  inputDoc: 'path/to/openapi.yaml',
  outputDir: 'path/to/output/directory'
  endpoints: {
    renderModule: ({ content }) => `export type Api = { ${content} };`,
    renderEach: ({
      method,
      pathType,
      requestType,
      responseType,
      paramsType,
      paramsExpected,
      paramsRequired,
    }) => {
      switch (method) {
        case 'get':
          return paramsExpected
            ? `${method}(
              path: ${pathType},
              config${paramsRequired ? '' : '?'}:
                { params: ${paramsType} },
            ): Promise<{ data: ${responseType} }>;`
            : `${method}(
              path: ${pathType},
            ): Promise<{ data: ${responseType} }>;`;
        case 'post':
        case 'put':
          return `${method}(
            path: ${pathType},
            body: ${requestType},
          ): Promise<{ data: ${responseType} }>;`;
        default:
          return `${method}(
            path: ${pathType},
          ): Promise<{ data: ${responseType} }>;`;
      }
    },
  }
};
```
