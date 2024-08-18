import { MODULE_HEADER, byEntryKey, formatTs, generateType } from './common.js';

export function generateSchemaTypes(openapiDoc) {
	const aliases = Object.entries(openapiDoc.components?.schemas ?? {})
		.sort(byEntryKey)
		.map(([name, schema]) => generateTypeAlias(name, schema));

	return aliases.length > 0
		? formatTs(`${MODULE_HEADER}\n${aliases.join('\n\n')}`)
		: null;
}

function generateTypeAlias(name, schema) {
	return `export type ${name} = ${generateType(schema)}`;
}
