const { format } = require('prettier');

const MODULE_NAME_BARREL = 'index';
const MODULE_NAME_BODIES = 'bodies';
const MODULE_NAME_ENDPOINTS = 'endpoints';
const MODULE_NAME_PARAMS = 'params';

const PRINT_WIDTH_DEFAULT = 80;
const PRINT_WIDTH_LARGE = 1000;

const HTTP_METHODS = [
	'delete',
	'get',
	'head',
	'options',
	'patch',
	'post',
	'put',
	'trace',
];

function byEntryKey([key1], [key2]) {
	return key1.localeCompare(key2);
}

function capitalize(string) {
	return string.length > 0 ? string[0].toUpperCase() + string.slice(1) : '';
}

function extractEndpoints(openapiDoc) {
	return Object.entries(openapiDoc.paths ?? {}).flatMap(([path, pathItem]) =>
		HTTP_METHODS.map(method => [method, pathItem[method]])
			.filter(item => item[1] != null)
			.map(([method, { parameters = [], ...operation }]) => ({
				method,
				path,
				operation: {
					...operation,
					parameters: [
						...(pathItem.parameters ?? []),
						...parameters,
					].map(param =>
						'$ref' in param
							? openapiDoc.components.parameters[
									param.$ref.split('/').at(-1)
							  ]
							: param
					),
				},
			}))
	);
}

function formatTs(tsCode, { breakLines = true } = {}) {
	return format(tsCode, {
		parser: 'babel-ts',
		singleQuote: true,
		useTabs: true,
		printWidth: breakLines ? PRINT_WIDTH_DEFAULT : PRINT_WIDTH_LARGE,
	});
}

function generateParamsTypeName(method, path) {
	const camelMethod = capitalize(method);
	const camelPath = path
		.split(/[^\w]+/)
		.map(capitalize)
		.join('');

	return `${camelMethod}${camelPath}Params`;
}

function generateProperty(key, schema, genType) {
	const jsdoc = schema.deprecated ? `/** @deprecated */` : '';
	return `${jsdoc}'${key}': ${genType(schema)};`;
}

function generateType(schema, namespace = null) {
	const genChildType = subSchema => generateType(subSchema, namespace);

	if (schema.nullable) {
		return `(${genChildType({ ...schema, nullable: false })} | null)`;
	}

	if ('$ref' in schema) {
		const name = schema.$ref.split('/').at(-1);
		return namespace != null ? `${namespace}.${name}` : name;
	}

	if ('oneOf' in schema) {
		return `(${schema.oneOf.map(genChildType).join(' | ')})`;
	}

	if ('allOf' in schema) {
		return `(${schema.allOf.map(genChildType).join(' & ')})`;
	}

	switch (schema.type) {
		case 'null':
		case 'number':
		case 'boolean':
			return schema.type;

		case 'integer':
			return 'number';

		case 'string':
			return 'enum' in schema
				? `(${schema.enum.map(o => `'${o}'`).join(' | ')})`
				: 'string';

		case 'object':
			if ('additionalProperties' in schema) {
				const type = genChildType(schema.additionalProperties);
				return `Record<string, ${type}>`;
			}

			const properties = Object.entries(schema.properties ?? {})
				.sort(byEntryKey)
				.map(([propKey, propSchema]) =>
					generateProperty(propKey, propSchema, genChildType)
				)
				.join(' ');

			return `{ ${properties} }`;

		case 'array':
			return 'items' in schema
				? `${genChildType(schema.items)}[]`
				: 'unknown[]';

		default:
			return 'never';
	}
}

module.exports = {
	MODULE_NAME_BARREL,
	MODULE_NAME_BODIES,
	MODULE_NAME_ENDPOINTS,
	MODULE_NAME_PARAMS,
	byEntryKey,
	capitalize,
	extractEndpoints,
	formatTs,
	generateType,
	generateParamsTypeName,
};
