const { byEntryKey, formatTs, generateType } = require('./common');

function generateSchemaTypes(openapiDoc) {
	const aliases = Object.entries(openapiDoc.components?.schemas ?? {})
		.sort(byEntryKey)
		.map(([name, schema]) => generateTypeAlias(name, schema));

	return aliases.length > 0 ? formatTs(aliases.join('\n\n')) : null;
}

function generateTypeAlias(name, schema) {
	return `export type ${name} = ${generateType(schema)}`;
}

module.exports = { generateSchemaTypes };
