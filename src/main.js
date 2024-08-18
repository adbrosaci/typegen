import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { parse } from 'yaml';

import { generateModules } from './modules.js';

const CONFIG_FILENAME = 'typegen.config.mjs';

export async function main() {
	const configPath = `${process.cwd()}/${CONFIG_FILENAME}`;
	console.log(`Importing config from ${configPath}`);
	const { default: config } = await import(configPath);

	if (config.hooks?.before != null) {
		console.log('Running before-hook');
		await config.hooks.before();
	}

	console.log('Loading OpenAPI doc');
	const openapiYaml = await readFile(resolve(config.inputDoc), 'utf-8');
	const openapiDoc = parse(openapiYaml);

	console.log('Generating modules');
	const modulesMap = generateModules(openapiDoc, config.endpoints ?? null);

	await Promise.all(
		Array.from(modulesMap, async ([name, content]) => {
			const modulePath = resolve(config.outputDir, `${name}.ts`);
			console.log(`Writing ${modulePath}`);
			await writeFile(modulePath, content);
		})
	);

	if (config.hooks?.after != null) {
		console.log('Running after-hook');
		await config.hooks.after();
	}
}
