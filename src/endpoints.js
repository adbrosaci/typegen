import {
	MODULE_HEADER,
	MODULE_NAME_PARAMS,
	MODULE_NAME_SCHEMAS,
	extractEndpoints,
	formatTs,
	generateImport,
	generateParamsTypeName,
	generateType,
} from './common.js';

export function generateEndpoints(
	openapiDoc,
	schemasGenerated,
	paramsGenerated,
	renderEach,
	renderModule
) {
	const endpoints = extractEndpoints(openapiDoc)
		.sort((a, b) => a.path.localeCompare(b.path))
		.map(({ operation, path, method }) =>
			generateEndpoint(method, path, operation, renderEach)
		)
		.filter(endpoint => endpoint != null);

	if (endpoints.length === 0) {
		return null;
	}

	const imports = [
		...(schemasGenerated
			? [generateImport(NAMESPACE_SCHEMAS, MODULE_NAME_SCHEMAS)]
			: []),
		...(paramsGenerated
			? [generateImport(NAMESPACE_PARAMS, MODULE_NAME_PARAMS)]
			: []),
	];

	const output = [
		MODULE_HEADER,
		...(imports.length > 0 ? [imports.join('\n')] : []),
		renderModule({ content: endpoints.join('\n') }),
	].join('\n\n');

	return formatTs(output, { breakLines: false });
}

const NAMESPACE_PARAMS = 'p';
const NAMESPACE_SCHEMAS = 's';
const PATH_PARAM_REGEX = /^\{(.+)\}$/;

function generateEndpoint(method, path, operation, render) {
	const { parameters = [] } = operation;
	const pathParams = parameters.filter(param => param.in === 'path');
	const queryParams = parameters.filter(param => param.in === 'query');

	return render({
		method,
		path,
		pathType: generatePathType(path, pathParams),
		paramsType: generateParamsType(method, path, queryParams),
		requestType:
			operation.requestBody != null
				? generateBodyType(operation.requestBody)
				: 'unknown',
		responseType:
			operation.responses?.['200'] != null
				? generateBodyType(operation.responses['200'])
				: 'unknown',
		paramsExpected: queryParams.length > 0,
		paramsRequired: queryParams.some(({ required }) => required),
		bodyExpected: operation.requestBody != null,
		bodyReturned: operation.responses?.['200']?.content != null,
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
	const isBlobType =
		body?.content?.['application/octet-stream']?.schema?.format ===
		'binary';
	const schema = body?.content?.['application/json']?.schema;
	return isBlobType
		? 'Blob'
		: schema != null
		? generateType(schema, NAMESPACE_SCHEMAS)
		: 'unknown';
}
