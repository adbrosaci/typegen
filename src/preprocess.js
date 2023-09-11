const { HTTP_METHODS, mapRecord, filterRecord } = require('./common');

function preprocessOpenapiDoc(openapiDoc) {
	if (openapiDoc.paths == null) {
		return openapiDoc;
	}

	const resolvedPaths = mapRecord(
		openapiDoc.paths,
		resolvePathItem(openapiDoc)
	);

	const pathsWithoutSharedParams = mapRecord(
		resolvedPaths,
		moveSharedParamsToOperations
	);

	if (openapiDoc.components?.parameters == null) {
		return { ...openapiDoc, paths: pathsWithoutSharedParams };
	}

	const pathsWithResolvedParams = mapRecord(
		resolvedPaths,
		resolveParamsInPathItem(openapiDoc)
	);

	return { ...openapiDoc, paths: pathsWithResolvedParams };
}

function moveSharedParamsToOperations(pathItem) {
	if (!('parameters' in pathItem)) {
		return pathItem;
	}

	const { parameters, ...restOfPathItem } = pathItem;
	return {
		...restOfPathItem,
		...mapRecord(
			filterRecord(restOfPathItem, isRecordEntryOperation),
			operation => ({
				...operation,
				parameters: [...parameters, ...(operation.parameters ?? [])],
			})
		),
	};
}

function resolveParamsInPathItem(openapiDoc) {
	const resolve = resolveParam(openapiDoc);

	return pathItem => ({
		...('parameters' in pathItem && {
			parameters: pathItem.parameters.map(resolve),
		}),
		...mapRecord(
			filterRecord(pathItem, isRecordEntryOperation),
			operation => ({
				...operation,
				parameters: operation.parameters?.map(resolve),
			})
		),
	});
}

function resolvePathItem(openapiDoc) {
	return pathItem =>
		'$ref' in pathItem
			? openapiDoc.paths[parseNameFromRef(pathItem.$ref)]
			: pathItem;
}

function resolveParam(openapiDoc) {
	return param =>
		'$ref' in param
			? openapiDoc.components?.parameters?.[parseNameFromRef(param.$ref)]
			: param;
}

function isRecordEntryOperation(_, key) {
	return HTTP_METHODS.includes(key);
}

function parseNameFromRef(ref) {
	return ref.split('/').at(-1).replaceAll('~1', '/');
}

module.exports = { preprocessOpenapiDoc };
