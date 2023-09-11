const {
	MODULE_NAME_SCHEMAS,
	byEntryKey,
	extractEndpoints,
	formatTs,
	generateImport,
	generateParamsTypeName,
	generateType,
} = require('./common');

const NAMESPACE_SCHEMAS = 's';

function generateParamTypes({ openapiDoc, schemasGenerated }) {
	const aliases = extractEndpoints(openapiDoc)
		.filter(({ operation }) =>
			operation.parameters?.some(param => param.in === 'query')
		)
		.map(({ method, path, operation }) => [
			generateParamsTypeName(method, path),
			operation.parameters,
		])
		.sort(byEntryKey)
		.map(([name, params]) => generateTypeAlias(name, params));

	if (aliases.length === 0) {
		return null;
	}

	const output = [
		...(schemasGenerated
			? [generateImport(NAMESPACE_SCHEMAS, MODULE_NAME_SCHEMAS)]
			: []),
		...aliases,
	].join('\n\n');

	return formatTs(output);
}

function generateTypeAlias(typeName, params) {
	const properties = params
		.filter(param => param.in === 'query')
		.map(({ name, ...options }) => [sanitizeParamName(name), options])
		.sort(byEntryKey)
		.map(([name, { schema, required }]) =>
			generateProperty(name, schema, required)
		)
		.join(' ');

	return `export type ${typeName} = { ${properties} }`;
}

function generateProperty(name, schema, required) {
	const extendedSchema = required ? schema : { ...schema, nullable: true };
	const type = generateType(extendedSchema, NAMESPACE_SCHEMAS);
	return `${name}${required ? '' : '?'}: ${type};`;
}

function sanitizeParamName(name) {
	return name.match(/^[a-z]+(?:[A-Z][a-z]*)*/)?.[0] ?? `'${name}'`;
}

module.exports = { generateParamTypes };
