const { format } = require('prettier');

const MODULE_NAME_BARREL = 'index';
const MODULE_NAME_ENDPOINTS = 'endpoints';
const MODULE_NAME_PARAMS = 'params';
const MODULE_NAME_SCHEMAS = 'schemas';

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
			.filter(([, operation]) => operation != null)
			.map(([method, operation]) => ({ method, path, operation }))
	);
}

function filterRecord(record, predicate) {
	return Object.fromEntries(
		Object.entries(record).filter(([key, value]) => predicate(value, key))
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

function generateImport(namespace, moduleName) {
	return `import * as ${namespace} from './${moduleName}';`;
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

function mapRecord(record, mapper) {
	return Object.fromEntries(
		Object.entries(record).map(([key, value]) => [key, mapper(value, key)])
	);
}

module.exports = {
	HTTP_METHODS,
	MODULE_NAME_BARREL,
	MODULE_NAME_ENDPOINTS,
	MODULE_NAME_PARAMS,
	MODULE_NAME_SCHEMAS,
	byEntryKey,
	capitalize,
	extractEndpoints,
	filterRecord,
	formatTs,
	generateImport,
	generateParamsTypeName,
	generateType,
	mapRecord,
};
