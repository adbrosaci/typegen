const {
	MODULE_NAME_BODIES,
	MODULE_NAME_PARAMS,
	extractEndpoints,
	formatTs,
	generateParamsTypeName,
	generateType,
} = require('./common');

const NAMESPACE_BODIES = 'b';
const NAMESPACE_PARAMS = 'p';

const PATH_PARAM_REGEX = /^\{(.+)\}$/;

function generateEndpoints({
	openapiDoc,
	bodiesGenerated,
	paramsGenerated,
	renderEach,
	renderModule,
}) {
	const endpoints = extractEndpoints(openapiDoc)
		.sort((a, b) => a.path.localeCompare(b.path))
		.map(({ operation, path, method }) =>
			generateEndpoint(method, path, operation, renderEach)
		);

	if (endpoints.length === 0) {
		return null;
	}

	const imports = [
		...(bodiesGenerated
			? [generateImport(NAMESPACE_BODIES, MODULE_NAME_BODIES)]
			: []),
		...(paramsGenerated
			? [generateImport(NAMESPACE_PARAMS, MODULE_NAME_PARAMS)]
			: []),
	];

	const output = [
		...(imports.length > 0 ? [imports.join('\n')] : []),
		renderModule({ content: endpoints.join('\n') }),
	].join('\n\n');

	return formatTs(output, { breakLines: false });
}

function generateEndpoint(method, path, operation, render) {
	const { parameters = [] } = operation;
	const pathParams = parameters.filter(param => param.in === 'path');
	const queryParams = parameters.filter(param => param.in === 'query');

	return render({
		method,
		pathType: generatePathType(path, pathParams),
		paramsType: generateParamsType(method, path, queryParams),
		paramsExpected: queryParams.length > 0,
		paramsRequired: queryParams.some(p => p.required),
		requestType:
			'requestBody' in operation
				? generateBodyType(operation.requestBody)
				: 'never',
		responseType:
			'responses' in operation && '200' in operation.responses
				? generateBodyType(operation.responses['200'])
				: 'never',
	});
}

function generatePathType(path, params) {
	const inputSegments = path.slice(1).split('/');
	const outputSegments = inputSegments.map(generatePathSegment(params));
	const hasParams = inputSegments.some(segment =>
		PATH_PARAM_REGEX.test(segment)
	);

	return hasParams
		? `\`/${outputSegments.join('/')}\``
		: `'/${outputSegments.join('/')}'`;
}

function generatePathSegment(params) {
	const outputTypeByParam = Object.fromEntries(
		params.map(({ name, schema }) => [name, generateType(schema)])
	);

	return segment => {
		const paramName = segment.match(PATH_PARAM_REGEX)?.[1];
		return paramName != null
			? `\${${outputTypeByParam[paramName] ?? 'never'}}`
			: segment;
	};
}

function generateParamsType(method, path, queryParams) {
	return queryParams.length > 0
		? `${NAMESPACE_PARAMS}.${generateParamsTypeName(method, path)}`
		: '{}';
}

function generateBodyType(body) {
	const schema = body?.content?.['application/json']?.schema;
	return schema != null ? generateType(schema, NAMESPACE_BODIES) : 'unknown';
}

function generateImport(namespace, moduleName) {
	return `import * as ${namespace} from './${moduleName}';`;
}

module.exports = { generateEndpoints };
