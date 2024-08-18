import {
	MODULE_HEADER,
	MODULE_NAME_BARREL,
	MODULE_NAME_ENDPOINTS,
	MODULE_NAME_PARAMS,
	MODULE_NAME_SCHEMAS,
} from './common.js';

import { generateEndpoints } from './endpoints.js';
import { generateParamTypes } from './params.js';
import { preprocessOpenapiDoc } from './preprocess.js';
import { generateSchemaTypes } from './schemas.js';

export function generateModules(rawOpenapiDoc, endpointsConfig = null) {
	const openapiDoc = preprocessOpenapiDoc(rawOpenapiDoc);
	const modules = new Map();

	const schemasModule = generateSchemaTypes(openapiDoc);
	if (schemasModule != null) {
		modules.set(MODULE_NAME_SCHEMAS, schemasModule);
	}

	const paramsModule = generateParamTypes(openapiDoc, schemasModule != null);
	if (paramsModule != null) {
		modules.set(MODULE_NAME_PARAMS, paramsModule);
	}

	if (endpointsConfig != null) {
		const { renderEach, renderModule } = endpointsConfig;

		const endpointsModule = generateEndpoints(
			openapiDoc,
			schemasModule != null,
			paramsModule != null,
			renderEach,
			renderModule
		);

		if (endpointsModule != null) {
			modules.set(MODULE_NAME_ENDPOINTS, endpointsModule);
		}
	}

	if (modules.size > 0) {
		modules.set(MODULE_NAME_BARREL, generateBarrel([...modules.keys()]));
	}

	return modules;
}

function generateBarrel(moduleNames) {
	const exports = moduleNames
		.sort()
		.map(name => `export * from './${name}';`)
		.join('\n');

	return `${MODULE_HEADER}\n${exports}\n`;
}
