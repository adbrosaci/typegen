import { format } from 'prettier';

export const HTTP_METHODS = [
	'delete',
	'get',
	'head',
	'options',
	'patch',
	'post',
	'put',
	'trace',
];

export const MODULE_HEADER =
	'/* This file has been automatically generated */\n' +
	'/* eslint-disable */\n';

export const MODULE_NAME_BARREL = 'index';
export const MODULE_NAME_ENDPOINTS = 'endpoints';
export const MODULE_NAME_PARAMS = 'params';
export const MODULE_NAME_SCHEMAS = 'schemas';

export function byEntryKey([key1], [key2]) {
	return key1.localeCompare(key2);
}

export function capitalize(string) {
	return string.length > 0 ? string[0].toUpperCase() + string.slice(1) : '';
}

export function extractEndpoints(openapiDoc) {
	return Object.entries(openapiDoc.paths ?? {}).flatMap(([path, pathItem]) =>
		HTTP_METHODS.map(method => [method, pathItem[method]])
			.filter(([, operation]) => operation != null)
			.map(([method, operation]) => ({ method, path, operation }))
	);
}

export function filterRecord(record, predicate) {
	return Object.fromEntries(
		Object.entries(record).filter(([key, value]) => predicate(value, key))
	);
}

export function formatTs(tsCode, { breakLines = true } = {}) {
	return format(tsCode, {
		parser: 'babel-ts',
		singleQuote: true,
		useTabs: true,
		printWidth: breakLines ? PRINT_WIDTH_DEFAULT : PRINT_WIDTH_LARGE,
	});
}

export function generateImport(namespace, moduleName) {
	return `import * as ${namespace} from './${moduleName}';`;
}

export function generateParamsTypeName(method, path) {
	const camelMethod = capitalize(method);
	const camelPath = path
		.split(/[^\w]+/)
		.map(capitalize)
		.join('');

	return `${camelMethod}${camelPath}Params`;
}

export function generateType(schema, namespace = null) {
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
			return 'unknown';
	}
}

export function mapRecord(record, mapper) {
	return Object.fromEntries(
		Object.entries(record).map(([key, value]) => [key, mapper(value, key)])
	);
}

const PRINT_WIDTH_DEFAULT = 80;
const PRINT_WIDTH_LARGE = 1000;

function generateProperty(key, schema, genType) {
	const property = `'${key}': ${genType(schema)};`;
	return schema.deprecated ? `/** @deprecated */ ${property}` : property;
}
