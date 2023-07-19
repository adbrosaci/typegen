#!/usr/bin/env node

const { readFile, writeFile } = require('fs/promises');
const { relative, resolve } = require('path');
const { parse } = require('yaml');

const { generateBodyTypes } = require('./bodies');
const { generateEndpoints } = require('./endpoints');
const { generateParamTypes } = require('./params');

const {
	MODULE_NAME_BARREL,
	MODULE_NAME_BODIES,
	MODULE_NAME_ENDPOINTS,
	MODULE_NAME_PARAMS,
} = require('./common');

const CONFIG_FILENAME = 'typegen.config.js';

const HEADER_COMMENT =
	'/* This file has been automatically generated */\n' +
	'/* eslint-disable */';

async function main() {
	const config = loadConfig();
	if (config.hooks?.before != null) {
		await config.hooks.before();
	}

	const openapiYaml = await readFile(resolve(config.inputDoc), 'utf-8');
	const openapiDoc = parse(openapiYaml);
	const modules = new Map();

	const bodiesModule = generateBodyTypes(openapiDoc);
	if (bodiesModule != null) {
		modules.set(MODULE_NAME_BODIES, bodiesModule);
	}

	const paramsModule = generateParamTypes(openapiDoc);
	if (paramsModule != null) {
		modules.set(MODULE_NAME_PARAMS, paramsModule);
	}

	if (config.endpoints != null) {
		const endpointsModule = generateEndpoints({
			...config.endpoints,
			bodiesGenerated: modules.has(MODULE_NAME_BODIES),
			paramsGenerated: modules.has(MODULE_NAME_PARAMS),
			openapiDoc,
		});
		if (endpointsModule != null) {
			modules.set(MODULE_NAME_ENDPOINTS, endpointsModule);
		}
	}

	if (modules.size > 0) {
		modules.set(MODULE_NAME_BARREL, generateBarrel(...modules.keys()));
	}

	await Promise.all(
		Array.from(modules, ([name, content]) =>
			writeModule(name, content, config.outputDir)
		)
	);

	if (config.hooks?.after != null) {
		await config.hooks.after();
	}
}

function generateBarrel(...moduleNames) {
	const exports = moduleNames
		.sort()
		.map(name => `export * from './${name}';`)
		.join('\n');

	return `${exports}\n`;
}

function loadConfig() {
	return require(`${relative(__dirname, process.cwd())}/${CONFIG_FILENAME}`);
}

async function writeModule(name, content, outputPath) {
	const modulePath = resolve(outputPath, `${name}.ts`);
	const prefixedContent = `${HEADER_COMMENT}\n\n${content}`;

	await writeFile(modulePath, prefixedContent);
	console.log(`Generated  ${modulePath}`);
}

if (module === require.main) {
	main();
}
