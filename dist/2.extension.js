"use strict";
exports.id = 2;
exports.ids = [2];
exports.modules = {

/***/ 1952:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getHostHeaderPlugin: () => (/* binding */ getHostHeaderPlugin),
/* harmony export */   hostHeaderMiddleware: () => (/* binding */ hostHeaderMiddleware),
/* harmony export */   hostHeaderMiddlewareOptions: () => (/* binding */ hostHeaderMiddlewareOptions),
/* harmony export */   resolveHostHeaderConfig: () => (/* binding */ resolveHostHeaderConfig)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1350);

function resolveHostHeaderConfig(input) {
    return input;
}
const hostHeaderMiddleware = (options) => (next) => async (args) => {
    if (!_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpRequest.isInstance(args.request))
        return next(args);
    const { request } = args;
    const { handlerProtocol = "" } = options.requestHandler.metadata || {};
    if (handlerProtocol.indexOf("h2") >= 0 && !request.headers[":authority"]) {
        delete request.headers["host"];
        request.headers[":authority"] = request.hostname + (request.port ? ":" + request.port : "");
    }
    else if (!request.headers["host"]) {
        let host = request.hostname;
        if (request.port != null)
            host += `:${request.port}`;
        request.headers["host"] = host;
    }
    return next(args);
};
const hostHeaderMiddlewareOptions = {
    name: "hostHeaderMiddleware",
    step: "build",
    priority: "low",
    tags: ["HOST"],
    override: true,
};
const getHostHeaderPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(hostHeaderMiddleware(options), hostHeaderMiddlewareOptions);
    },
});


/***/ }),

/***/ 1953:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getLoggerPlugin: () => (/* binding */ getLoggerPlugin),
/* harmony export */   loggerMiddleware: () => (/* binding */ loggerMiddleware),
/* harmony export */   loggerMiddlewareOptions: () => (/* binding */ loggerMiddlewareOptions)
/* harmony export */ });
const loggerMiddleware = () => (next, context) => async (args) => {
    try {
        const response = await next(args);
        const { clientName, commandName, logger, dynamoDbDocumentClientOptions = {} } = context;
        const { overrideInputFilterSensitiveLog, overrideOutputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
        const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
        const outputFilterSensitiveLog = overrideOutputFilterSensitiveLog ?? context.outputFilterSensitiveLog;
        const { $metadata, ...outputWithoutMetadata } = response.output;
        logger?.info?.({
            clientName,
            commandName,
            input: inputFilterSensitiveLog(args.input),
            output: outputFilterSensitiveLog(outputWithoutMetadata),
            metadata: $metadata,
        });
        return response;
    }
    catch (error) {
        const { clientName, commandName, logger, dynamoDbDocumentClientOptions = {} } = context;
        const { overrideInputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
        const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
        logger?.error?.({
            clientName,
            commandName,
            input: inputFilterSensitiveLog(args.input),
            error,
            metadata: error.$metadata,
        });
        throw error;
    }
};
const loggerMiddlewareOptions = {
    name: "loggerMiddleware",
    tags: ["LOGGER"],
    step: "initialize",
    override: true,
};
const getLoggerPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(loggerMiddleware(), loggerMiddlewareOptions);
    },
});


/***/ }),

/***/ 1954:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRecursionDetectionPlugin: () => (/* binding */ getRecursionDetectionPlugin)
/* harmony export */ });
/* harmony import */ var _configuration__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1955);
/* harmony import */ var _recursionDetectionMiddleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1956);


const getRecursionDetectionPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add((0,_recursionDetectionMiddleware__WEBPACK_IMPORTED_MODULE_1__.recursionDetectionMiddleware)(), _configuration__WEBPACK_IMPORTED_MODULE_0__.recursionDetectionMiddlewareOptions);
    },
});


/***/ }),

/***/ 1955:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   recursionDetectionMiddlewareOptions: () => (/* binding */ recursionDetectionMiddlewareOptions)
/* harmony export */ });
const recursionDetectionMiddlewareOptions = {
    step: "build",
    tags: ["RECURSION_DETECTION"],
    name: "recursionDetectionMiddleware",
    override: true,
    priority: "low",
};


/***/ }),

/***/ 1956:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   recursionDetectionMiddleware: () => (/* binding */ recursionDetectionMiddleware)
/* harmony export */ });
/* harmony import */ var _aws_lambda_invoke_store__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1957);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1350);


const TRACE_ID_HEADER_NAME = "X-Amzn-Trace-Id";
const ENV_LAMBDA_FUNCTION_NAME = "AWS_LAMBDA_FUNCTION_NAME";
const ENV_TRACE_ID = "_X_AMZN_TRACE_ID";
const recursionDetectionMiddleware = () => (next) => async (args) => {
    const { request } = args;
    if (!_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__.HttpRequest.isInstance(request)) {
        return next(args);
    }
    const traceIdHeader = Object.keys(request.headers ?? {}).find((h) => h.toLowerCase() === TRACE_ID_HEADER_NAME.toLowerCase()) ??
        TRACE_ID_HEADER_NAME;
    if (request.headers.hasOwnProperty(traceIdHeader)) {
        return next(args);
    }
    const functionName = process.env[ENV_LAMBDA_FUNCTION_NAME];
    const traceIdFromEnv = process.env[ENV_TRACE_ID];
    const invokeStore = await _aws_lambda_invoke_store__WEBPACK_IMPORTED_MODULE_0__.InvokeStore.getInstanceAsync();
    const traceIdFromInvokeStore = invokeStore?.getXRayTraceId();
    const traceId = traceIdFromInvokeStore ?? traceIdFromEnv;
    const nonEmptyString = (str) => typeof str === "string" && str.length > 0;
    if (nonEmptyString(functionName) && nonEmptyString(traceId)) {
        request.headers[TRACE_ID_HEADER_NAME] = traceId;
    }
    return next({
        ...args,
        request,
    });
};


/***/ }),

/***/ 1957:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InvokeStore: () => (/* binding */ InvokeStore),
/* harmony export */   InvokeStoreBase: () => (/* binding */ InvokeStoreBase)
/* harmony export */ });
const PROTECTED_KEYS = {
    REQUEST_ID: Symbol.for("_AWS_LAMBDA_REQUEST_ID"),
    X_RAY_TRACE_ID: Symbol.for("_AWS_LAMBDA_X_RAY_TRACE_ID"),
    TENANT_ID: Symbol.for("_AWS_LAMBDA_TENANT_ID"),
};
const NO_GLOBAL_AWS_LAMBDA = ["true", "1"].includes(process.env?.AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA ?? "");
if (!NO_GLOBAL_AWS_LAMBDA) {
    globalThis.awslambda = globalThis.awslambda || {};
}
class InvokeStoreBase {
    static PROTECTED_KEYS = PROTECTED_KEYS;
    isProtectedKey(key) {
        return Object.values(PROTECTED_KEYS).includes(key);
    }
    getRequestId() {
        return this.get(PROTECTED_KEYS.REQUEST_ID) ?? "-";
    }
    getXRayTraceId() {
        return this.get(PROTECTED_KEYS.X_RAY_TRACE_ID);
    }
    getTenantId() {
        return this.get(PROTECTED_KEYS.TENANT_ID);
    }
}
class InvokeStoreSingle extends InvokeStoreBase {
    currentContext;
    getContext() {
        return this.currentContext;
    }
    hasContext() {
        return this.currentContext !== undefined;
    }
    get(key) {
        return this.currentContext?.[key];
    }
    set(key, value) {
        if (this.isProtectedKey(key)) {
            throw new Error(`Cannot modify protected Lambda context field: ${String(key)}`);
        }
        this.currentContext = this.currentContext || {};
        this.currentContext[key] = value;
    }
    run(context, fn) {
        this.currentContext = context;
        return fn();
    }
}
class InvokeStoreMulti extends InvokeStoreBase {
    als;
    static async create() {
        const instance = new InvokeStoreMulti();
        const asyncHooks = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 2249, 23));
        instance.als = new asyncHooks.AsyncLocalStorage();
        return instance;
    }
    getContext() {
        return this.als.getStore();
    }
    hasContext() {
        return this.als.getStore() !== undefined;
    }
    get(key) {
        return this.als.getStore()?.[key];
    }
    set(key, value) {
        if (this.isProtectedKey(key)) {
            throw new Error(`Cannot modify protected Lambda context field: ${String(key)}`);
        }
        const store = this.als.getStore();
        if (!store) {
            throw new Error("No context available");
        }
        store[key] = value;
    }
    run(context, fn) {
        return this.als.run(context, fn);
    }
}
var InvokeStore;
(function (InvokeStore) {
    let instance = null;
    async function getInstanceAsync() {
        if (!instance) {
            instance = (async () => {
                const isMulti = "AWS_LAMBDA_MAX_CONCURRENCY" in process.env;
                const newInstance = isMulti
                    ? await InvokeStoreMulti.create()
                    : new InvokeStoreSingle();
                if (!NO_GLOBAL_AWS_LAMBDA && globalThis.awslambda?.InvokeStore) {
                    return globalThis.awslambda.InvokeStore;
                }
                else if (!NO_GLOBAL_AWS_LAMBDA && globalThis.awslambda) {
                    globalThis.awslambda.InvokeStore = newInstance;
                    return newInstance;
                }
                else {
                    return newInstance;
                }
            })();
        }
        return instance;
    }
    InvokeStore.getInstanceAsync = getInstanceAsync;
    InvokeStore._testing = process.env.AWS_LAMBDA_BENCHMARK_MODE === "1"
        ? {
            reset: () => {
                instance = null;
                if (globalThis.awslambda?.InvokeStore) {
                    delete globalThis.awslambda.InvokeStore;
                }
                globalThis.awslambda = {};
            },
        }
        : undefined;
})(InvokeStore || (InvokeStore = {}));




/***/ }),

/***/ 1958:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_UA_APP_ID: () => (/* binding */ DEFAULT_UA_APP_ID),
/* harmony export */   resolveUserAgentConfig: () => (/* binding */ resolveUserAgentConfig)
/* harmony export */ });
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1445);

const DEFAULT_UA_APP_ID = undefined;
function isValidUserAgentAppId(appId) {
    if (appId === undefined) {
        return true;
    }
    return typeof appId === "string" && appId.length <= 50;
}
function resolveUserAgentConfig(input) {
    const normalizedAppIdProvider = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_0__.normalizeProvider)(input.userAgentAppId ?? DEFAULT_UA_APP_ID);
    const { customUserAgent } = input;
    return Object.assign(input, {
        customUserAgent: typeof customUserAgent === "string" ? [[customUserAgent]] : customUserAgent,
        userAgentAppId: async () => {
            const appId = await normalizedAppIdProvider();
            if (!isValidUserAgentAppId(appId)) {
                const logger = input.logger?.constructor?.name === "NoOpLogger" || !input.logger ? console : input.logger;
                if (typeof appId !== "string") {
                    logger?.warn("userAgentAppId must be a string or undefined.");
                }
                else if (appId.length > 50) {
                    logger?.warn("The provided userAgentAppId exceeds the maximum length of 50 characters.");
                }
            }
            return appId;
        },
    });
}


/***/ }),

/***/ 1959:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getUserAgentMiddlewareOptions: () => (/* binding */ getUserAgentMiddlewareOptions),
/* harmony export */   getUserAgentPlugin: () => (/* binding */ getUserAgentPlugin),
/* harmony export */   userAgentMiddleware: () => (/* binding */ userAgentMiddleware)
/* harmony export */ });
/* harmony import */ var _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1960);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1350);
/* harmony import */ var _check_features__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2005);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2007);
/* harmony import */ var _encode_features__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2008);





const userAgentMiddleware = (options) => (next, context) => async (args) => {
    const { request } = args;
    if (!_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__.HttpRequest.isInstance(request)) {
        return next(args);
    }
    const { headers } = request;
    const userAgent = context?.userAgent?.map(escapeUserAgent) || [];
    const defaultUserAgent = (await options.defaultUserAgentProvider()).map(escapeUserAgent);
    await (0,_check_features__WEBPACK_IMPORTED_MODULE_2__.checkFeatures)(context, options, args);
    const awsContext = context;
    defaultUserAgent.push(`m/${(0,_encode_features__WEBPACK_IMPORTED_MODULE_4__.encodeFeatures)(Object.assign({}, context.__smithy_context?.features, awsContext.__aws_sdk_context?.features))}`);
    const customUserAgent = options?.customUserAgent?.map(escapeUserAgent) || [];
    const appId = await options.userAgentAppId();
    if (appId) {
        defaultUserAgent.push(escapeUserAgent([`app`, `${appId}`]));
    }
    const prefix = (0,_aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.getUserAgentPrefix)();
    const sdkUserAgentValue = (prefix ? [prefix] : [])
        .concat([...defaultUserAgent, ...userAgent, ...customUserAgent])
        .join(_constants__WEBPACK_IMPORTED_MODULE_3__.SPACE);
    const normalUAValue = [
        ...defaultUserAgent.filter((section) => section.startsWith("aws-sdk-")),
        ...customUserAgent,
    ].join(_constants__WEBPACK_IMPORTED_MODULE_3__.SPACE);
    if (options.runtime !== "browser") {
        if (normalUAValue) {
            headers[_constants__WEBPACK_IMPORTED_MODULE_3__.X_AMZ_USER_AGENT] = headers[_constants__WEBPACK_IMPORTED_MODULE_3__.X_AMZ_USER_AGENT]
                ? `${headers[_constants__WEBPACK_IMPORTED_MODULE_3__.USER_AGENT]} ${normalUAValue}`
                : normalUAValue;
        }
        headers[_constants__WEBPACK_IMPORTED_MODULE_3__.USER_AGENT] = sdkUserAgentValue;
    }
    else {
        headers[_constants__WEBPACK_IMPORTED_MODULE_3__.X_AMZ_USER_AGENT] = sdkUserAgentValue;
    }
    return next({
        ...args,
        request,
    });
};
const escapeUserAgent = (userAgentPair) => {
    const name = userAgentPair[0]
        .split(_constants__WEBPACK_IMPORTED_MODULE_3__.UA_NAME_SEPARATOR)
        .map((part) => part.replace(_constants__WEBPACK_IMPORTED_MODULE_3__.UA_NAME_ESCAPE_REGEX, _constants__WEBPACK_IMPORTED_MODULE_3__.UA_ESCAPE_CHAR))
        .join(_constants__WEBPACK_IMPORTED_MODULE_3__.UA_NAME_SEPARATOR);
    const version = userAgentPair[1]?.replace(_constants__WEBPACK_IMPORTED_MODULE_3__.UA_VALUE_ESCAPE_REGEX, _constants__WEBPACK_IMPORTED_MODULE_3__.UA_ESCAPE_CHAR);
    const prefixSeparatorIndex = name.indexOf(_constants__WEBPACK_IMPORTED_MODULE_3__.UA_NAME_SEPARATOR);
    const prefix = name.substring(0, prefixSeparatorIndex);
    let uaName = name.substring(prefixSeparatorIndex + 1);
    if (prefix === "api") {
        uaName = uaName.toLowerCase();
    }
    return [prefix, uaName, version]
        .filter((item) => item && item.length > 0)
        .reduce((acc, item, index) => {
        switch (index) {
            case 0:
                return item;
            case 1:
                return `${acc}/${item}`;
            default:
                return `${acc}#${item}`;
        }
    }, "");
};
const getUserAgentMiddlewareOptions = {
    name: "getUserAgentMiddleware",
    step: "build",
    priority: "low",
    tags: ["SET_USER_AGENT", "USER_AGENT"],
    override: true,
};
const getUserAgentPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.add(userAgentMiddleware(config), getUserAgentMiddlewareOptions);
    },
});


/***/ }),

/***/ 1960:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EndpointError: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_5__.EndpointError),
/* harmony export */   awsEndpointFunctions: () => (/* reexport safe */ _aws__WEBPACK_IMPORTED_MODULE_0__.awsEndpointFunctions),
/* harmony export */   getUserAgentPrefix: () => (/* reexport safe */ _lib_aws_partition__WEBPACK_IMPORTED_MODULE_1__.getUserAgentPrefix),
/* harmony export */   isIpAddress: () => (/* reexport safe */ _lib_isIpAddress__WEBPACK_IMPORTED_MODULE_2__.isIpAddress),
/* harmony export */   partition: () => (/* reexport safe */ _lib_aws_partition__WEBPACK_IMPORTED_MODULE_1__.partition),
/* harmony export */   resolveDefaultAwsRegionalEndpointsConfig: () => (/* reexport safe */ _resolveDefaultAwsRegionalEndpointsConfig__WEBPACK_IMPORTED_MODULE_3__.resolveDefaultAwsRegionalEndpointsConfig),
/* harmony export */   resolveEndpoint: () => (/* reexport safe */ _resolveEndpoint__WEBPACK_IMPORTED_MODULE_4__.resolveEndpoint),
/* harmony export */   setPartitionInfo: () => (/* reexport safe */ _lib_aws_partition__WEBPACK_IMPORTED_MODULE_1__.setPartitionInfo),
/* harmony export */   toEndpointV1: () => (/* reexport safe */ _resolveDefaultAwsRegionalEndpointsConfig__WEBPACK_IMPORTED_MODULE_3__.toEndpointV1),
/* harmony export */   useDefaultPartitionInfo: () => (/* reexport safe */ _lib_aws_partition__WEBPACK_IMPORTED_MODULE_1__.useDefaultPartitionInfo)
/* harmony export */ });
/* harmony import */ var _aws__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1961);
/* harmony import */ var _lib_aws_partition__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1968);
/* harmony import */ var _lib_isIpAddress__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1965);
/* harmony import */ var _resolveDefaultAwsRegionalEndpointsConfig__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1970);
/* harmony import */ var _resolveEndpoint__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(1971);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(1998);








/***/ }),

/***/ 1961:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   awsEndpointFunctions: () => (/* binding */ awsEndpointFunctions)
/* harmony export */ });
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1962);
/* harmony import */ var _lib_aws_isVirtualHostableS3Bucket__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1963);
/* harmony import */ var _lib_aws_parseArn__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1967);
/* harmony import */ var _lib_aws_partition__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1968);




const awsEndpointFunctions = {
    isVirtualHostableS3Bucket: _lib_aws_isVirtualHostableS3Bucket__WEBPACK_IMPORTED_MODULE_1__.isVirtualHostableS3Bucket,
    parseArn: _lib_aws_parseArn__WEBPACK_IMPORTED_MODULE_2__.parseArn,
    partition: _lib_aws_partition__WEBPACK_IMPORTED_MODULE_3__.partition,
};
_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.customEndpointFunctions.aws = awsEndpointFunctions;


/***/ }),

/***/ 1962:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   customEndpointFunctions: () => (/* binding */ customEndpointFunctions)
/* harmony export */ });
const customEndpointFunctions = {};


/***/ }),

/***/ 1963:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isVirtualHostableS3Bucket: () => (/* binding */ isVirtualHostableS3Bucket)
/* harmony export */ });
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1964);
/* harmony import */ var _isIpAddress__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1965);


const isVirtualHostableS3Bucket = (value, allowSubDomains = false) => {
    if (allowSubDomains) {
        for (const label of value.split(".")) {
            if (!isVirtualHostableS3Bucket(label)) {
                return false;
            }
        }
        return true;
    }
    if (!(0,_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.isValidHostLabel)(value)) {
        return false;
    }
    if (value.length < 3 || value.length > 63) {
        return false;
    }
    if (value !== value.toLowerCase()) {
        return false;
    }
    if ((0,_isIpAddress__WEBPACK_IMPORTED_MODULE_1__.isIpAddress)(value)) {
        return false;
    }
    return true;
};


/***/ }),

/***/ 1964:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isValidHostLabel: () => (/* binding */ isValidHostLabel)
/* harmony export */ });
const VALID_HOST_LABEL_REGEX = new RegExp(`^(?!.*-$)(?!-)[a-zA-Z0-9-]{1,63}$`);
const isValidHostLabel = (value, allowSubDomains = false) => {
    if (!allowSubDomains) {
        return VALID_HOST_LABEL_REGEX.test(value);
    }
    const labels = value.split(".");
    for (const label of labels) {
        if (!isValidHostLabel(label)) {
            return false;
        }
    }
    return true;
};


/***/ }),

/***/ 1965:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isIpAddress: () => (/* reexport safe */ _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.isIpAddress)
/* harmony export */ });
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1966);



/***/ }),

/***/ 1966:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isIpAddress: () => (/* binding */ isIpAddress)
/* harmony export */ });
const IP_V4_REGEX = new RegExp(`^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}$`);
const isIpAddress = (value) => IP_V4_REGEX.test(value) || (value.startsWith("[") && value.endsWith("]"));


/***/ }),

/***/ 1967:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parseArn: () => (/* binding */ parseArn)
/* harmony export */ });
const ARN_DELIMITER = ":";
const RESOURCE_DELIMITER = "/";
const parseArn = (value) => {
    const segments = value.split(ARN_DELIMITER);
    if (segments.length < 6)
        return null;
    const [arn, partition, service, region, accountId, ...resourcePath] = segments;
    if (arn !== "arn" || partition === "" || service === "" || resourcePath.join(ARN_DELIMITER) === "")
        return null;
    const resourceId = resourcePath.map((resource) => resource.split(RESOURCE_DELIMITER)).flat();
    return {
        partition,
        service,
        region,
        accountId,
        resourceId,
    };
};


/***/ }),

/***/ 1968:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getUserAgentPrefix: () => (/* binding */ getUserAgentPrefix),
/* harmony export */   partition: () => (/* binding */ partition),
/* harmony export */   setPartitionInfo: () => (/* binding */ setPartitionInfo),
/* harmony export */   useDefaultPartitionInfo: () => (/* binding */ useDefaultPartitionInfo)
/* harmony export */ });
/* harmony import */ var _partitions_json__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1969);

let selectedPartitionsInfo = _partitions_json__WEBPACK_IMPORTED_MODULE_0__;
let selectedUserAgentPrefix = "";
const partition = (value) => {
    const { partitions } = selectedPartitionsInfo;
    for (const partition of partitions) {
        const { regions, outputs } = partition;
        for (const [region, regionData] of Object.entries(regions)) {
            if (region === value) {
                return {
                    ...outputs,
                    ...regionData,
                };
            }
        }
    }
    for (const partition of partitions) {
        const { regionRegex, outputs } = partition;
        if (new RegExp(regionRegex).test(value)) {
            return {
                ...outputs,
            };
        }
    }
    const DEFAULT_PARTITION = partitions.find((partition) => partition.id === "aws");
    if (!DEFAULT_PARTITION) {
        throw new Error("Provided region was not found in the partition array or regex," +
            " and default partition with id 'aws' doesn't exist.");
    }
    return {
        ...DEFAULT_PARTITION.outputs,
    };
};
const setPartitionInfo = (partitionsInfo, userAgentPrefix = "") => {
    selectedPartitionsInfo = partitionsInfo;
    selectedUserAgentPrefix = userAgentPrefix;
};
const useDefaultPartitionInfo = () => {
    setPartitionInfo(_partitions_json__WEBPACK_IMPORTED_MODULE_0__, "");
};
const getUserAgentPrefix = () => selectedUserAgentPrefix;


/***/ }),

/***/ 1969:
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"partitions":[{"id":"aws","outputs":{"dnsSuffix":"amazonaws.com","dualStackDnsSuffix":"api.aws","implicitGlobalRegion":"us-east-1","name":"aws","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^(us|eu|ap|sa|ca|me|af|il|mx)\\\\-\\\\w+\\\\-\\\\d+$","regions":{"af-south-1":{"description":"Africa (Cape Town)"},"ap-east-1":{"description":"Asia Pacific (Hong Kong)"},"ap-east-2":{"description":"Asia Pacific (Taipei)"},"ap-northeast-1":{"description":"Asia Pacific (Tokyo)"},"ap-northeast-2":{"description":"Asia Pacific (Seoul)"},"ap-northeast-3":{"description":"Asia Pacific (Osaka)"},"ap-south-1":{"description":"Asia Pacific (Mumbai)"},"ap-south-2":{"description":"Asia Pacific (Hyderabad)"},"ap-southeast-1":{"description":"Asia Pacific (Singapore)"},"ap-southeast-2":{"description":"Asia Pacific (Sydney)"},"ap-southeast-3":{"description":"Asia Pacific (Jakarta)"},"ap-southeast-4":{"description":"Asia Pacific (Melbourne)"},"ap-southeast-5":{"description":"Asia Pacific (Malaysia)"},"ap-southeast-6":{"description":"Asia Pacific (New Zealand)"},"ap-southeast-7":{"description":"Asia Pacific (Thailand)"},"aws-global":{"description":"aws global region"},"ca-central-1":{"description":"Canada (Central)"},"ca-west-1":{"description":"Canada West (Calgary)"},"eu-central-1":{"description":"Europe (Frankfurt)"},"eu-central-2":{"description":"Europe (Zurich)"},"eu-north-1":{"description":"Europe (Stockholm)"},"eu-south-1":{"description":"Europe (Milan)"},"eu-south-2":{"description":"Europe (Spain)"},"eu-west-1":{"description":"Europe (Ireland)"},"eu-west-2":{"description":"Europe (London)"},"eu-west-3":{"description":"Europe (Paris)"},"il-central-1":{"description":"Israel (Tel Aviv)"},"me-central-1":{"description":"Middle East (UAE)"},"me-south-1":{"description":"Middle East (Bahrain)"},"mx-central-1":{"description":"Mexico (Central)"},"sa-east-1":{"description":"South America (Sao Paulo)"},"us-east-1":{"description":"US East (N. Virginia)"},"us-east-2":{"description":"US East (Ohio)"},"us-west-1":{"description":"US West (N. California)"},"us-west-2":{"description":"US West (Oregon)"}}},{"id":"aws-cn","outputs":{"dnsSuffix":"amazonaws.com.cn","dualStackDnsSuffix":"api.amazonwebservices.com.cn","implicitGlobalRegion":"cn-northwest-1","name":"aws-cn","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^cn\\\\-\\\\w+\\\\-\\\\d+$","regions":{"aws-cn-global":{"description":"aws-cn global region"},"cn-north-1":{"description":"China (Beijing)"},"cn-northwest-1":{"description":"China (Ningxia)"}}},{"id":"aws-eusc","outputs":{"dnsSuffix":"amazonaws.eu","dualStackDnsSuffix":"api.amazonwebservices.eu","implicitGlobalRegion":"eusc-de-east-1","name":"aws-eusc","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^eusc\\\\-(de)\\\\-\\\\w+\\\\-\\\\d+$","regions":{"eusc-de-east-1":{"description":"EU (Germany)"}}},{"id":"aws-iso","outputs":{"dnsSuffix":"c2s.ic.gov","dualStackDnsSuffix":"api.aws.ic.gov","implicitGlobalRegion":"us-iso-east-1","name":"aws-iso","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^us\\\\-iso\\\\-\\\\w+\\\\-\\\\d+$","regions":{"aws-iso-global":{"description":"aws-iso global region"},"us-iso-east-1":{"description":"US ISO East"},"us-iso-west-1":{"description":"US ISO WEST"}}},{"id":"aws-iso-b","outputs":{"dnsSuffix":"sc2s.sgov.gov","dualStackDnsSuffix":"api.aws.scloud","implicitGlobalRegion":"us-isob-east-1","name":"aws-iso-b","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^us\\\\-isob\\\\-\\\\w+\\\\-\\\\d+$","regions":{"aws-iso-b-global":{"description":"aws-iso-b global region"},"us-isob-east-1":{"description":"US ISOB East (Ohio)"},"us-isob-west-1":{"description":"US ISOB West"}}},{"id":"aws-iso-e","outputs":{"dnsSuffix":"cloud.adc-e.uk","dualStackDnsSuffix":"api.cloud-aws.adc-e.uk","implicitGlobalRegion":"eu-isoe-west-1","name":"aws-iso-e","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^eu\\\\-isoe\\\\-\\\\w+\\\\-\\\\d+$","regions":{"aws-iso-e-global":{"description":"aws-iso-e global region"},"eu-isoe-west-1":{"description":"EU ISOE West"}}},{"id":"aws-iso-f","outputs":{"dnsSuffix":"csp.hci.ic.gov","dualStackDnsSuffix":"api.aws.hci.ic.gov","implicitGlobalRegion":"us-isof-south-1","name":"aws-iso-f","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^us\\\\-isof\\\\-\\\\w+\\\\-\\\\d+$","regions":{"aws-iso-f-global":{"description":"aws-iso-f global region"},"us-isof-east-1":{"description":"US ISOF EAST"},"us-isof-south-1":{"description":"US ISOF SOUTH"}}},{"id":"aws-us-gov","outputs":{"dnsSuffix":"amazonaws.com","dualStackDnsSuffix":"api.aws","implicitGlobalRegion":"us-gov-west-1","name":"aws-us-gov","supportsDualStack":true,"supportsFIPS":true},"regionRegex":"^us\\\\-gov\\\\-\\\\w+\\\\-\\\\d+$","regions":{"aws-us-gov-global":{"description":"aws-us-gov global region"},"us-gov-east-1":{"description":"AWS GovCloud (US-East)"},"us-gov-west-1":{"description":"AWS GovCloud (US-West)"}}}],"version":"1.1"}');

/***/ }),

/***/ 1970:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveDefaultAwsRegionalEndpointsConfig: () => (/* binding */ resolveDefaultAwsRegionalEndpointsConfig),
/* harmony export */   toEndpointV1: () => (/* binding */ toEndpointV1)
/* harmony export */ });
/* harmony import */ var _smithy_url_parser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1407);

const resolveDefaultAwsRegionalEndpointsConfig = (input) => {
    if (typeof input.endpointProvider !== "function") {
        throw new Error("@aws-sdk/util-endpoint - endpointProvider and endpoint missing in config for this client.");
    }
    const { endpoint } = input;
    if (endpoint === undefined) {
        input.endpoint = async () => {
            return toEndpointV1(input.endpointProvider({
                Region: typeof input.region === "function" ? await input.region() : input.region,
                UseDualStack: typeof input.useDualstackEndpoint === "function"
                    ? await input.useDualstackEndpoint()
                    : input.useDualstackEndpoint,
                UseFIPS: typeof input.useFipsEndpoint === "function" ? await input.useFipsEndpoint() : input.useFipsEndpoint,
                Endpoint: undefined,
            }, { logger: input.logger }));
        };
    }
    return input;
};
const toEndpointV1 = (endpoint) => (0,_smithy_url_parser__WEBPACK_IMPORTED_MODULE_0__.parseUrl)(endpoint.url);


/***/ }),

/***/ 1971:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveEndpoint: () => (/* reexport safe */ _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.resolveEndpoint)
/* harmony export */ });
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1972);



/***/ }),

/***/ 1972:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveEndpoint: () => (/* binding */ resolveEndpoint)
/* harmony export */ });
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1973);
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1974);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1975);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1976);



const resolveEndpoint = (ruleSetObject, options) => {
    const { endpointParams, logger } = options;
    const { parameters, rules } = ruleSetObject;
    options.logger?.debug?.(`${_debug__WEBPACK_IMPORTED_MODULE_0__.debugId} Initial EndpointParams: ${(0,_debug__WEBPACK_IMPORTED_MODULE_1__.toDebugString)(endpointParams)}`);
    const paramsWithDefault = Object.entries(parameters)
        .filter(([, v]) => v.default != null)
        .map(([k, v]) => [k, v.default]);
    if (paramsWithDefault.length > 0) {
        for (const [paramKey, paramDefaultValue] of paramsWithDefault) {
            endpointParams[paramKey] = endpointParams[paramKey] ?? paramDefaultValue;
        }
    }
    const requiredParams = Object.entries(parameters)
        .filter(([, v]) => v.required)
        .map(([k]) => k);
    for (const requiredParam of requiredParams) {
        if (endpointParams[requiredParam] == null) {
            throw new _types__WEBPACK_IMPORTED_MODULE_2__.EndpointError(`Missing required parameter: '${requiredParam}'`);
        }
    }
    const endpoint = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.evaluateRules)(rules, { endpointParams, logger, referenceRecord: {} });
    options.logger?.debug?.(`${_debug__WEBPACK_IMPORTED_MODULE_0__.debugId} Resolved endpoint: ${(0,_debug__WEBPACK_IMPORTED_MODULE_1__.toDebugString)(endpoint)}`);
    return endpoint;
};


/***/ }),

/***/ 1973:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   debugId: () => (/* binding */ debugId)
/* harmony export */ });
const debugId = "endpoints";


/***/ }),

/***/ 1974:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   toDebugString: () => (/* binding */ toDebugString)
/* harmony export */ });
function toDebugString(input) {
    if (typeof input !== "object" || input == null) {
        return input;
    }
    if ("ref" in input) {
        return `$${toDebugString(input.ref)}`;
    }
    if ("fn" in input) {
        return `${input.fn}(${(input.argv || []).map(toDebugString).join(", ")})`;
    }
    return JSON.stringify(input, null, 2);
}


/***/ }),

/***/ 1975:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EndpointError: () => (/* binding */ EndpointError)
/* harmony export */ });
class EndpointError extends Error {
    constructor(message) {
        super(message);
        this.name = "EndpointError";
    }
}


/***/ }),

/***/ 1976:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   evaluateRules: () => (/* binding */ evaluateRules),
/* harmony export */   evaluateTreeRule: () => (/* binding */ evaluateTreeRule),
/* harmony export */   group: () => (/* binding */ group)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);
/* harmony import */ var _evaluateConditions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1977);
/* harmony import */ var _evaluateEndpointRule__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1993);
/* harmony import */ var _evaluateErrorRule__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1997);




const evaluateRules = (rules, options) => {
    for (const rule of rules) {
        if (rule.type === "endpoint") {
            const endpointOrUndefined = (0,_evaluateEndpointRule__WEBPACK_IMPORTED_MODULE_2__.evaluateEndpointRule)(rule, options);
            if (endpointOrUndefined) {
                return endpointOrUndefined;
            }
        }
        else if (rule.type === "error") {
            (0,_evaluateErrorRule__WEBPACK_IMPORTED_MODULE_3__.evaluateErrorRule)(rule, options);
        }
        else if (rule.type === "tree") {
            const endpointOrUndefined = group.evaluateTreeRule(rule, options);
            if (endpointOrUndefined) {
                return endpointOrUndefined;
            }
        }
        else {
            throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Unknown endpoint rule: ${rule}`);
        }
    }
    throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Rules evaluation failed`);
};
const evaluateTreeRule = (treeRule, options) => {
    const { conditions, rules } = treeRule;
    const { result, referenceRecord } = (0,_evaluateConditions__WEBPACK_IMPORTED_MODULE_1__.evaluateConditions)(conditions, options);
    if (!result) {
        return;
    }
    return group.evaluateRules(rules, {
        ...options,
        referenceRecord: { ...options.referenceRecord, ...referenceRecord },
    });
};
const group = {
    evaluateRules,
    evaluateTreeRule,
};


/***/ }),

/***/ 1977:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   evaluateConditions: () => (/* binding */ evaluateConditions)
/* harmony export */ });
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1973);
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1974);
/* harmony import */ var _evaluateCondition__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1978);


const evaluateConditions = (conditions = [], options) => {
    const conditionsReferenceRecord = {};
    for (const condition of conditions) {
        const { result, toAssign } = (0,_evaluateCondition__WEBPACK_IMPORTED_MODULE_2__.evaluateCondition)(condition, {
            ...options,
            referenceRecord: {
                ...options.referenceRecord,
                ...conditionsReferenceRecord,
            },
        });
        if (!result) {
            return { result };
        }
        if (toAssign) {
            conditionsReferenceRecord[toAssign.name] = toAssign.value;
            options.logger?.debug?.(`${_debug__WEBPACK_IMPORTED_MODULE_0__.debugId} assign: ${toAssign.name} := ${(0,_debug__WEBPACK_IMPORTED_MODULE_1__.toDebugString)(toAssign.value)}`);
        }
    }
    return { result: true, referenceRecord: conditionsReferenceRecord };
};


/***/ }),

/***/ 1978:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   evaluateCondition: () => (/* binding */ evaluateCondition)
/* harmony export */ });
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1973);
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1974);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1975);
/* harmony import */ var _callFunction__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1979);



const evaluateCondition = ({ assign, ...fnArgs }, options) => {
    if (assign && assign in options.referenceRecord) {
        throw new _types__WEBPACK_IMPORTED_MODULE_2__.EndpointError(`'${assign}' is already defined in Reference Record.`);
    }
    const value = (0,_callFunction__WEBPACK_IMPORTED_MODULE_3__.callFunction)(fnArgs, options);
    options.logger?.debug?.(`${_debug__WEBPACK_IMPORTED_MODULE_0__.debugId} evaluateCondition: ${(0,_debug__WEBPACK_IMPORTED_MODULE_1__.toDebugString)(fnArgs)} = ${(0,_debug__WEBPACK_IMPORTED_MODULE_1__.toDebugString)(value)}`);
    return {
        result: value === "" ? true : !!value,
        ...(assign != null && { toAssign: { name: assign, value } }),
    };
};


/***/ }),

/***/ 1979:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   callFunction: () => (/* binding */ callFunction),
/* harmony export */   evaluateExpression: () => (/* binding */ evaluateExpression),
/* harmony export */   group: () => (/* binding */ group)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);
/* harmony import */ var _customEndpointFunctions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1962);
/* harmony import */ var _endpointFunctions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1980);
/* harmony import */ var _evaluateTemplate__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1991);
/* harmony import */ var _getReferenceValue__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(1992);





const evaluateExpression = (obj, keyName, options) => {
    if (typeof obj === "string") {
        return (0,_evaluateTemplate__WEBPACK_IMPORTED_MODULE_3__.evaluateTemplate)(obj, options);
    }
    else if (obj["fn"]) {
        return group.callFunction(obj, options);
    }
    else if (obj["ref"]) {
        return (0,_getReferenceValue__WEBPACK_IMPORTED_MODULE_4__.getReferenceValue)(obj, options);
    }
    throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`'${keyName}': ${String(obj)} is not a string, function or reference.`);
};
const callFunction = ({ fn, argv }, options) => {
    const evaluatedArgs = argv.map((arg) => ["boolean", "number"].includes(typeof arg) ? arg : group.evaluateExpression(arg, "arg", options));
    const fnSegments = fn.split(".");
    if (fnSegments[0] in _customEndpointFunctions__WEBPACK_IMPORTED_MODULE_1__.customEndpointFunctions && fnSegments[1] != null) {
        return _customEndpointFunctions__WEBPACK_IMPORTED_MODULE_1__.customEndpointFunctions[fnSegments[0]][fnSegments[1]](...evaluatedArgs);
    }
    return _endpointFunctions__WEBPACK_IMPORTED_MODULE_2__.endpointFunctions[fn](...evaluatedArgs);
};
const group = {
    evaluateExpression,
    callFunction,
};


/***/ }),

/***/ 1980:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   endpointFunctions: () => (/* binding */ endpointFunctions)
/* harmony export */ });
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1981);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1982);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1984);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1964);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(1985);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(1986);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(1988);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(1989);
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(1990);

const endpointFunctions = {
    booleanEquals: _lib__WEBPACK_IMPORTED_MODULE_0__.booleanEquals,
    getAttr: _lib__WEBPACK_IMPORTED_MODULE_1__.getAttr,
    isSet: _lib__WEBPACK_IMPORTED_MODULE_2__.isSet,
    isValidHostLabel: _lib__WEBPACK_IMPORTED_MODULE_3__.isValidHostLabel,
    not: _lib__WEBPACK_IMPORTED_MODULE_4__.not,
    parseURL: _lib__WEBPACK_IMPORTED_MODULE_5__.parseURL,
    stringEquals: _lib__WEBPACK_IMPORTED_MODULE_6__.stringEquals,
    substring: _lib__WEBPACK_IMPORTED_MODULE_7__.substring,
    uriEncode: _lib__WEBPACK_IMPORTED_MODULE_8__.uriEncode,
};


/***/ }),

/***/ 1981:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   booleanEquals: () => (/* binding */ booleanEquals)
/* harmony export */ });
const booleanEquals = (value1, value2) => value1 === value2;


/***/ }),

/***/ 1982:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getAttr: () => (/* binding */ getAttr)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);
/* harmony import */ var _getAttrPathList__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1983);


const getAttr = (value, path) => (0,_getAttrPathList__WEBPACK_IMPORTED_MODULE_1__.getAttrPathList)(path).reduce((acc, index) => {
    if (typeof acc !== "object") {
        throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Index '${index}' in '${path}' not found in '${JSON.stringify(value)}'`);
    }
    else if (Array.isArray(acc)) {
        return acc[parseInt(index)];
    }
    return acc[index];
}, value);


/***/ }),

/***/ 1983:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getAttrPathList: () => (/* binding */ getAttrPathList)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);

const getAttrPathList = (path) => {
    const parts = path.split(".");
    const pathList = [];
    for (const part of parts) {
        const squareBracketIndex = part.indexOf("[");
        if (squareBracketIndex !== -1) {
            if (part.indexOf("]") !== part.length - 1) {
                throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Path: '${path}' does not end with ']'`);
            }
            const arrayIndex = part.slice(squareBracketIndex + 1, -1);
            if (Number.isNaN(parseInt(arrayIndex))) {
                throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Invalid array index: '${arrayIndex}' in path: '${path}'`);
            }
            if (squareBracketIndex !== 0) {
                pathList.push(part.slice(0, squareBracketIndex));
            }
            pathList.push(arrayIndex);
        }
        else {
            pathList.push(part);
        }
    }
    return pathList;
};


/***/ }),

/***/ 1984:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isSet: () => (/* binding */ isSet)
/* harmony export */ });
const isSet = (value) => value != null;


/***/ }),

/***/ 1985:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   not: () => (/* binding */ not)
/* harmony export */ });
const not = (value) => !value;


/***/ }),

/***/ 1986:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parseURL: () => (/* binding */ parseURL)
/* harmony export */ });
/* harmony import */ var _smithy_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1987);
/* harmony import */ var _isIpAddress__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1966);


const DEFAULT_PORTS = {
    [_smithy_types__WEBPACK_IMPORTED_MODULE_0__.EndpointURLScheme.HTTP]: 80,
    [_smithy_types__WEBPACK_IMPORTED_MODULE_0__.EndpointURLScheme.HTTPS]: 443,
};
const parseURL = (value) => {
    const whatwgURL = (() => {
        try {
            if (value instanceof URL) {
                return value;
            }
            if (typeof value === "object" && "hostname" in value) {
                const { hostname, port, protocol = "", path = "", query = {} } = value;
                const url = new URL(`${protocol}//${hostname}${port ? `:${port}` : ""}${path}`);
                url.search = Object.entries(query)
                    .map(([k, v]) => `${k}=${v}`)
                    .join("&");
                return url;
            }
            return new URL(value);
        }
        catch (error) {
            return null;
        }
    })();
    if (!whatwgURL) {
        console.error(`Unable to parse ${JSON.stringify(value)} as a whatwg URL.`);
        return null;
    }
    const urlString = whatwgURL.href;
    const { host, hostname, pathname, protocol, search } = whatwgURL;
    if (search) {
        return null;
    }
    const scheme = protocol.slice(0, -1);
    if (!Object.values(_smithy_types__WEBPACK_IMPORTED_MODULE_0__.EndpointURLScheme).includes(scheme)) {
        return null;
    }
    const isIp = (0,_isIpAddress__WEBPACK_IMPORTED_MODULE_1__.isIpAddress)(hostname);
    const inputContainsDefaultPort = urlString.includes(`${host}:${DEFAULT_PORTS[scheme]}`) ||
        (typeof value === "string" && value.includes(`${host}:${DEFAULT_PORTS[scheme]}`));
    const authority = `${host}${inputContainsDefaultPort ? `:${DEFAULT_PORTS[scheme]}` : ``}`;
    return {
        scheme,
        authority,
        path: pathname,
        normalizedPath: pathname.endsWith("/") ? pathname : `${pathname}/`,
        isIp,
    };
};


/***/ }),

/***/ 1987:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EndpointURLScheme: () => (/* binding */ EndpointURLScheme)
/* harmony export */ });
var EndpointURLScheme;
(function (EndpointURLScheme) {
    EndpointURLScheme["HTTP"] = "http";
    EndpointURLScheme["HTTPS"] = "https";
})(EndpointURLScheme || (EndpointURLScheme = {}));


/***/ }),

/***/ 1988:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   stringEquals: () => (/* binding */ stringEquals)
/* harmony export */ });
const stringEquals = (value1, value2) => value1 === value2;


/***/ }),

/***/ 1989:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   substring: () => (/* binding */ substring)
/* harmony export */ });
const substring = (input, start, stop, reverse) => {
    if (start >= stop || input.length < stop) {
        return null;
    }
    if (!reverse) {
        return input.substring(start, stop);
    }
    return input.substring(input.length - stop, input.length - start);
};


/***/ }),

/***/ 1990:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   uriEncode: () => (/* binding */ uriEncode)
/* harmony export */ });
const uriEncode = (value) => encodeURIComponent(value).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);


/***/ }),

/***/ 1991:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   evaluateTemplate: () => (/* binding */ evaluateTemplate)
/* harmony export */ });
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1982);

const evaluateTemplate = (template, options) => {
    const evaluatedTemplateArr = [];
    const templateContext = {
        ...options.endpointParams,
        ...options.referenceRecord,
    };
    let currentIndex = 0;
    while (currentIndex < template.length) {
        const openingBraceIndex = template.indexOf("{", currentIndex);
        if (openingBraceIndex === -1) {
            evaluatedTemplateArr.push(template.slice(currentIndex));
            break;
        }
        evaluatedTemplateArr.push(template.slice(currentIndex, openingBraceIndex));
        const closingBraceIndex = template.indexOf("}", openingBraceIndex);
        if (closingBraceIndex === -1) {
            evaluatedTemplateArr.push(template.slice(openingBraceIndex));
            break;
        }
        if (template[openingBraceIndex + 1] === "{" && template[closingBraceIndex + 1] === "}") {
            evaluatedTemplateArr.push(template.slice(openingBraceIndex + 1, closingBraceIndex));
            currentIndex = closingBraceIndex + 2;
        }
        const parameterName = template.substring(openingBraceIndex + 1, closingBraceIndex);
        if (parameterName.includes("#")) {
            const [refName, attrName] = parameterName.split("#");
            evaluatedTemplateArr.push((0,_lib__WEBPACK_IMPORTED_MODULE_0__.getAttr)(templateContext[refName], attrName));
        }
        else {
            evaluatedTemplateArr.push(templateContext[parameterName]);
        }
        currentIndex = closingBraceIndex + 1;
    }
    return evaluatedTemplateArr.join("");
};


/***/ }),

/***/ 1992:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getReferenceValue: () => (/* binding */ getReferenceValue)
/* harmony export */ });
const getReferenceValue = ({ ref }, options) => {
    const referenceRecord = {
        ...options.endpointParams,
        ...options.referenceRecord,
    };
    return referenceRecord[ref];
};


/***/ }),

/***/ 1993:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   evaluateEndpointRule: () => (/* binding */ evaluateEndpointRule)
/* harmony export */ });
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1973);
/* harmony import */ var _debug__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1974);
/* harmony import */ var _evaluateConditions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1977);
/* harmony import */ var _getEndpointHeaders__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1994);
/* harmony import */ var _getEndpointProperties__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(1995);
/* harmony import */ var _getEndpointUrl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(1996);





const evaluateEndpointRule = (endpointRule, options) => {
    const { conditions, endpoint } = endpointRule;
    const { result, referenceRecord } = (0,_evaluateConditions__WEBPACK_IMPORTED_MODULE_2__.evaluateConditions)(conditions, options);
    if (!result) {
        return;
    }
    const endpointRuleOptions = {
        ...options,
        referenceRecord: { ...options.referenceRecord, ...referenceRecord },
    };
    const { url, properties, headers } = endpoint;
    options.logger?.debug?.(`${_debug__WEBPACK_IMPORTED_MODULE_0__.debugId} Resolving endpoint from template: ${(0,_debug__WEBPACK_IMPORTED_MODULE_1__.toDebugString)(endpoint)}`);
    return {
        ...(headers != undefined && {
            headers: (0,_getEndpointHeaders__WEBPACK_IMPORTED_MODULE_3__.getEndpointHeaders)(headers, endpointRuleOptions),
        }),
        ...(properties != undefined && {
            properties: (0,_getEndpointProperties__WEBPACK_IMPORTED_MODULE_4__.getEndpointProperties)(properties, endpointRuleOptions),
        }),
        url: (0,_getEndpointUrl__WEBPACK_IMPORTED_MODULE_5__.getEndpointUrl)(url, endpointRuleOptions),
    };
};


/***/ }),

/***/ 1994:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getEndpointHeaders: () => (/* binding */ getEndpointHeaders)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);
/* harmony import */ var _evaluateExpression__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1979);


const getEndpointHeaders = (headers, options) => Object.entries(headers).reduce((acc, [headerKey, headerVal]) => ({
    ...acc,
    [headerKey]: headerVal.map((headerValEntry) => {
        const processedExpr = (0,_evaluateExpression__WEBPACK_IMPORTED_MODULE_1__.evaluateExpression)(headerValEntry, "Header value entry", options);
        if (typeof processedExpr !== "string") {
            throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Header '${headerKey}' value '${processedExpr}' is not a string`);
        }
        return processedExpr;
    }),
}), {});


/***/ }),

/***/ 1995:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getEndpointProperties: () => (/* binding */ getEndpointProperties),
/* harmony export */   getEndpointProperty: () => (/* binding */ getEndpointProperty),
/* harmony export */   group: () => (/* binding */ group)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);
/* harmony import */ var _evaluateTemplate__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1991);


const getEndpointProperties = (properties, options) => Object.entries(properties).reduce((acc, [propertyKey, propertyVal]) => ({
    ...acc,
    [propertyKey]: group.getEndpointProperty(propertyVal, options),
}), {});
const getEndpointProperty = (property, options) => {
    if (Array.isArray(property)) {
        return property.map((propertyEntry) => getEndpointProperty(propertyEntry, options));
    }
    switch (typeof property) {
        case "string":
            return (0,_evaluateTemplate__WEBPACK_IMPORTED_MODULE_1__.evaluateTemplate)(property, options);
        case "object":
            if (property === null) {
                throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Unexpected endpoint property: ${property}`);
            }
            return group.getEndpointProperties(property, options);
        case "boolean":
            return property;
        default:
            throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Unexpected endpoint property type: ${typeof property}`);
    }
};
const group = {
    getEndpointProperty,
    getEndpointProperties,
};


/***/ }),

/***/ 1996:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getEndpointUrl: () => (/* binding */ getEndpointUrl)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);
/* harmony import */ var _evaluateExpression__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1979);


const getEndpointUrl = (endpointUrl, options) => {
    const expression = (0,_evaluateExpression__WEBPACK_IMPORTED_MODULE_1__.evaluateExpression)(endpointUrl, "Endpoint URL", options);
    if (typeof expression === "string") {
        try {
            return new URL(expression);
        }
        catch (error) {
            console.error(`Failed to construct URL with ${expression}`, error);
            throw error;
        }
    }
    throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError(`Endpoint URL must be a string, got ${typeof expression}`);
};


/***/ }),

/***/ 1997:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   evaluateErrorRule: () => (/* binding */ evaluateErrorRule)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);
/* harmony import */ var _evaluateConditions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1977);
/* harmony import */ var _evaluateExpression__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1979);



const evaluateErrorRule = (errorRule, options) => {
    const { conditions, error } = errorRule;
    const { result, referenceRecord } = (0,_evaluateConditions__WEBPACK_IMPORTED_MODULE_1__.evaluateConditions)(conditions, options);
    if (!result) {
        return;
    }
    throw new _types__WEBPACK_IMPORTED_MODULE_0__.EndpointError((0,_evaluateExpression__WEBPACK_IMPORTED_MODULE_2__.evaluateExpression)(error, "Error", {
        ...options,
        referenceRecord: { ...options.referenceRecord, ...referenceRecord },
    }));
};


/***/ }),

/***/ 1998:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EndpointError: () => (/* reexport safe */ _EndpointError__WEBPACK_IMPORTED_MODULE_0__.EndpointError)
/* harmony export */ });
/* harmony import */ var _EndpointError__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1999);
/* harmony import */ var _EndpointRuleObject__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2000);
/* harmony import */ var _ErrorRuleObject__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2001);
/* harmony import */ var _RuleSetObject__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2002);
/* harmony import */ var _TreeRuleObject__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2003);
/* harmony import */ var _shared__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(2004);








/***/ }),

/***/ 1999:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EndpointError: () => (/* reexport safe */ _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.EndpointError)
/* harmony export */ });
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1975);



/***/ }),

/***/ 2000:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);



/***/ }),

/***/ 2001:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);



/***/ }),

/***/ 2002:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);



/***/ }),

/***/ 2003:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);



/***/ }),

/***/ 2004:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);



/***/ }),

/***/ 2005:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   checkFeatures: () => (/* binding */ checkFeatures)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2006);

const ACCOUNT_ID_ENDPOINT_REGEX = /\d{12}\.ddb/;
async function checkFeatures(context, config, args) {
    const request = args.request;
    if (request?.headers?.["smithy-protocol"] === "rpc-v2-cbor") {
        (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "PROTOCOL_RPC_V2_CBOR", "M");
    }
    if (typeof config.retryStrategy === "function") {
        const retryStrategy = await config.retryStrategy();
        if (typeof retryStrategy.acquireInitialRetryToken === "function") {
            if (retryStrategy.constructor?.name?.includes("Adaptive")) {
                (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "RETRY_MODE_ADAPTIVE", "F");
            }
            else {
                (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "RETRY_MODE_STANDARD", "E");
            }
        }
        else {
            (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "RETRY_MODE_LEGACY", "D");
        }
    }
    if (typeof config.accountIdEndpointMode === "function") {
        const endpointV2 = context.endpointV2;
        if (String(endpointV2?.url?.hostname).match(ACCOUNT_ID_ENDPOINT_REGEX)) {
            (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "ACCOUNT_ID_ENDPOINT", "O");
        }
        switch (await config.accountIdEndpointMode?.()) {
            case "disabled":
                (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "ACCOUNT_ID_MODE_DISABLED", "Q");
                break;
            case "preferred":
                (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "ACCOUNT_ID_MODE_PREFERRED", "P");
                break;
            case "required":
                (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "ACCOUNT_ID_MODE_REQUIRED", "R");
                break;
        }
    }
    const identity = context.__smithy_context?.selectedHttpAuthScheme?.identity;
    if (identity?.$source) {
        const credentials = identity;
        if (credentials.accountId) {
            (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "RESOLVED_ACCOUNT_ID", "T");
        }
        for (const [key, value] of Object.entries(credentials.$source ?? {})) {
            (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, key, value);
        }
    }
}


/***/ }),

/***/ 2006:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   setFeature: () => (/* binding */ setFeature)
/* harmony export */ });
function setFeature(context, feature, value) {
    if (!context.__aws_sdk_context) {
        context.__aws_sdk_context = {
            features: {},
        };
    }
    else if (!context.__aws_sdk_context.features) {
        context.__aws_sdk_context.features = {};
    }
    context.__aws_sdk_context.features[feature] = value;
}


/***/ }),

/***/ 2007:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SPACE: () => (/* binding */ SPACE),
/* harmony export */   UA_ESCAPE_CHAR: () => (/* binding */ UA_ESCAPE_CHAR),
/* harmony export */   UA_NAME_ESCAPE_REGEX: () => (/* binding */ UA_NAME_ESCAPE_REGEX),
/* harmony export */   UA_NAME_SEPARATOR: () => (/* binding */ UA_NAME_SEPARATOR),
/* harmony export */   UA_VALUE_ESCAPE_REGEX: () => (/* binding */ UA_VALUE_ESCAPE_REGEX),
/* harmony export */   USER_AGENT: () => (/* binding */ USER_AGENT),
/* harmony export */   X_AMZ_USER_AGENT: () => (/* binding */ X_AMZ_USER_AGENT)
/* harmony export */ });
const USER_AGENT = "user-agent";
const X_AMZ_USER_AGENT = "x-amz-user-agent";
const SPACE = " ";
const UA_NAME_SEPARATOR = "/";
const UA_NAME_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w]/g;
const UA_VALUE_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w#]/g;
const UA_ESCAPE_CHAR = "-";


/***/ }),

/***/ 2008:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   encodeFeatures: () => (/* binding */ encodeFeatures)
/* harmony export */ });
const BYTE_LIMIT = 1024;
function encodeFeatures(features) {
    let buffer = "";
    for (const key in features) {
        const val = features[key];
        if (buffer.length + val.length + 1 <= BYTE_LIMIT) {
            if (buffer.length) {
                buffer += "," + val;
            }
            else {
                buffer += val;
            }
            continue;
        }
        break;
    }
    return buffer;
}


/***/ }),

/***/ 2009:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveRegionConfig: () => (/* binding */ resolveRegionConfig)
/* harmony export */ });
/* harmony import */ var _checkRegion__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2010);
/* harmony import */ var _getRealRegion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2011);
/* harmony import */ var _isFipsRegion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2012);



const resolveRegionConfig = (input) => {
    const { region, useFipsEndpoint } = input;
    if (!region) {
        throw new Error("Region is missing");
    }
    return Object.assign(input, {
        region: async () => {
            const providedRegion = typeof region === "function" ? await region() : region;
            const realRegion = (0,_getRealRegion__WEBPACK_IMPORTED_MODULE_1__.getRealRegion)(providedRegion);
            (0,_checkRegion__WEBPACK_IMPORTED_MODULE_0__.checkRegion)(realRegion);
            return realRegion;
        },
        useFipsEndpoint: async () => {
            const providedRegion = typeof region === "string" ? region : await region();
            if ((0,_isFipsRegion__WEBPACK_IMPORTED_MODULE_2__.isFipsRegion)(providedRegion)) {
                return true;
            }
            return typeof useFipsEndpoint !== "function" ? Promise.resolve(!!useFipsEndpoint) : useFipsEndpoint();
        },
    });
};


/***/ }),

/***/ 2010:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   checkRegion: () => (/* binding */ checkRegion)
/* harmony export */ });
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1964);

const validRegions = new Set();
const checkRegion = (region, check = _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.isValidHostLabel) => {
    if (!validRegions.has(region) && !check(region)) {
        if (region === "*") {
            console.warn(`@smithy/config-resolver WARN - Please use the caller region instead of "*". See "sigv4a" in https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/CLIENTS.md.`);
        }
        else {
            throw new Error(`Region not accepted: region="${region}" is not a valid hostname component.`);
        }
    }
    else {
        validRegions.add(region);
    }
};


/***/ }),

/***/ 2011:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRealRegion: () => (/* binding */ getRealRegion)
/* harmony export */ });
/* harmony import */ var _isFipsRegion__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2012);

const getRealRegion = (region) => (0,_isFipsRegion__WEBPACK_IMPORTED_MODULE_0__.isFipsRegion)(region)
    ? ["fips-aws-global", "aws-fips"].includes(region)
        ? "us-east-1"
        : region.replace(/fips-(dkr-|prod-)?|-fips/, "")
    : region;


/***/ }),

/***/ 2012:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isFipsRegion: () => (/* binding */ isFipsRegion)
/* harmony export */ });
const isFipsRegion = (region) => typeof region === "string" && (region.startsWith("fips-") || region.endsWith("-fips"));


/***/ }),

/***/ 2013:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DefaultIdentityProviderConfig: () => (/* binding */ DefaultIdentityProviderConfig)
/* harmony export */ });
class DefaultIdentityProviderConfig {
    authSchemes = new Map();
    constructor(config) {
        for (const [key, value] of Object.entries(config)) {
            if (value !== undefined) {
                this.authSchemes.set(key, value);
            }
        }
    }
    getIdentityProvider(schemeId) {
        return this.authSchemes.get(schemeId);
    }
}


/***/ }),

/***/ 2014:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getHttpAuthSchemeEndpointRuleSetPlugin: () => (/* binding */ getHttpAuthSchemeEndpointRuleSetPlugin),
/* harmony export */   httpAuthSchemeEndpointRuleSetMiddlewareOptions: () => (/* binding */ httpAuthSchemeEndpointRuleSetMiddlewareOptions)
/* harmony export */ });
/* harmony import */ var _httpAuthSchemeMiddleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2015);

const httpAuthSchemeEndpointRuleSetMiddlewareOptions = {
    step: "serialize",
    tags: ["HTTP_AUTH_SCHEME"],
    name: "httpAuthSchemeMiddleware",
    override: true,
    relation: "before",
    toMiddleware: "endpointV2Middleware",
};
const getHttpAuthSchemeEndpointRuleSetPlugin = (config, { httpAuthSchemeParametersProvider, identityProviderConfigProvider, }) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo((0,_httpAuthSchemeMiddleware__WEBPACK_IMPORTED_MODULE_0__.httpAuthSchemeMiddleware)(config, {
            httpAuthSchemeParametersProvider,
            identityProviderConfigProvider,
        }), httpAuthSchemeEndpointRuleSetMiddlewareOptions);
    },
});


/***/ }),

/***/ 2015:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   httpAuthSchemeMiddleware: () => (/* binding */ httpAuthSchemeMiddleware)
/* harmony export */ });
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2016);
/* harmony import */ var _resolveAuthOptions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2018);


function convertHttpAuthSchemesToMap(httpAuthSchemes) {
    const map = new Map();
    for (const scheme of httpAuthSchemes) {
        map.set(scheme.schemeId, scheme);
    }
    return map;
}
const httpAuthSchemeMiddleware = (config, mwOptions) => (next, context) => async (args) => {
    const options = config.httpAuthSchemeProvider(await mwOptions.httpAuthSchemeParametersProvider(config, context, args.input));
    const authSchemePreference = config.authSchemePreference ? await config.authSchemePreference() : [];
    const resolvedOptions = (0,_resolveAuthOptions__WEBPACK_IMPORTED_MODULE_1__.resolveAuthOptions)(options, authSchemePreference);
    const authSchemes = convertHttpAuthSchemesToMap(config.httpAuthSchemes);
    const smithyContext = (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.getSmithyContext)(context);
    const failureReasons = [];
    for (const option of resolvedOptions) {
        const scheme = authSchemes.get(option.schemeId);
        if (!scheme) {
            failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` was not enabled for this service.`);
            continue;
        }
        const identityProvider = scheme.identityProvider(await mwOptions.identityProviderConfigProvider(config));
        if (!identityProvider) {
            failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` did not have an IdentityProvider configured.`);
            continue;
        }
        const { identityProperties = {}, signingProperties = {} } = option.propertiesExtractor?.(config, context) || {};
        option.identityProperties = Object.assign(option.identityProperties || {}, identityProperties);
        option.signingProperties = Object.assign(option.signingProperties || {}, signingProperties);
        smithyContext.selectedHttpAuthScheme = {
            httpAuthOption: option,
            identity: await identityProvider(option.identityProperties),
            signer: scheme.signer,
        };
        break;
    }
    if (!smithyContext.selectedHttpAuthScheme) {
        throw new Error(failureReasons.join("\n"));
    }
    return next(args);
};


/***/ }),

/***/ 2016:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSmithyContext: () => (/* binding */ getSmithyContext)
/* harmony export */ });
/* harmony import */ var _smithy_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2017);

const getSmithyContext = (context) => context[_smithy_types__WEBPACK_IMPORTED_MODULE_0__.SMITHY_CONTEXT_KEY] || (context[_smithy_types__WEBPACK_IMPORTED_MODULE_0__.SMITHY_CONTEXT_KEY] = {});


/***/ }),

/***/ 2017:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SMITHY_CONTEXT_KEY: () => (/* binding */ SMITHY_CONTEXT_KEY)
/* harmony export */ });
const SMITHY_CONTEXT_KEY = "__smithy_context";


/***/ }),

/***/ 2018:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveAuthOptions: () => (/* binding */ resolveAuthOptions)
/* harmony export */ });
const resolveAuthOptions = (candidateAuthOptions, authSchemePreference) => {
    if (!authSchemePreference || authSchemePreference.length === 0) {
        return candidateAuthOptions;
    }
    const preferredAuthOptions = [];
    for (const preferredSchemeName of authSchemePreference) {
        for (const candidateAuthOption of candidateAuthOptions) {
            const candidateAuthSchemeName = candidateAuthOption.schemeId.split("#")[1];
            if (candidateAuthSchemeName === preferredSchemeName) {
                preferredAuthOptions.push(candidateAuthOption);
            }
        }
    }
    for (const candidateAuthOption of candidateAuthOptions) {
        if (!preferredAuthOptions.find(({ schemeId }) => schemeId === candidateAuthOption.schemeId)) {
            preferredAuthOptions.push(candidateAuthOption);
        }
    }
    return preferredAuthOptions;
};


/***/ }),

/***/ 2019:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getHttpSigningPlugin: () => (/* binding */ getHttpSigningPlugin),
/* harmony export */   httpSigningMiddlewareOptions: () => (/* binding */ httpSigningMiddlewareOptions)
/* harmony export */ });
/* harmony import */ var _httpSigningMiddleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2020);

const httpSigningMiddlewareOptions = {
    step: "finalizeRequest",
    tags: ["HTTP_SIGNING"],
    name: "httpSigningMiddleware",
    aliases: ["apiKeyMiddleware", "tokenMiddleware", "awsAuthMiddleware"],
    override: true,
    relation: "after",
    toMiddleware: "retryMiddleware",
};
const getHttpSigningPlugin = (config) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo((0,_httpSigningMiddleware__WEBPACK_IMPORTED_MODULE_0__.httpSigningMiddleware)(config), httpSigningMiddlewareOptions);
    },
});


/***/ }),

/***/ 2020:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   httpSigningMiddleware: () => (/* binding */ httpSigningMiddleware)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1350);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2016);


const defaultErrorHandler = (signingProperties) => (error) => {
    throw error;
};
const defaultSuccessHandler = (httpResponse, signingProperties) => { };
const httpSigningMiddleware = (config) => (next, context) => async (args) => {
    if (!_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpRequest.isInstance(args.request)) {
        return next(args);
    }
    const smithyContext = (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__.getSmithyContext)(context);
    const scheme = smithyContext.selectedHttpAuthScheme;
    if (!scheme) {
        throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
    }
    const { httpAuthOption: { signingProperties = {} }, identity, signer, } = scheme;
    const output = await next({
        ...args,
        request: await signer.sign(args.request, identity, signingProperties),
    }).catch((signer.errorHandler || defaultErrorHandler)(signingProperties));
    (signer.successHandler || defaultSuccessHandler)(output.response, signingProperties);
    return output;
};


/***/ }),

/***/ 2021:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deserializerMiddlewareOption: () => (/* binding */ deserializerMiddlewareOption),
/* harmony export */   getSchemaSerdePlugin: () => (/* binding */ getSchemaSerdePlugin),
/* harmony export */   serializerMiddlewareOption: () => (/* binding */ serializerMiddlewareOption)
/* harmony export */ });
/* harmony import */ var _schemaDeserializationMiddleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2022);
/* harmony import */ var _schemaSerializationMiddleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2024);


const deserializerMiddlewareOption = {
    name: "deserializerMiddleware",
    step: "deserialize",
    tags: ["DESERIALIZER"],
    override: true,
};
const serializerMiddlewareOption = {
    name: "serializerMiddleware",
    step: "serialize",
    tags: ["SERIALIZER"],
    override: true,
};
function getSchemaSerdePlugin(config) {
    return {
        applyToStack: (commandStack) => {
            commandStack.add((0,_schemaSerializationMiddleware__WEBPACK_IMPORTED_MODULE_1__.schemaSerializationMiddleware)(config), serializerMiddlewareOption);
            commandStack.add((0,_schemaDeserializationMiddleware__WEBPACK_IMPORTED_MODULE_0__.schemaDeserializationMiddleware)(config), deserializerMiddlewareOption);
            config.protocol.setSerdeContext(config);
        },
    };
}


/***/ }),

/***/ 2022:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   schemaDeserializationMiddleware: () => (/* binding */ schemaDeserializationMiddleware)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1336);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2016);
/* harmony import */ var _schemas_operation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2023);



const schemaDeserializationMiddleware = (config) => (next, context) => async (args) => {
    const { response } = await next(args);
    const { operationSchema } = (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__.getSmithyContext)(context);
    const [, ns, n, t, i, o] = operationSchema ?? [];
    try {
        const parsed = await config.protocol.deserializeResponse((0,_schemas_operation__WEBPACK_IMPORTED_MODULE_2__.operation)(ns, n, t, i, o), {
            ...config,
            ...context,
        }, response);
        return {
            response,
            output: parsed,
        };
    }
    catch (error) {
        Object.defineProperty(error, "$response", {
            value: response,
            enumerable: false,
            writable: false,
            configurable: false,
        });
        if (!("$metadata" in error)) {
            const hint = `Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.`;
            try {
                error.message += "\n  " + hint;
            }
            catch (e) {
                if (!context.logger || context.logger?.constructor?.name === "NoOpLogger") {
                    console.warn(hint);
                }
                else {
                    context.logger?.warn?.(hint);
                }
            }
            if (typeof error.$responseBodyText !== "undefined") {
                if (error.$response) {
                    error.$response.body = error.$responseBodyText;
                }
            }
            try {
                if (_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpResponse.isInstance(response)) {
                    const { headers = {} } = response;
                    const headerEntries = Object.entries(headers);
                    error.$metadata = {
                        httpStatusCode: response.statusCode,
                        requestId: findHeader(/^x-[\w-]+-request-?id$/, headerEntries),
                        extendedRequestId: findHeader(/^x-[\w-]+-id-2$/, headerEntries),
                        cfId: findHeader(/^x-[\w-]+-cf-id$/, headerEntries),
                    };
                }
            }
            catch (e) {
            }
        }
        throw error;
    }
};
const findHeader = (pattern, headers) => {
    return (headers.find(([k]) => {
        return k.match(pattern);
    }) || [void 0, void 1])[1];
};


/***/ }),

/***/ 2023:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   operation: () => (/* binding */ operation)
/* harmony export */ });
const operation = (namespace, name, traits, input, output) => ({
    name,
    namespace,
    traits,
    input,
    output,
});


/***/ }),

/***/ 2024:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   schemaSerializationMiddleware: () => (/* binding */ schemaSerializationMiddleware)
/* harmony export */ });
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2016);
/* harmony import */ var _schemas_operation__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2023);


const schemaSerializationMiddleware = (config) => (next, context) => async (args) => {
    const { operationSchema } = (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.getSmithyContext)(context);
    const [, ns, n, t, i, o] = operationSchema ?? [];
    const endpoint = context.endpointV2?.url && config.urlParser
        ? async () => config.urlParser(context.endpointV2.url)
        : config.endpoint;
    const request = await config.protocol.serializeRequest((0,_schemas_operation__WEBPACK_IMPORTED_MODULE_1__.operation)(ns, n, t, i, o), args.input, {
        ...config,
        ...context,
        endpoint,
    });
    return next({
        ...args,
        request,
    });
};


/***/ }),

/***/ 2025:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   contentLengthMiddleware: () => (/* binding */ contentLengthMiddleware),
/* harmony export */   contentLengthMiddlewareOptions: () => (/* binding */ contentLengthMiddlewareOptions),
/* harmony export */   getContentLengthPlugin: () => (/* binding */ getContentLengthPlugin)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1350);

const CONTENT_LENGTH_HEADER = "content-length";
function contentLengthMiddleware(bodyLengthChecker) {
    return (next) => async (args) => {
        const request = args.request;
        if (_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpRequest.isInstance(request)) {
            const { body, headers } = request;
            if (body &&
                Object.keys(headers)
                    .map((str) => str.toLowerCase())
                    .indexOf(CONTENT_LENGTH_HEADER) === -1) {
                try {
                    const length = bodyLengthChecker(body);
                    request.headers = {
                        ...request.headers,
                        [CONTENT_LENGTH_HEADER]: String(length),
                    };
                }
                catch (error) {
                }
            }
        }
        return next({
            ...args,
            request,
        });
    };
}
const contentLengthMiddlewareOptions = {
    step: "build",
    tags: ["SET_CONTENT_LENGTH", "CONTENT_LENGTH"],
    name: "contentLengthMiddleware",
    override: true,
};
const getContentLengthPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(contentLengthMiddleware(options.bodyLengthChecker), contentLengthMiddlewareOptions);
    },
});


/***/ }),

/***/ 2026:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveEndpointConfig: () => (/* binding */ resolveEndpointConfig)
/* harmony export */ });
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1470);
/* harmony import */ var _adaptors_getEndpointFromConfig__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2027);
/* harmony import */ var _adaptors_toEndpointV1__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2029);



const resolveEndpointConfig = (input) => {
    const tls = input.tls ?? true;
    const { endpoint, useDualstackEndpoint, useFipsEndpoint } = input;
    const customEndpointProvider = endpoint != null ? async () => (0,_adaptors_toEndpointV1__WEBPACK_IMPORTED_MODULE_2__.toEndpointV1)(await (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.normalizeProvider)(endpoint)()) : undefined;
    const isCustomEndpoint = !!endpoint;
    const resolvedConfig = Object.assign(input, {
        endpoint: customEndpointProvider,
        tls,
        isCustomEndpoint,
        useDualstackEndpoint: (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.normalizeProvider)(useDualstackEndpoint ?? false),
        useFipsEndpoint: (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.normalizeProvider)(useFipsEndpoint ?? false),
    });
    let configuredEndpointPromise = undefined;
    resolvedConfig.serviceConfiguredEndpoint = async () => {
        if (input.serviceId && !configuredEndpointPromise) {
            configuredEndpointPromise = (0,_adaptors_getEndpointFromConfig__WEBPACK_IMPORTED_MODULE_1__.getEndpointFromConfig)(input.serviceId);
        }
        return configuredEndpointPromise;
    };
    return resolvedConfig;
};


/***/ }),

/***/ 2027:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getEndpointFromConfig: () => (/* binding */ getEndpointFromConfig)
/* harmony export */ });
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1398);
/* harmony import */ var _getEndpointUrlConfig__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2028);


const getEndpointFromConfig = async (serviceId) => (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_0__.loadConfig)((0,_getEndpointUrlConfig__WEBPACK_IMPORTED_MODULE_1__.getEndpointUrlConfig)(serviceId ?? ""))();


/***/ }),

/***/ 2028:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getEndpointUrlConfig: () => (/* binding */ getEndpointUrlConfig)
/* harmony export */ });
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1374);

const ENV_ENDPOINT_URL = "AWS_ENDPOINT_URL";
const CONFIG_ENDPOINT_URL = "endpoint_url";
const getEndpointUrlConfig = (serviceId) => ({
    environmentVariableSelector: (env) => {
        const serviceSuffixParts = serviceId.split(" ").map((w) => w.toUpperCase());
        const serviceEndpointUrl = env[[ENV_ENDPOINT_URL, ...serviceSuffixParts].join("_")];
        if (serviceEndpointUrl)
            return serviceEndpointUrl;
        const endpointUrl = env[ENV_ENDPOINT_URL];
        if (endpointUrl)
            return endpointUrl;
        return undefined;
    },
    configFileSelector: (profile, config) => {
        if (config && profile.services) {
            const servicesSection = config[["services", profile.services].join(_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__.CONFIG_PREFIX_SEPARATOR)];
            if (servicesSection) {
                const servicePrefixParts = serviceId.split(" ").map((w) => w.toLowerCase());
                const endpointUrl = servicesSection[[servicePrefixParts.join("_"), CONFIG_ENDPOINT_URL].join(_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__.CONFIG_PREFIX_SEPARATOR)];
                if (endpointUrl)
                    return endpointUrl;
            }
        }
        const endpointUrl = profile[CONFIG_ENDPOINT_URL];
        if (endpointUrl)
            return endpointUrl;
        return undefined;
    },
    default: undefined,
});


/***/ }),

/***/ 2029:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   toEndpointV1: () => (/* binding */ toEndpointV1)
/* harmony export */ });
/* harmony import */ var _smithy_url_parser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1407);

const toEndpointV1 = (endpoint) => {
    if (typeof endpoint === "object") {
        if ("url" in endpoint) {
            return (0,_smithy_url_parser__WEBPACK_IMPORTED_MODULE_0__.parseUrl)(endpoint.url);
        }
        return endpoint;
    }
    return (0,_smithy_url_parser__WEBPACK_IMPORTED_MODULE_0__.parseUrl)(endpoint);
};


/***/ }),

/***/ 2030:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONFIG_MAX_ATTEMPTS: () => (/* binding */ CONFIG_MAX_ATTEMPTS),
/* harmony export */   CONFIG_RETRY_MODE: () => (/* binding */ CONFIG_RETRY_MODE),
/* harmony export */   ENV_MAX_ATTEMPTS: () => (/* binding */ ENV_MAX_ATTEMPTS),
/* harmony export */   ENV_RETRY_MODE: () => (/* binding */ ENV_RETRY_MODE),
/* harmony export */   NODE_MAX_ATTEMPT_CONFIG_OPTIONS: () => (/* binding */ NODE_MAX_ATTEMPT_CONFIG_OPTIONS),
/* harmony export */   NODE_RETRY_MODE_CONFIG_OPTIONS: () => (/* binding */ NODE_RETRY_MODE_CONFIG_OPTIONS),
/* harmony export */   resolveRetryConfig: () => (/* binding */ resolveRetryConfig)
/* harmony export */ });
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1470);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2031);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2036);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2032);


const ENV_MAX_ATTEMPTS = "AWS_MAX_ATTEMPTS";
const CONFIG_MAX_ATTEMPTS = "max_attempts";
const NODE_MAX_ATTEMPT_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => {
        const value = env[ENV_MAX_ATTEMPTS];
        if (!value)
            return undefined;
        const maxAttempt = parseInt(value);
        if (Number.isNaN(maxAttempt)) {
            throw new Error(`Environment variable ${ENV_MAX_ATTEMPTS} mast be a number, got "${value}"`);
        }
        return maxAttempt;
    },
    configFileSelector: (profile) => {
        const value = profile[CONFIG_MAX_ATTEMPTS];
        if (!value)
            return undefined;
        const maxAttempt = parseInt(value);
        if (Number.isNaN(maxAttempt)) {
            throw new Error(`Shared config file entry ${CONFIG_MAX_ATTEMPTS} mast be a number, got "${value}"`);
        }
        return maxAttempt;
    },
    default: _smithy_util_retry__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_MAX_ATTEMPTS,
};
const resolveRetryConfig = (input) => {
    const { retryStrategy, retryMode: _retryMode, maxAttempts: _maxAttempts } = input;
    const maxAttempts = (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.normalizeProvider)(_maxAttempts ?? _smithy_util_retry__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_MAX_ATTEMPTS);
    return Object.assign(input, {
        maxAttempts,
        retryStrategy: async () => {
            if (retryStrategy) {
                return retryStrategy;
            }
            const retryMode = await (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.normalizeProvider)(_retryMode)();
            if (retryMode === _smithy_util_retry__WEBPACK_IMPORTED_MODULE_3__.RETRY_MODES.ADAPTIVE) {
                return new _smithy_util_retry__WEBPACK_IMPORTED_MODULE_1__.AdaptiveRetryStrategy(maxAttempts);
            }
            return new _smithy_util_retry__WEBPACK_IMPORTED_MODULE_2__.StandardRetryStrategy(maxAttempts);
        },
    });
};
const ENV_RETRY_MODE = "AWS_RETRY_MODE";
const CONFIG_RETRY_MODE = "retry_mode";
const NODE_RETRY_MODE_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => env[ENV_RETRY_MODE],
    configFileSelector: (profile) => profile[CONFIG_RETRY_MODE],
    default: _smithy_util_retry__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_RETRY_MODE,
};


/***/ }),

/***/ 2031:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AdaptiveRetryStrategy: () => (/* binding */ AdaptiveRetryStrategy)
/* harmony export */ });
/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2032);
/* harmony import */ var _DefaultRateLimiter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2033);
/* harmony import */ var _StandardRetryStrategy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2036);



class AdaptiveRetryStrategy {
    maxAttemptsProvider;
    rateLimiter;
    standardRetryStrategy;
    mode = _config__WEBPACK_IMPORTED_MODULE_0__.RETRY_MODES.ADAPTIVE;
    constructor(maxAttemptsProvider, options) {
        this.maxAttemptsProvider = maxAttemptsProvider;
        const { rateLimiter } = options ?? {};
        this.rateLimiter = rateLimiter ?? new _DefaultRateLimiter__WEBPACK_IMPORTED_MODULE_1__.DefaultRateLimiter();
        this.standardRetryStrategy = new _StandardRetryStrategy__WEBPACK_IMPORTED_MODULE_2__.StandardRetryStrategy(maxAttemptsProvider);
    }
    async acquireInitialRetryToken(retryTokenScope) {
        await this.rateLimiter.getSendToken();
        return this.standardRetryStrategy.acquireInitialRetryToken(retryTokenScope);
    }
    async refreshRetryTokenForRetry(tokenToRenew, errorInfo) {
        this.rateLimiter.updateClientSendingRate(errorInfo);
        return this.standardRetryStrategy.refreshRetryTokenForRetry(tokenToRenew, errorInfo);
    }
    recordSuccess(token) {
        this.rateLimiter.updateClientSendingRate({});
        this.standardRetryStrategy.recordSuccess(token);
    }
}


/***/ }),

/***/ 2032:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_MAX_ATTEMPTS: () => (/* binding */ DEFAULT_MAX_ATTEMPTS),
/* harmony export */   DEFAULT_RETRY_MODE: () => (/* binding */ DEFAULT_RETRY_MODE),
/* harmony export */   RETRY_MODES: () => (/* binding */ RETRY_MODES)
/* harmony export */ });
var RETRY_MODES;
(function (RETRY_MODES) {
    RETRY_MODES["STANDARD"] = "standard";
    RETRY_MODES["ADAPTIVE"] = "adaptive";
})(RETRY_MODES || (RETRY_MODES = {}));
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_MODE = RETRY_MODES.STANDARD;


/***/ }),

/***/ 2033:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DefaultRateLimiter: () => (/* binding */ DefaultRateLimiter)
/* harmony export */ });
/* harmony import */ var _smithy_service_error_classification__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2034);

class DefaultRateLimiter {
    static setTimeoutFn = setTimeout;
    beta;
    minCapacity;
    minFillRate;
    scaleConstant;
    smooth;
    currentCapacity = 0;
    enabled = false;
    lastMaxRate = 0;
    measuredTxRate = 0;
    requestCount = 0;
    fillRate;
    lastThrottleTime;
    lastTimestamp = 0;
    lastTxRateBucket;
    maxCapacity;
    timeWindow = 0;
    constructor(options) {
        this.beta = options?.beta ?? 0.7;
        this.minCapacity = options?.minCapacity ?? 1;
        this.minFillRate = options?.minFillRate ?? 0.5;
        this.scaleConstant = options?.scaleConstant ?? 0.4;
        this.smooth = options?.smooth ?? 0.8;
        const currentTimeInSeconds = this.getCurrentTimeInSeconds();
        this.lastThrottleTime = currentTimeInSeconds;
        this.lastTxRateBucket = Math.floor(this.getCurrentTimeInSeconds());
        this.fillRate = this.minFillRate;
        this.maxCapacity = this.minCapacity;
    }
    getCurrentTimeInSeconds() {
        return Date.now() / 1000;
    }
    async getSendToken() {
        return this.acquireTokenBucket(1);
    }
    async acquireTokenBucket(amount) {
        if (!this.enabled) {
            return;
        }
        this.refillTokenBucket();
        if (amount > this.currentCapacity) {
            const delay = ((amount - this.currentCapacity) / this.fillRate) * 1000;
            await new Promise((resolve) => DefaultRateLimiter.setTimeoutFn(resolve, delay));
        }
        this.currentCapacity = this.currentCapacity - amount;
    }
    refillTokenBucket() {
        const timestamp = this.getCurrentTimeInSeconds();
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
            return;
        }
        const fillAmount = (timestamp - this.lastTimestamp) * this.fillRate;
        this.currentCapacity = Math.min(this.maxCapacity, this.currentCapacity + fillAmount);
        this.lastTimestamp = timestamp;
    }
    updateClientSendingRate(response) {
        let calculatedRate;
        this.updateMeasuredRate();
        if ((0,_smithy_service_error_classification__WEBPACK_IMPORTED_MODULE_0__.isThrottlingError)(response)) {
            const rateToUse = !this.enabled ? this.measuredTxRate : Math.min(this.measuredTxRate, this.fillRate);
            this.lastMaxRate = rateToUse;
            this.calculateTimeWindow();
            this.lastThrottleTime = this.getCurrentTimeInSeconds();
            calculatedRate = this.cubicThrottle(rateToUse);
            this.enableTokenBucket();
        }
        else {
            this.calculateTimeWindow();
            calculatedRate = this.cubicSuccess(this.getCurrentTimeInSeconds());
        }
        const newRate = Math.min(calculatedRate, 2 * this.measuredTxRate);
        this.updateTokenBucketRate(newRate);
    }
    calculateTimeWindow() {
        this.timeWindow = this.getPrecise(Math.pow((this.lastMaxRate * (1 - this.beta)) / this.scaleConstant, 1 / 3));
    }
    cubicThrottle(rateToUse) {
        return this.getPrecise(rateToUse * this.beta);
    }
    cubicSuccess(timestamp) {
        return this.getPrecise(this.scaleConstant * Math.pow(timestamp - this.lastThrottleTime - this.timeWindow, 3) + this.lastMaxRate);
    }
    enableTokenBucket() {
        this.enabled = true;
    }
    updateTokenBucketRate(newRate) {
        this.refillTokenBucket();
        this.fillRate = Math.max(newRate, this.minFillRate);
        this.maxCapacity = Math.max(newRate, this.minCapacity);
        this.currentCapacity = Math.min(this.currentCapacity, this.maxCapacity);
    }
    updateMeasuredRate() {
        const t = this.getCurrentTimeInSeconds();
        const timeBucket = Math.floor(t * 2) / 2;
        this.requestCount++;
        if (timeBucket > this.lastTxRateBucket) {
            const currentRate = this.requestCount / (timeBucket - this.lastTxRateBucket);
            this.measuredTxRate = this.getPrecise(currentRate * this.smooth + this.measuredTxRate * (1 - this.smooth));
            this.requestCount = 0;
            this.lastTxRateBucket = timeBucket;
        }
    }
    getPrecise(num) {
        return parseFloat(num.toFixed(8));
    }
}


/***/ }),

/***/ 2034:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isBrowserNetworkError: () => (/* binding */ isBrowserNetworkError),
/* harmony export */   isClockSkewCorrectedError: () => (/* binding */ isClockSkewCorrectedError),
/* harmony export */   isClockSkewError: () => (/* binding */ isClockSkewError),
/* harmony export */   isRetryableByTrait: () => (/* binding */ isRetryableByTrait),
/* harmony export */   isServerError: () => (/* binding */ isServerError),
/* harmony export */   isThrottlingError: () => (/* binding */ isThrottlingError),
/* harmony export */   isTransientError: () => (/* binding */ isTransientError)
/* harmony export */ });
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2035);

const isRetryableByTrait = (error) => error?.$retryable !== undefined;
const isClockSkewError = (error) => _constants__WEBPACK_IMPORTED_MODULE_0__.CLOCK_SKEW_ERROR_CODES.includes(error.name);
const isClockSkewCorrectedError = (error) => error.$metadata?.clockSkewCorrected;
const isBrowserNetworkError = (error) => {
    const errorMessages = new Set([
        "Failed to fetch",
        "NetworkError when attempting to fetch resource",
        "The Internet connection appears to be offline",
        "Load failed",
        "Network request failed",
    ]);
    const isValid = error && error instanceof TypeError;
    if (!isValid) {
        return false;
    }
    return errorMessages.has(error.message);
};
const isThrottlingError = (error) => error.$metadata?.httpStatusCode === 429 ||
    _constants__WEBPACK_IMPORTED_MODULE_0__.THROTTLING_ERROR_CODES.includes(error.name) ||
    error.$retryable?.throttling == true;
const isTransientError = (error, depth = 0) => isRetryableByTrait(error) ||
    isClockSkewCorrectedError(error) ||
    _constants__WEBPACK_IMPORTED_MODULE_0__.TRANSIENT_ERROR_CODES.includes(error.name) ||
    _constants__WEBPACK_IMPORTED_MODULE_0__.NODEJS_TIMEOUT_ERROR_CODES.includes(error?.code || "") ||
    _constants__WEBPACK_IMPORTED_MODULE_0__.NODEJS_NETWORK_ERROR_CODES.includes(error?.code || "") ||
    _constants__WEBPACK_IMPORTED_MODULE_0__.TRANSIENT_ERROR_STATUS_CODES.includes(error.$metadata?.httpStatusCode || 0) ||
    isBrowserNetworkError(error) ||
    (error.cause !== undefined && depth <= 10 && isTransientError(error.cause, depth + 1));
const isServerError = (error) => {
    if (error.$metadata?.httpStatusCode !== undefined) {
        const statusCode = error.$metadata.httpStatusCode;
        if (500 <= statusCode && statusCode <= 599 && !isTransientError(error)) {
            return true;
        }
        return false;
    }
    return false;
};


/***/ }),

/***/ 2035:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CLOCK_SKEW_ERROR_CODES: () => (/* binding */ CLOCK_SKEW_ERROR_CODES),
/* harmony export */   NODEJS_NETWORK_ERROR_CODES: () => (/* binding */ NODEJS_NETWORK_ERROR_CODES),
/* harmony export */   NODEJS_TIMEOUT_ERROR_CODES: () => (/* binding */ NODEJS_TIMEOUT_ERROR_CODES),
/* harmony export */   THROTTLING_ERROR_CODES: () => (/* binding */ THROTTLING_ERROR_CODES),
/* harmony export */   TRANSIENT_ERROR_CODES: () => (/* binding */ TRANSIENT_ERROR_CODES),
/* harmony export */   TRANSIENT_ERROR_STATUS_CODES: () => (/* binding */ TRANSIENT_ERROR_STATUS_CODES)
/* harmony export */ });
const CLOCK_SKEW_ERROR_CODES = [
    "AuthFailure",
    "InvalidSignatureException",
    "RequestExpired",
    "RequestInTheFuture",
    "RequestTimeTooSkewed",
    "SignatureDoesNotMatch",
];
const THROTTLING_ERROR_CODES = [
    "BandwidthLimitExceeded",
    "EC2ThrottledException",
    "LimitExceededException",
    "PriorRequestNotComplete",
    "ProvisionedThroughputExceededException",
    "RequestLimitExceeded",
    "RequestThrottled",
    "RequestThrottledException",
    "SlowDown",
    "ThrottledException",
    "Throttling",
    "ThrottlingException",
    "TooManyRequestsException",
    "TransactionInProgressException",
];
const TRANSIENT_ERROR_CODES = ["TimeoutError", "RequestTimeout", "RequestTimeoutException"];
const TRANSIENT_ERROR_STATUS_CODES = [500, 502, 503, 504];
const NODEJS_TIMEOUT_ERROR_CODES = ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"];
const NODEJS_NETWORK_ERROR_CODES = ["EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND"];


/***/ }),

/***/ 2036:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   StandardRetryStrategy: () => (/* binding */ StandardRetryStrategy)
/* harmony export */ });
/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2032);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2037);
/* harmony import */ var _defaultRetryBackoffStrategy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2038);
/* harmony import */ var _defaultRetryToken__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2039);




class StandardRetryStrategy {
    maxAttempts;
    mode = _config__WEBPACK_IMPORTED_MODULE_0__.RETRY_MODES.STANDARD;
    capacity = _constants__WEBPACK_IMPORTED_MODULE_1__.INITIAL_RETRY_TOKENS;
    retryBackoffStrategy = (0,_defaultRetryBackoffStrategy__WEBPACK_IMPORTED_MODULE_2__.getDefaultRetryBackoffStrategy)();
    maxAttemptsProvider;
    constructor(maxAttempts) {
        this.maxAttempts = maxAttempts;
        this.maxAttemptsProvider = typeof maxAttempts === "function" ? maxAttempts : async () => maxAttempts;
    }
    async acquireInitialRetryToken(retryTokenScope) {
        return (0,_defaultRetryToken__WEBPACK_IMPORTED_MODULE_3__.createDefaultRetryToken)({
            retryDelay: _constants__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_RETRY_DELAY_BASE,
            retryCount: 0,
        });
    }
    async refreshRetryTokenForRetry(token, errorInfo) {
        const maxAttempts = await this.getMaxAttempts();
        if (this.shouldRetry(token, errorInfo, maxAttempts)) {
            const errorType = errorInfo.errorType;
            this.retryBackoffStrategy.setDelayBase(errorType === "THROTTLING" ? _constants__WEBPACK_IMPORTED_MODULE_1__.THROTTLING_RETRY_DELAY_BASE : _constants__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_RETRY_DELAY_BASE);
            const delayFromErrorType = this.retryBackoffStrategy.computeNextBackoffDelay(token.getRetryCount());
            const retryDelay = errorInfo.retryAfterHint
                ? Math.max(errorInfo.retryAfterHint.getTime() - Date.now() || 0, delayFromErrorType)
                : delayFromErrorType;
            const capacityCost = this.getCapacityCost(errorType);
            this.capacity -= capacityCost;
            return (0,_defaultRetryToken__WEBPACK_IMPORTED_MODULE_3__.createDefaultRetryToken)({
                retryDelay,
                retryCount: token.getRetryCount() + 1,
                retryCost: capacityCost,
            });
        }
        throw new Error("No retry token available");
    }
    recordSuccess(token) {
        this.capacity = Math.max(_constants__WEBPACK_IMPORTED_MODULE_1__.INITIAL_RETRY_TOKENS, this.capacity + (token.getRetryCost() ?? _constants__WEBPACK_IMPORTED_MODULE_1__.NO_RETRY_INCREMENT));
    }
    getCapacity() {
        return this.capacity;
    }
    async getMaxAttempts() {
        try {
            return await this.maxAttemptsProvider();
        }
        catch (error) {
            console.warn(`Max attempts provider could not resolve. Using default of ${_config__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_MAX_ATTEMPTS}`);
            return _config__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_MAX_ATTEMPTS;
        }
    }
    shouldRetry(tokenToRenew, errorInfo, maxAttempts) {
        const attempts = tokenToRenew.getRetryCount() + 1;
        return (attempts < maxAttempts &&
            this.capacity >= this.getCapacityCost(errorInfo.errorType) &&
            this.isRetryableError(errorInfo.errorType));
    }
    getCapacityCost(errorType) {
        return errorType === "TRANSIENT" ? _constants__WEBPACK_IMPORTED_MODULE_1__.TIMEOUT_RETRY_COST : _constants__WEBPACK_IMPORTED_MODULE_1__.RETRY_COST;
    }
    isRetryableError(errorType) {
        return errorType === "THROTTLING" || errorType === "TRANSIENT";
    }
}


/***/ }),

/***/ 2037:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_RETRY_DELAY_BASE: () => (/* binding */ DEFAULT_RETRY_DELAY_BASE),
/* harmony export */   INITIAL_RETRY_TOKENS: () => (/* binding */ INITIAL_RETRY_TOKENS),
/* harmony export */   INVOCATION_ID_HEADER: () => (/* binding */ INVOCATION_ID_HEADER),
/* harmony export */   MAXIMUM_RETRY_DELAY: () => (/* binding */ MAXIMUM_RETRY_DELAY),
/* harmony export */   NO_RETRY_INCREMENT: () => (/* binding */ NO_RETRY_INCREMENT),
/* harmony export */   REQUEST_HEADER: () => (/* binding */ REQUEST_HEADER),
/* harmony export */   RETRY_COST: () => (/* binding */ RETRY_COST),
/* harmony export */   THROTTLING_RETRY_DELAY_BASE: () => (/* binding */ THROTTLING_RETRY_DELAY_BASE),
/* harmony export */   TIMEOUT_RETRY_COST: () => (/* binding */ TIMEOUT_RETRY_COST)
/* harmony export */ });
const DEFAULT_RETRY_DELAY_BASE = 100;
const MAXIMUM_RETRY_DELAY = 20 * 1000;
const THROTTLING_RETRY_DELAY_BASE = 500;
const INITIAL_RETRY_TOKENS = 500;
const RETRY_COST = 5;
const TIMEOUT_RETRY_COST = 10;
const NO_RETRY_INCREMENT = 1;
const INVOCATION_ID_HEADER = "amz-sdk-invocation-id";
const REQUEST_HEADER = "amz-sdk-request";


/***/ }),

/***/ 2038:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getDefaultRetryBackoffStrategy: () => (/* binding */ getDefaultRetryBackoffStrategy)
/* harmony export */ });
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2037);

const getDefaultRetryBackoffStrategy = () => {
    let delayBase = _constants__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_RETRY_DELAY_BASE;
    const computeNextBackoffDelay = (attempts) => {
        return Math.floor(Math.min(_constants__WEBPACK_IMPORTED_MODULE_0__.MAXIMUM_RETRY_DELAY, Math.random() * 2 ** attempts * delayBase));
    };
    const setDelayBase = (delay) => {
        delayBase = delay;
    };
    return {
        computeNextBackoffDelay,
        setDelayBase,
    };
};


/***/ }),

/***/ 2039:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createDefaultRetryToken: () => (/* binding */ createDefaultRetryToken)
/* harmony export */ });
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2037);

const createDefaultRetryToken = ({ retryDelay, retryCount, retryCost, }) => {
    const getRetryCount = () => retryCount;
    const getRetryDelay = () => Math.min(_constants__WEBPACK_IMPORTED_MODULE_0__.MAXIMUM_RETRY_DELAY, retryDelay);
    const getRetryCost = () => retryCost;
    return {
        getRetryCount,
        getRetryDelay,
        getRetryCost,
    };
};


/***/ }),

/***/ 2040:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRetryAfterHint: () => (/* binding */ getRetryAfterHint),
/* harmony export */   getRetryPlugin: () => (/* binding */ getRetryPlugin),
/* harmony export */   retryMiddleware: () => (/* binding */ retryMiddleware),
/* harmony export */   retryMiddlewareOptions: () => (/* binding */ retryMiddlewareOptions)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1350);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1336);
/* harmony import */ var _smithy_service_error_classification__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2034);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2041);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2037);
/* harmony import */ var _smithy_uuid__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(2042);
/* harmony import */ var _isStreamingPayload_isStreamingPayload__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(2044);
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(2045);







const retryMiddleware = (options) => (next, context) => async (args) => {
    let retryStrategy = await options.retryStrategy();
    const maxAttempts = await options.maxAttempts();
    if (isRetryStrategyV2(retryStrategy)) {
        retryStrategy = retryStrategy;
        let retryToken = await retryStrategy.acquireInitialRetryToken(context["partition_id"]);
        let lastError = new Error();
        let attempts = 0;
        let totalRetryDelay = 0;
        const { request } = args;
        const isRequest = _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpRequest.isInstance(request);
        if (isRequest) {
            request.headers[_smithy_util_retry__WEBPACK_IMPORTED_MODULE_4__.INVOCATION_ID_HEADER] = (0,_smithy_uuid__WEBPACK_IMPORTED_MODULE_5__.v4)();
        }
        while (true) {
            try {
                if (isRequest) {
                    request.headers[_smithy_util_retry__WEBPACK_IMPORTED_MODULE_4__.REQUEST_HEADER] = `attempt=${attempts + 1}; max=${maxAttempts}`;
                }
                const { response, output } = await next(args);
                retryStrategy.recordSuccess(retryToken);
                output.$metadata.attempts = attempts + 1;
                output.$metadata.totalRetryDelay = totalRetryDelay;
                return { response, output };
            }
            catch (e) {
                const retryErrorInfo = getRetryErrorInfo(e);
                lastError = (0,_util__WEBPACK_IMPORTED_MODULE_7__.asSdkError)(e);
                if (isRequest && (0,_isStreamingPayload_isStreamingPayload__WEBPACK_IMPORTED_MODULE_6__.isStreamingPayload)(request)) {
                    (context.logger instanceof _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.NoOpLogger ? console : context.logger)?.warn("An error was encountered in a non-retryable streaming request.");
                    throw lastError;
                }
                try {
                    retryToken = await retryStrategy.refreshRetryTokenForRetry(retryToken, retryErrorInfo);
                }
                catch (refreshError) {
                    if (!lastError.$metadata) {
                        lastError.$metadata = {};
                    }
                    lastError.$metadata.attempts = attempts + 1;
                    lastError.$metadata.totalRetryDelay = totalRetryDelay;
                    throw lastError;
                }
                attempts = retryToken.getRetryCount();
                const delay = retryToken.getRetryDelay();
                totalRetryDelay += delay;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    else {
        retryStrategy = retryStrategy;
        if (retryStrategy?.mode)
            context.userAgent = [...(context.userAgent || []), ["cfg/retry-mode", retryStrategy.mode]];
        return retryStrategy.retry(next, args);
    }
};
const isRetryStrategyV2 = (retryStrategy) => typeof retryStrategy.acquireInitialRetryToken !== "undefined" &&
    typeof retryStrategy.refreshRetryTokenForRetry !== "undefined" &&
    typeof retryStrategy.recordSuccess !== "undefined";
const getRetryErrorInfo = (error) => {
    const errorInfo = {
        error,
        errorType: getRetryErrorType(error),
    };
    const retryAfterHint = getRetryAfterHint(error.$response);
    if (retryAfterHint) {
        errorInfo.retryAfterHint = retryAfterHint;
    }
    return errorInfo;
};
const getRetryErrorType = (error) => {
    if ((0,_smithy_service_error_classification__WEBPACK_IMPORTED_MODULE_2__.isThrottlingError)(error))
        return "THROTTLING";
    if ((0,_smithy_service_error_classification__WEBPACK_IMPORTED_MODULE_2__.isTransientError)(error))
        return "TRANSIENT";
    if ((0,_smithy_service_error_classification__WEBPACK_IMPORTED_MODULE_2__.isServerError)(error))
        return "SERVER_ERROR";
    return "CLIENT_ERROR";
};
const retryMiddlewareOptions = {
    name: "retryMiddleware",
    tags: ["RETRY"],
    step: "finalizeRequest",
    priority: "high",
    override: true,
};
const getRetryPlugin = (options) => ({
    applyToStack: (clientStack) => {
        clientStack.add(retryMiddleware(options), retryMiddlewareOptions);
    },
});
const getRetryAfterHint = (response) => {
    if (!_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__.HttpResponse.isInstance(response))
        return;
    const retryAfterHeaderName = Object.keys(response.headers).find((key) => key.toLowerCase() === "retry-after");
    if (!retryAfterHeaderName)
        return;
    const retryAfter = response.headers[retryAfterHeaderName];
    const retryAfterSeconds = Number(retryAfter);
    if (!Number.isNaN(retryAfterSeconds))
        return new Date(retryAfterSeconds * 1000);
    const retryAfterDate = new Date(retryAfter);
    return retryAfterDate;
};


/***/ }),

/***/ 2041:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NoOpLogger: () => (/* binding */ NoOpLogger)
/* harmony export */ });
class NoOpLogger {
    trace() { }
    debug() { }
    info() { }
    warn() { }
    error() { }
}


/***/ }),

/***/ 2042:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   v4: () => (/* binding */ v4)
/* harmony export */ });
/* harmony import */ var _randomUUID__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2043);

const decimalToHex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
const v4 = () => {
    if (_randomUUID__WEBPACK_IMPORTED_MODULE_0__.randomUUID) {
        return (0,_randomUUID__WEBPACK_IMPORTED_MODULE_0__.randomUUID)();
    }
    const rnds = new Uint8Array(16);
    crypto.getRandomValues(rnds);
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;
    return (decimalToHex[rnds[0]] +
        decimalToHex[rnds[1]] +
        decimalToHex[rnds[2]] +
        decimalToHex[rnds[3]] +
        "-" +
        decimalToHex[rnds[4]] +
        decimalToHex[rnds[5]] +
        "-" +
        decimalToHex[rnds[6]] +
        decimalToHex[rnds[7]] +
        "-" +
        decimalToHex[rnds[8]] +
        decimalToHex[rnds[9]] +
        "-" +
        decimalToHex[rnds[10]] +
        decimalToHex[rnds[11]] +
        decimalToHex[rnds[12]] +
        decimalToHex[rnds[13]] +
        decimalToHex[rnds[14]] +
        decimalToHex[rnds[15]]);
};


/***/ }),

/***/ 2043:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   randomUUID: () => (/* binding */ randomUUID)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(379);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);

const randomUUID = crypto__WEBPACK_IMPORTED_MODULE_0___default().randomUUID.bind((crypto__WEBPACK_IMPORTED_MODULE_0___default()));


/***/ }),

/***/ 2044:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isStreamingPayload: () => (/* binding */ isStreamingPayload)
/* harmony export */ });
/* harmony import */ var stream__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(18);
/* harmony import */ var stream__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(stream__WEBPACK_IMPORTED_MODULE_0__);

const isStreamingPayload = (request) => request?.body instanceof stream__WEBPACK_IMPORTED_MODULE_0__.Readable ||
    (typeof ReadableStream !== "undefined" && request?.body instanceof ReadableStream);


/***/ }),

/***/ 2045:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   asSdkError: () => (/* binding */ asSdkError)
/* harmony export */ });
const asSdkError = (error) => {
    if (error instanceof Error)
        return error;
    if (error instanceof Object)
        return Object.assign(new Error(), error);
    if (typeof error === "string")
        return new Error(error);
    return new Error(`AWS SDK error wrapper for ${error}`);
};


/***/ }),

/***/ 2046:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Client: () => (/* binding */ Client)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_stack__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2047);

class Client {
    config;
    middlewareStack = (0,_smithy_middleware_stack__WEBPACK_IMPORTED_MODULE_0__.constructStack)();
    initConfig;
    handlers;
    constructor(config) {
        this.config = config;
        const { protocol, protocolSettings } = config;
        if (protocolSettings) {
            if (typeof protocol === "function") {
                config.protocol = new protocol(protocolSettings);
            }
        }
    }
    send(command, optionsOrCb, cb) {
        const options = typeof optionsOrCb !== "function" ? optionsOrCb : undefined;
        const callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
        const useHandlerCache = options === undefined && this.config.cacheMiddleware === true;
        let handler;
        if (useHandlerCache) {
            if (!this.handlers) {
                this.handlers = new WeakMap();
            }
            const handlers = this.handlers;
            if (handlers.has(command.constructor)) {
                handler = handlers.get(command.constructor);
            }
            else {
                handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
                handlers.set(command.constructor, handler);
            }
        }
        else {
            delete this.handlers;
            handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
        }
        if (callback) {
            handler(command)
                .then((result) => callback(null, result.output), (err) => callback(err))
                .catch(() => { });
        }
        else {
            return handler(command).then((result) => result.output);
        }
    }
    destroy() {
        this.config?.requestHandler?.destroy?.();
        delete this.handlers;
    }
}


/***/ }),

/***/ 2047:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   constructStack: () => (/* binding */ constructStack)
/* harmony export */ });
const getAllAliases = (name, aliases) => {
    const _aliases = [];
    if (name) {
        _aliases.push(name);
    }
    if (aliases) {
        for (const alias of aliases) {
            _aliases.push(alias);
        }
    }
    return _aliases;
};
const getMiddlewareNameWithAliases = (name, aliases) => {
    return `${name || "anonymous"}${aliases && aliases.length > 0 ? ` (a.k.a. ${aliases.join(",")})` : ""}`;
};
const constructStack = () => {
    let absoluteEntries = [];
    let relativeEntries = [];
    let identifyOnResolve = false;
    const entriesNameSet = new Set();
    const sort = (entries) => entries.sort((a, b) => stepWeights[b.step] - stepWeights[a.step] ||
        priorityWeights[b.priority || "normal"] - priorityWeights[a.priority || "normal"]);
    const removeByName = (toRemove) => {
        let isRemoved = false;
        const filterCb = (entry) => {
            const aliases = getAllAliases(entry.name, entry.aliases);
            if (aliases.includes(toRemove)) {
                isRemoved = true;
                for (const alias of aliases) {
                    entriesNameSet.delete(alias);
                }
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    const removeByReference = (toRemove) => {
        let isRemoved = false;
        const filterCb = (entry) => {
            if (entry.middleware === toRemove) {
                isRemoved = true;
                for (const alias of getAllAliases(entry.name, entry.aliases)) {
                    entriesNameSet.delete(alias);
                }
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    const cloneTo = (toStack) => {
        absoluteEntries.forEach((entry) => {
            toStack.add(entry.middleware, { ...entry });
        });
        relativeEntries.forEach((entry) => {
            toStack.addRelativeTo(entry.middleware, { ...entry });
        });
        toStack.identifyOnResolve?.(stack.identifyOnResolve());
        return toStack;
    };
    const expandRelativeMiddlewareList = (from) => {
        const expandedMiddlewareList = [];
        from.before.forEach((entry) => {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
            }
        });
        expandedMiddlewareList.push(from);
        from.after.reverse().forEach((entry) => {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
            }
        });
        return expandedMiddlewareList;
    };
    const getMiddlewareList = (debug = false) => {
        const normalizedAbsoluteEntries = [];
        const normalizedRelativeEntries = [];
        const normalizedEntriesNameMap = {};
        absoluteEntries.forEach((entry) => {
            const normalizedEntry = {
                ...entry,
                before: [],
                after: [],
            };
            for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
                normalizedEntriesNameMap[alias] = normalizedEntry;
            }
            normalizedAbsoluteEntries.push(normalizedEntry);
        });
        relativeEntries.forEach((entry) => {
            const normalizedEntry = {
                ...entry,
                before: [],
                after: [],
            };
            for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
                normalizedEntriesNameMap[alias] = normalizedEntry;
            }
            normalizedRelativeEntries.push(normalizedEntry);
        });
        normalizedRelativeEntries.forEach((entry) => {
            if (entry.toMiddleware) {
                const toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
                if (toMiddleware === undefined) {
                    if (debug) {
                        return;
                    }
                    throw new Error(`${entry.toMiddleware} is not found when adding ` +
                        `${getMiddlewareNameWithAliases(entry.name, entry.aliases)} ` +
                        `middleware ${entry.relation} ${entry.toMiddleware}`);
                }
                if (entry.relation === "after") {
                    toMiddleware.after.push(entry);
                }
                if (entry.relation === "before") {
                    toMiddleware.before.push(entry);
                }
            }
        });
        const mainChain = sort(normalizedAbsoluteEntries)
            .map(expandRelativeMiddlewareList)
            .reduce((wholeList, expandedMiddlewareList) => {
            wholeList.push(...expandedMiddlewareList);
            return wholeList;
        }, []);
        return mainChain;
    };
    const stack = {
        add: (middleware, options = {}) => {
            const { name, override, aliases: _aliases } = options;
            const entry = {
                step: "initialize",
                priority: "normal",
                middleware,
                ...options,
            };
            const aliases = getAllAliases(name, _aliases);
            if (aliases.length > 0) {
                if (aliases.some((alias) => entriesNameSet.has(alias))) {
                    if (!override)
                        throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
                    for (const alias of aliases) {
                        const toOverrideIndex = absoluteEntries.findIndex((entry) => entry.name === alias || entry.aliases?.some((a) => a === alias));
                        if (toOverrideIndex === -1) {
                            continue;
                        }
                        const toOverride = absoluteEntries[toOverrideIndex];
                        if (toOverride.step !== entry.step || entry.priority !== toOverride.priority) {
                            throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware with ` +
                                `${toOverride.priority} priority in ${toOverride.step} step cannot ` +
                                `be overridden by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware with ` +
                                `${entry.priority} priority in ${entry.step} step.`);
                        }
                        absoluteEntries.splice(toOverrideIndex, 1);
                    }
                }
                for (const alias of aliases) {
                    entriesNameSet.add(alias);
                }
            }
            absoluteEntries.push(entry);
        },
        addRelativeTo: (middleware, options) => {
            const { name, override, aliases: _aliases } = options;
            const entry = {
                middleware,
                ...options,
            };
            const aliases = getAllAliases(name, _aliases);
            if (aliases.length > 0) {
                if (aliases.some((alias) => entriesNameSet.has(alias))) {
                    if (!override)
                        throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
                    for (const alias of aliases) {
                        const toOverrideIndex = relativeEntries.findIndex((entry) => entry.name === alias || entry.aliases?.some((a) => a === alias));
                        if (toOverrideIndex === -1) {
                            continue;
                        }
                        const toOverride = relativeEntries[toOverrideIndex];
                        if (toOverride.toMiddleware !== entry.toMiddleware || toOverride.relation !== entry.relation) {
                            throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware ` +
                                `${toOverride.relation} "${toOverride.toMiddleware}" middleware cannot be overridden ` +
                                `by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware ${entry.relation} ` +
                                `"${entry.toMiddleware}" middleware.`);
                        }
                        relativeEntries.splice(toOverrideIndex, 1);
                    }
                }
                for (const alias of aliases) {
                    entriesNameSet.add(alias);
                }
            }
            relativeEntries.push(entry);
        },
        clone: () => cloneTo(constructStack()),
        use: (plugin) => {
            plugin.applyToStack(stack);
        },
        remove: (toRemove) => {
            if (typeof toRemove === "string")
                return removeByName(toRemove);
            else
                return removeByReference(toRemove);
        },
        removeByTag: (toRemove) => {
            let isRemoved = false;
            const filterCb = (entry) => {
                const { tags, name, aliases: _aliases } = entry;
                if (tags && tags.includes(toRemove)) {
                    const aliases = getAllAliases(name, _aliases);
                    for (const alias of aliases) {
                        entriesNameSet.delete(alias);
                    }
                    isRemoved = true;
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        },
        concat: (from) => {
            const cloned = cloneTo(constructStack());
            cloned.use(from);
            cloned.identifyOnResolve(identifyOnResolve || cloned.identifyOnResolve() || (from.identifyOnResolve?.() ?? false));
            return cloned;
        },
        applyToStack: cloneTo,
        identify: () => {
            return getMiddlewareList(true).map((mw) => {
                const step = mw.step ??
                    mw.relation +
                        " " +
                        mw.toMiddleware;
                return getMiddlewareNameWithAliases(mw.name, mw.aliases) + " - " + step;
            });
        },
        identifyOnResolve(toggle) {
            if (typeof toggle === "boolean")
                identifyOnResolve = toggle;
            return identifyOnResolve;
        },
        resolve: (handler, context) => {
            for (const middleware of getMiddlewareList()
                .map((entry) => entry.middleware)
                .reverse()) {
                handler = middleware(handler, context);
            }
            if (identifyOnResolve) {
                console.log(stack.identify());
            }
            return handler;
        },
    };
    return stack;
};
const stepWeights = {
    initialize: 5,
    serialize: 4,
    build: 3,
    finalizeRequest: 2,
    deserialize: 1,
};
const priorityWeights = {
    high: 3,
    normal: 2,
    low: 1,
};


/***/ }),

/***/ 2049:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveAWSSDKSigV4Config: () => (/* binding */ resolveAWSSDKSigV4Config),
/* harmony export */   resolveAwsSdkSigV4Config: () => (/* binding */ resolveAwsSdkSigV4Config)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1333);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2050);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1445);
/* harmony import */ var _smithy_signature_v4__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1458);



const resolveAwsSdkSigV4Config = (config) => {
    let inputCredentials = config.credentials;
    let isUserSupplied = !!config.credentials;
    let resolvedCredentials = undefined;
    Object.defineProperty(config, "credentials", {
        set(credentials) {
            if (credentials && credentials !== inputCredentials && credentials !== resolvedCredentials) {
                isUserSupplied = true;
            }
            inputCredentials = credentials;
            const memoizedProvider = normalizeCredentialProvider(config, {
                credentials: inputCredentials,
                credentialDefaultProvider: config.credentialDefaultProvider,
            });
            const boundProvider = bindCallerConfig(config, memoizedProvider);
            if (isUserSupplied && !boundProvider.attributed) {
                resolvedCredentials = async (options) => boundProvider(options).then((creds) => (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__.setCredentialFeature)(creds, "CREDENTIALS_CODE", "e"));
                resolvedCredentials.memoized = boundProvider.memoized;
                resolvedCredentials.configBound = boundProvider.configBound;
                resolvedCredentials.attributed = true;
            }
            else {
                resolvedCredentials = boundProvider;
            }
        },
        get() {
            return resolvedCredentials;
        },
        enumerable: true,
        configurable: true,
    });
    config.credentials = inputCredentials;
    const { signingEscapePath = true, systemClockOffset = config.systemClockOffset || 0, sha256, } = config;
    let signer;
    if (config.signer) {
        signer = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_2__.normalizeProvider)(config.signer);
    }
    else if (config.regionInfoProvider) {
        signer = () => (0,_smithy_core__WEBPACK_IMPORTED_MODULE_2__.normalizeProvider)(config.region)()
            .then(async (region) => [
            (await config.regionInfoProvider(region, {
                useFipsEndpoint: await config.useFipsEndpoint(),
                useDualstackEndpoint: await config.useDualstackEndpoint(),
            })) || {},
            region,
        ])
            .then(([regionInfo, region]) => {
            const { signingRegion, signingService } = regionInfo;
            config.signingRegion = config.signingRegion || signingRegion || region;
            config.signingName = config.signingName || signingService || config.serviceId;
            const params = {
                ...config,
                credentials: config.credentials,
                region: config.signingRegion,
                service: config.signingName,
                sha256,
                uriEscapePath: signingEscapePath,
            };
            const SignerCtor = config.signerConstructor || _smithy_signature_v4__WEBPACK_IMPORTED_MODULE_3__.SignatureV4;
            return new SignerCtor(params);
        });
    }
    else {
        signer = async (authScheme) => {
            authScheme = Object.assign({}, {
                name: "sigv4",
                signingName: config.signingName || config.defaultSigningName,
                signingRegion: await (0,_smithy_core__WEBPACK_IMPORTED_MODULE_2__.normalizeProvider)(config.region)(),
                properties: {},
            }, authScheme);
            const signingRegion = authScheme.signingRegion;
            const signingService = authScheme.signingName;
            config.signingRegion = config.signingRegion || signingRegion;
            config.signingName = config.signingName || signingService || config.serviceId;
            const params = {
                ...config,
                credentials: config.credentials,
                region: config.signingRegion,
                service: config.signingName,
                sha256,
                uriEscapePath: signingEscapePath,
            };
            const SignerCtor = config.signerConstructor || _smithy_signature_v4__WEBPACK_IMPORTED_MODULE_3__.SignatureV4;
            return new SignerCtor(params);
        };
    }
    const resolvedConfig = Object.assign(config, {
        systemClockOffset,
        signingEscapePath,
        signer,
    });
    return resolvedConfig;
};
const resolveAWSSDKSigV4Config = resolveAwsSdkSigV4Config;
function normalizeCredentialProvider(config, { credentials, credentialDefaultProvider, }) {
    let credentialsProvider;
    if (credentials) {
        if (!credentials?.memoized) {
            credentialsProvider = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_1__.memoizeIdentityProvider)(credentials, _smithy_core__WEBPACK_IMPORTED_MODULE_1__.isIdentityExpired, _smithy_core__WEBPACK_IMPORTED_MODULE_1__.doesIdentityRequireRefresh);
        }
        else {
            credentialsProvider = credentials;
        }
    }
    else {
        if (credentialDefaultProvider) {
            credentialsProvider = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_2__.normalizeProvider)(credentialDefaultProvider(Object.assign({}, config, {
                parentClientConfig: config,
            })));
        }
        else {
            credentialsProvider = async () => {
                throw new Error("@aws-sdk/core::resolveAwsSdkSigV4Config - `credentials` not provided and no credentialDefaultProvider was configured.");
            };
        }
    }
    credentialsProvider.memoized = true;
    return credentialsProvider;
}
function bindCallerConfig(config, credentialsProvider) {
    if (credentialsProvider.configBound) {
        return credentialsProvider;
    }
    const fn = async (options) => credentialsProvider({ ...options, callerClientConfig: config });
    fn.memoized = credentialsProvider.memoized;
    fn.configBound = true;
    return fn;
}


/***/ }),

/***/ 2050:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EXPIRATION_MS: () => (/* binding */ EXPIRATION_MS),
/* harmony export */   createIsIdentityExpiredFunction: () => (/* binding */ createIsIdentityExpiredFunction),
/* harmony export */   doesIdentityRequireRefresh: () => (/* binding */ doesIdentityRequireRefresh),
/* harmony export */   isIdentityExpired: () => (/* binding */ isIdentityExpired),
/* harmony export */   memoizeIdentityProvider: () => (/* binding */ memoizeIdentityProvider)
/* harmony export */ });
const createIsIdentityExpiredFunction = (expirationMs) => function isIdentityExpired(identity) {
    return doesIdentityRequireRefresh(identity) && identity.expiration.getTime() - Date.now() < expirationMs;
};
const EXPIRATION_MS = 300_000;
const isIdentityExpired = createIsIdentityExpiredFunction(EXPIRATION_MS);
const doesIdentityRequireRefresh = (identity) => identity.expiration !== undefined;
const memoizeIdentityProvider = (provider, isExpired, requiresRefresh) => {
    if (provider === undefined) {
        return undefined;
    }
    const normalizedProvider = typeof provider !== "function" ? async () => Promise.resolve(provider) : provider;
    let resolved;
    let pending;
    let hasResult;
    let isConstant = false;
    const coalesceProvider = async (options) => {
        if (!pending) {
            pending = normalizedProvider(options);
        }
        try {
            resolved = await pending;
            hasResult = true;
            isConstant = false;
        }
        finally {
            pending = undefined;
        }
        return resolved;
    };
    if (isExpired === undefined) {
        return async (options) => {
            if (!hasResult || options?.forceRefresh) {
                resolved = await coalesceProvider(options);
            }
            return resolved;
        };
    }
    return async (options) => {
        if (!hasResult || options?.forceRefresh) {
            resolved = await coalesceProvider(options);
        }
        if (isConstant) {
            return resolved;
        }
        if (!requiresRefresh(resolved)) {
            isConstant = true;
            return resolved;
        }
        if (isExpired(resolved)) {
            await coalesceProvider(options);
            return resolved;
        }
        return resolved;
    };
};


/***/ }),

/***/ 2054:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   emitWarningIfUnsupportedVersion: () => (/* binding */ emitWarningIfUnsupportedVersion),
/* harmony export */   state: () => (/* binding */ state)
/* harmony export */ });
const state = {
    warningEmitted: false,
};
const emitWarningIfUnsupportedVersion = (version) => {
    if (version && !state.warningEmitted && parseInt(version.substring(1, version.indexOf("."))) < 20) {
        state.warningEmitted = true;
        process.emitWarning(`NodeDeprecationWarning: The AWS SDK for JavaScript (v3) will
no longer support Node.js ${version} in January 2026.

To continue receiving updates to AWS services, bug fixes, and security
updates please upgrade to a supported Node.js LTS version.

More information can be found at: https://a.co/c895JFp`);
    }
};


/***/ }),

/***/ 2055:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NODE_AUTH_SCHEME_PREFERENCE_OPTIONS: () => (/* binding */ NODE_AUTH_SCHEME_PREFERENCE_OPTIONS)
/* harmony export */ });
/* harmony import */ var _utils_getArrayForCommaSeparatedString__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2056);
/* harmony import */ var _utils_getBearerTokenEnvKey__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2057);


const NODE_AUTH_SCHEME_PREFERENCE_ENV_KEY = "AWS_AUTH_SCHEME_PREFERENCE";
const NODE_AUTH_SCHEME_PREFERENCE_CONFIG_KEY = "auth_scheme_preference";
const NODE_AUTH_SCHEME_PREFERENCE_OPTIONS = {
    environmentVariableSelector: (env, options) => {
        if (options?.signingName) {
            const bearerTokenKey = (0,_utils_getBearerTokenEnvKey__WEBPACK_IMPORTED_MODULE_1__.getBearerTokenEnvKey)(options.signingName);
            if (bearerTokenKey in env)
                return ["httpBearerAuth"];
        }
        if (!(NODE_AUTH_SCHEME_PREFERENCE_ENV_KEY in env))
            return undefined;
        return (0,_utils_getArrayForCommaSeparatedString__WEBPACK_IMPORTED_MODULE_0__.getArrayForCommaSeparatedString)(env[NODE_AUTH_SCHEME_PREFERENCE_ENV_KEY]);
    },
    configFileSelector: (profile) => {
        if (!(NODE_AUTH_SCHEME_PREFERENCE_CONFIG_KEY in profile))
            return undefined;
        return (0,_utils_getArrayForCommaSeparatedString__WEBPACK_IMPORTED_MODULE_0__.getArrayForCommaSeparatedString)(profile[NODE_AUTH_SCHEME_PREFERENCE_CONFIG_KEY]);
    },
    default: [],
};


/***/ }),

/***/ 2056:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getArrayForCommaSeparatedString: () => (/* binding */ getArrayForCommaSeparatedString)
/* harmony export */ });
const getArrayForCommaSeparatedString = (str) => typeof str === "string" && str.length > 0 ? str.split(",").map((item) => item.trim()) : [];


/***/ }),

/***/ 2057:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getBearerTokenEnvKey: () => (/* binding */ getBearerTokenEnvKey)
/* harmony export */ });
const getBearerTokenEnvKey = (signingName) => `AWS_BEARER_TOKEN_${signingName.replace(/[\s-]/g, "_").toUpperCase()}`;


/***/ }),

/***/ 2058:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createDefaultUserAgentProvider: () => (/* binding */ createDefaultUserAgentProvider),
/* harmony export */   crtAvailability: () => (/* reexport safe */ _crt_availability__WEBPACK_IMPORTED_MODULE_3__.crtAvailability),
/* harmony export */   defaultUserAgent: () => (/* binding */ defaultUserAgent)
/* harmony export */ });
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(850);
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(os__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var process__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2059);
/* harmony import */ var process__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(process__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _is_crt_available__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2060);
/* harmony import */ var _crt_availability__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2061);




const createDefaultUserAgentProvider = ({ serviceId, clientVersion }) => {
    return async (config) => {
        const sections = [
            ["aws-sdk-js", clientVersion],
            ["ua", "2.1"],
            [`os/${(0,os__WEBPACK_IMPORTED_MODULE_0__.platform)()}`, (0,os__WEBPACK_IMPORTED_MODULE_0__.release)()],
            ["lang/js"],
            ["md/nodejs", `${process__WEBPACK_IMPORTED_MODULE_1__.versions.node}`],
        ];
        const crtAvailable = (0,_is_crt_available__WEBPACK_IMPORTED_MODULE_2__.isCrtAvailable)();
        if (crtAvailable) {
            sections.push(crtAvailable);
        }
        if (serviceId) {
            sections.push([`api/${serviceId}`, clientVersion]);
        }
        if (process__WEBPACK_IMPORTED_MODULE_1__.env.AWS_EXECUTION_ENV) {
            sections.push([`exec-env/${process__WEBPACK_IMPORTED_MODULE_1__.env.AWS_EXECUTION_ENV}`]);
        }
        const appId = await config?.userAgentAppId?.();
        const resolvedUserAgent = appId ? [...sections, [`app/${appId}`]] : [...sections];
        return resolvedUserAgent;
    };
};
const defaultUserAgent = createDefaultUserAgentProvider;


/***/ }),

/***/ 2060:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isCrtAvailable: () => (/* binding */ isCrtAvailable)
/* harmony export */ });
/* harmony import */ var _crt_availability__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2061);

const isCrtAvailable = () => {
    if (_crt_availability__WEBPACK_IMPORTED_MODULE_0__.crtAvailability.isCrtAvailable) {
        return ["md/crt-avail"];
    }
    return null;
};


/***/ }),

/***/ 2061:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   crtAvailability: () => (/* binding */ crtAvailability)
/* harmony export */ });
const crtAvailability = {
    isCrtAvailable: false,
};


/***/ }),

/***/ 2062:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NODE_APP_ID_CONFIG_OPTIONS: () => (/* binding */ NODE_APP_ID_CONFIG_OPTIONS),
/* harmony export */   UA_APP_ID_ENV_NAME: () => (/* binding */ UA_APP_ID_ENV_NAME),
/* harmony export */   UA_APP_ID_INI_NAME: () => (/* binding */ UA_APP_ID_INI_NAME)
/* harmony export */ });
/* harmony import */ var _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1958);

const UA_APP_ID_ENV_NAME = "AWS_SDK_UA_APP_ID";
const UA_APP_ID_INI_NAME = "sdk_ua_app_id";
const UA_APP_ID_INI_NAME_DEPRECATED = "sdk-ua-app-id";
const NODE_APP_ID_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => env[UA_APP_ID_ENV_NAME],
    configFileSelector: (profile) => profile[UA_APP_ID_INI_NAME] ?? profile[UA_APP_ID_INI_NAME_DEPRECATED],
    default: _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_UA_APP_ID,
};


/***/ }),

/***/ 2063:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONFIG_USE_DUALSTACK_ENDPOINT: () => (/* binding */ CONFIG_USE_DUALSTACK_ENDPOINT),
/* harmony export */   DEFAULT_USE_DUALSTACK_ENDPOINT: () => (/* binding */ DEFAULT_USE_DUALSTACK_ENDPOINT),
/* harmony export */   ENV_USE_DUALSTACK_ENDPOINT: () => (/* binding */ ENV_USE_DUALSTACK_ENDPOINT),
/* harmony export */   NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS: () => (/* binding */ NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS)
/* harmony export */ });
/* harmony import */ var _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2064);
/* harmony import */ var _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2065);

const ENV_USE_DUALSTACK_ENDPOINT = "AWS_USE_DUALSTACK_ENDPOINT";
const CONFIG_USE_DUALSTACK_ENDPOINT = "use_dualstack_endpoint";
const DEFAULT_USE_DUALSTACK_ENDPOINT = false;
const NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => (0,_smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_0__.booleanSelector)(env, ENV_USE_DUALSTACK_ENDPOINT, _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_1__.SelectorType.ENV),
    configFileSelector: (profile) => (0,_smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_0__.booleanSelector)(profile, CONFIG_USE_DUALSTACK_ENDPOINT, _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_1__.SelectorType.CONFIG),
    default: false,
};


/***/ }),

/***/ 2064:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   booleanSelector: () => (/* binding */ booleanSelector)
/* harmony export */ });
const booleanSelector = (obj, key, type) => {
    if (!(key in obj))
        return undefined;
    if (obj[key] === "true")
        return true;
    if (obj[key] === "false")
        return false;
    throw new Error(`Cannot load ${type} "${key}". Expected "true" or "false", got ${obj[key]}.`);
};


/***/ }),

/***/ 2065:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SelectorType: () => (/* binding */ SelectorType)
/* harmony export */ });
var SelectorType;
(function (SelectorType) {
    SelectorType["ENV"] = "env";
    SelectorType["CONFIG"] = "shared config entry";
})(SelectorType || (SelectorType = {}));


/***/ }),

/***/ 2066:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONFIG_USE_FIPS_ENDPOINT: () => (/* binding */ CONFIG_USE_FIPS_ENDPOINT),
/* harmony export */   DEFAULT_USE_FIPS_ENDPOINT: () => (/* binding */ DEFAULT_USE_FIPS_ENDPOINT),
/* harmony export */   ENV_USE_FIPS_ENDPOINT: () => (/* binding */ ENV_USE_FIPS_ENDPOINT),
/* harmony export */   NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS: () => (/* binding */ NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS)
/* harmony export */ });
/* harmony import */ var _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2064);
/* harmony import */ var _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2065);

const ENV_USE_FIPS_ENDPOINT = "AWS_USE_FIPS_ENDPOINT";
const CONFIG_USE_FIPS_ENDPOINT = "use_fips_endpoint";
const DEFAULT_USE_FIPS_ENDPOINT = false;
const NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => (0,_smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_0__.booleanSelector)(env, ENV_USE_FIPS_ENDPOINT, _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_1__.SelectorType.ENV),
    configFileSelector: (profile) => (0,_smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_0__.booleanSelector)(profile, CONFIG_USE_FIPS_ENDPOINT, _smithy_util_config_provider__WEBPACK_IMPORTED_MODULE_1__.SelectorType.CONFIG),
    default: false,
};


/***/ }),

/***/ 2067:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Hash: () => (/* binding */ Hash)
/* harmony export */ });
/* harmony import */ var _smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1356);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2068);
/* harmony import */ var buffer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1307);
/* harmony import */ var buffer__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(buffer__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(379);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_3__);




class Hash {
    algorithmIdentifier;
    secret;
    hash;
    constructor(algorithmIdentifier, secret) {
        this.algorithmIdentifier = algorithmIdentifier;
        this.secret = secret;
        this.reset();
    }
    update(toHash, encoding) {
        this.hash.update((0,_smithy_util_utf8__WEBPACK_IMPORTED_MODULE_1__.toUint8Array)(castSourceData(toHash, encoding)));
    }
    digest() {
        return Promise.resolve(this.hash.digest());
    }
    reset() {
        this.hash = this.secret
            ? (0,crypto__WEBPACK_IMPORTED_MODULE_3__.createHmac)(this.algorithmIdentifier, castSourceData(this.secret))
            : (0,crypto__WEBPACK_IMPORTED_MODULE_3__.createHash)(this.algorithmIdentifier);
    }
}
function castSourceData(toCast, encoding) {
    if (buffer__WEBPACK_IMPORTED_MODULE_2__.Buffer.isBuffer(toCast)) {
        return toCast;
    }
    if (typeof toCast === "string") {
        return (0,_smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__.fromString)(toCast, encoding);
    }
    if (ArrayBuffer.isView(toCast)) {
        return (0,_smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__.fromArrayBuffer)(toCast.buffer, toCast.byteOffset, toCast.byteLength);
    }
    return (0,_smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__.fromArrayBuffer)(toCast);
}


/***/ }),

/***/ 2068:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   toUint8Array: () => (/* binding */ toUint8Array)
/* harmony export */ });
/* harmony import */ var _fromUtf8__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2069);

const toUint8Array = (data) => {
    if (typeof data === "string") {
        return (0,_fromUtf8__WEBPACK_IMPORTED_MODULE_0__.fromUtf8)(data);
    }
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
    }
    return new Uint8Array(data);
};


/***/ }),

/***/ 2069:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromUtf8: () => (/* binding */ fromUtf8)
/* harmony export */ });
/* harmony import */ var _smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1356);

const fromUtf8 = (input) => {
    const buf = (0,_smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__.fromString)(input, "utf8");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength / Uint8Array.BYTES_PER_ELEMENT);
};


/***/ }),

/***/ 2070:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loadConfigsForDefaultMode: () => (/* binding */ loadConfigsForDefaultMode)
/* harmony export */ });
const loadConfigsForDefaultMode = (mode) => {
    switch (mode) {
        case "standard":
            return {
                retryMode: "standard",
                connectionTimeout: 3100,
            };
        case "in-region":
            return {
                retryMode: "standard",
                connectionTimeout: 1100,
            };
        case "cross-region":
            return {
                retryMode: "standard",
                connectionTimeout: 3100,
            };
        case "mobile":
            return {
                retryMode: "standard",
                connectionTimeout: 30000,
            };
        default:
            return {};
    }
};


/***/ }),

/***/ 2071:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   emitWarningIfUnsupportedVersion: () => (/* binding */ emitWarningIfUnsupportedVersion)
/* harmony export */ });
let warningEmitted = false;
const emitWarningIfUnsupportedVersion = (version) => {
    if (version && !warningEmitted && parseInt(version.substring(1, version.indexOf("."))) < 16) {
        warningEmitted = true;
    }
};


/***/ }),

/***/ 2072:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   calculateBodyLength: () => (/* binding */ calculateBodyLength)
/* harmony export */ });
/* harmony import */ var node_fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(51);
/* harmony import */ var node_fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(node_fs__WEBPACK_IMPORTED_MODULE_0__);

const calculateBodyLength = (body) => {
    if (!body) {
        return 0;
    }
    if (typeof body === "string") {
        return Buffer.byteLength(body);
    }
    else if (typeof body.byteLength === "number") {
        return body.byteLength;
    }
    else if (typeof body.size === "number") {
        return body.size;
    }
    else if (typeof body.start === "number" && typeof body.end === "number") {
        return body.end + 1 - body.start;
    }
    else if (body instanceof node_fs__WEBPACK_IMPORTED_MODULE_0__.ReadStream) {
        if (body.path != null) {
            return (0,node_fs__WEBPACK_IMPORTED_MODULE_0__.lstatSync)(body.path).size;
        }
        else if (typeof body.fd === "number") {
            return (0,node_fs__WEBPACK_IMPORTED_MODULE_0__.fstatSync)(body.fd).size;
        }
    }
    throw new Error(`Body Length computation failed for ${body}`);
};


/***/ }),

/***/ 2073:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveDefaultsModeConfig: () => (/* binding */ resolveDefaultsModeConfig)
/* harmony export */ });
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1443);
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1398);
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1399);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2074);
/* harmony import */ var _defaultsModeConfig__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2075);





const resolveDefaultsModeConfig = ({ region = (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_1__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_0__.NODE_REGION_CONFIG_OPTIONS), defaultsMode = (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_1__.loadConfig)(_defaultsModeConfig__WEBPACK_IMPORTED_MODULE_4__.NODE_DEFAULTS_MODE_CONFIG_OPTIONS), } = {}) => (0,_smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.memoize)(async () => {
    const mode = typeof defaultsMode === "function" ? await defaultsMode() : defaultsMode;
    switch (mode?.toLowerCase()) {
        case "auto":
            return resolveNodeDefaultsModeAuto(region);
        case "in-region":
        case "cross-region":
        case "mobile":
        case "standard":
        case "legacy":
            return Promise.resolve(mode?.toLocaleLowerCase());
        case undefined:
            return Promise.resolve("legacy");
        default:
            throw new Error(`Invalid parameter for "defaultsMode", expect ${_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULTS_MODE_OPTIONS.join(", ")}, got ${mode}`);
    }
});
const resolveNodeDefaultsModeAuto = async (clientRegion) => {
    if (clientRegion) {
        const resolvedRegion = typeof clientRegion === "function" ? await clientRegion() : clientRegion;
        const inferredRegion = await inferPhysicalRegion();
        if (!inferredRegion) {
            return "standard";
        }
        if (resolvedRegion === inferredRegion) {
            return "in-region";
        }
        else {
            return "cross-region";
        }
    }
    return "standard";
};
const inferPhysicalRegion = async () => {
    if (process.env[_constants__WEBPACK_IMPORTED_MODULE_3__.AWS_EXECUTION_ENV] && (process.env[_constants__WEBPACK_IMPORTED_MODULE_3__.AWS_REGION_ENV] || process.env[_constants__WEBPACK_IMPORTED_MODULE_3__.AWS_DEFAULT_REGION_ENV])) {
        return process.env[_constants__WEBPACK_IMPORTED_MODULE_3__.AWS_REGION_ENV] ?? process.env[_constants__WEBPACK_IMPORTED_MODULE_3__.AWS_DEFAULT_REGION_ENV];
    }
    if (!process.env[_constants__WEBPACK_IMPORTED_MODULE_3__.ENV_IMDS_DISABLED]) {
        try {
            const { getInstanceMetadataEndpoint, httpRequest } = await __webpack_require__.e(/* import() */ 12).then(__webpack_require__.bind(__webpack_require__, 2183));
            const endpoint = await getInstanceMetadataEndpoint();
            return (await httpRequest({ ...endpoint, path: _constants__WEBPACK_IMPORTED_MODULE_3__.IMDS_REGION_PATH })).toString();
        }
        catch (e) {
        }
    }
};


/***/ }),

/***/ 2074:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AWS_DEFAULT_REGION_ENV: () => (/* binding */ AWS_DEFAULT_REGION_ENV),
/* harmony export */   AWS_EXECUTION_ENV: () => (/* binding */ AWS_EXECUTION_ENV),
/* harmony export */   AWS_REGION_ENV: () => (/* binding */ AWS_REGION_ENV),
/* harmony export */   DEFAULTS_MODE_OPTIONS: () => (/* binding */ DEFAULTS_MODE_OPTIONS),
/* harmony export */   ENV_IMDS_DISABLED: () => (/* binding */ ENV_IMDS_DISABLED),
/* harmony export */   IMDS_REGION_PATH: () => (/* binding */ IMDS_REGION_PATH)
/* harmony export */ });
const AWS_EXECUTION_ENV = "AWS_EXECUTION_ENV";
const AWS_REGION_ENV = "AWS_REGION";
const AWS_DEFAULT_REGION_ENV = "AWS_DEFAULT_REGION";
const ENV_IMDS_DISABLED = "AWS_EC2_METADATA_DISABLED";
const DEFAULTS_MODE_OPTIONS = ["in-region", "cross-region", "mobile", "standard", "legacy"];
const IMDS_REGION_PATH = "/latest/meta-data/placement/region";


/***/ }),

/***/ 2075:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NODE_DEFAULTS_MODE_CONFIG_OPTIONS: () => (/* binding */ NODE_DEFAULTS_MODE_CONFIG_OPTIONS)
/* harmony export */ });
const AWS_DEFAULTS_MODE_ENV = "AWS_DEFAULTS_MODE";
const AWS_DEFAULTS_MODE_CONFIG = "defaults_mode";
const NODE_DEFAULTS_MODE_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => {
        return env[AWS_DEFAULTS_MODE_ENV];
    },
    configFileSelector: (profile) => {
        return profile[AWS_DEFAULTS_MODE_CONFIG];
    },
    default: "legacy",
};


/***/ }),

/***/ 2077:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AWSSDKSigV4Signer: () => (/* binding */ AWSSDKSigV4Signer),
/* harmony export */   AwsSdkSigV4Signer: () => (/* binding */ AwsSdkSigV4Signer),
/* harmony export */   validateSigningProperties: () => (/* binding */ validateSigningProperties)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1350);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2078);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2079);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2080);


const throwSigningPropertyError = (name, property) => {
    if (!property) {
        throw new Error(`Property \`${name}\` is not resolved for AWS SDK SigV4Auth`);
    }
    return property;
};
const validateSigningProperties = async (signingProperties) => {
    const context = throwSigningPropertyError("context", signingProperties.context);
    const config = throwSigningPropertyError("config", signingProperties.config);
    const authScheme = context.endpointV2?.properties?.authSchemes?.[0];
    const signerFunction = throwSigningPropertyError("signer", config.signer);
    const signer = await signerFunction(authScheme);
    const signingRegion = signingProperties?.signingRegion;
    const signingRegionSet = signingProperties?.signingRegionSet;
    const signingName = signingProperties?.signingName;
    return {
        config,
        signer,
        signingRegion,
        signingRegionSet,
        signingName,
    };
};
class AwsSdkSigV4Signer {
    async sign(httpRequest, identity, signingProperties) {
        if (!_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpRequest.isInstance(httpRequest)) {
            throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
        }
        const validatedProps = await validateSigningProperties(signingProperties);
        const { config, signer } = validatedProps;
        let { signingRegion, signingName } = validatedProps;
        const handlerExecutionContext = signingProperties.context;
        if (handlerExecutionContext?.authSchemes?.length ?? 0 > 1) {
            const [first, second] = handlerExecutionContext.authSchemes;
            if (first?.name === "sigv4a" && second?.name === "sigv4") {
                signingRegion = second?.signingRegion ?? signingRegion;
                signingName = second?.signingName ?? signingName;
            }
        }
        const signedRequest = await signer.sign(httpRequest, {
            signingDate: (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getSkewCorrectedDate)(config.systemClockOffset),
            signingRegion: signingRegion,
            signingService: signingName,
        });
        return signedRequest;
    }
    errorHandler(signingProperties) {
        return (error) => {
            const serverTime = error.ServerTime ?? (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getDateHeader)(error.$response);
            if (serverTime) {
                const config = throwSigningPropertyError("config", signingProperties.config);
                const initialSystemClockOffset = config.systemClockOffset;
                config.systemClockOffset = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getUpdatedSystemClockOffset)(serverTime, config.systemClockOffset);
                const clockSkewCorrected = config.systemClockOffset !== initialSystemClockOffset;
                if (clockSkewCorrected && error.$metadata) {
                    error.$metadata.clockSkewCorrected = true;
                }
            }
            throw error;
        };
    }
    successHandler(httpResponse, signingProperties) {
        const dateHeader = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getDateHeader)(httpResponse);
        if (dateHeader) {
            const config = throwSigningPropertyError("config", signingProperties.config);
            config.systemClockOffset = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getUpdatedSystemClockOffset)(dateHeader, config.systemClockOffset);
        }
    }
}
const AWSSDKSigV4Signer = AwsSdkSigV4Signer;


/***/ }),

/***/ 2078:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getDateHeader: () => (/* binding */ getDateHeader)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1336);

const getDateHeader = (response) => _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpResponse.isInstance(response) ? response.headers?.date ?? response.headers?.Date : undefined;


/***/ }),

/***/ 2079:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSkewCorrectedDate: () => (/* binding */ getSkewCorrectedDate)
/* harmony export */ });
const getSkewCorrectedDate = (systemClockOffset) => new Date(Date.now() + systemClockOffset);


/***/ }),

/***/ 2080:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getUpdatedSystemClockOffset: () => (/* binding */ getUpdatedSystemClockOffset)
/* harmony export */ });
/* harmony import */ var _isClockSkewed__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2081);

const getUpdatedSystemClockOffset = (clockTime, currentSystemClockOffset) => {
    const clockTimeInMs = Date.parse(clockTime);
    if ((0,_isClockSkewed__WEBPACK_IMPORTED_MODULE_0__.isClockSkewed)(clockTimeInMs, currentSystemClockOffset)) {
        return clockTimeInMs - Date.now();
    }
    return currentSystemClockOffset;
};


/***/ }),

/***/ 2081:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isClockSkewed: () => (/* binding */ isClockSkewed)
/* harmony export */ });
/* harmony import */ var _getSkewCorrectedDate__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2079);

const isClockSkewed = (clockTime, systemClockOffset) => Math.abs((0,_getSkewCorrectedDate__WEBPACK_IMPORTED_MODULE_0__.getSkewCorrectedDate)(systemClockOffset).getTime() - clockTime) >= 300000;


/***/ }),

/***/ 2085:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NormalizedSchema: () => (/* binding */ NormalizedSchema),
/* harmony export */   isStaticSchema: () => (/* binding */ isStaticSchema)
/* harmony export */ });
/* harmony import */ var _deref__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2086);
/* harmony import */ var _translateTraits__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2087);


class NormalizedSchema {
    ref;
    memberName;
    static symbol = Symbol.for("@smithy/nor");
    symbol = NormalizedSchema.symbol;
    name;
    schema;
    _isMemberSchema;
    traits;
    memberTraits;
    normalizedTraits;
    constructor(ref, memberName) {
        this.ref = ref;
        this.memberName = memberName;
        const traitStack = [];
        let _ref = ref;
        let schema = ref;
        this._isMemberSchema = false;
        while (isMemberSchema(_ref)) {
            traitStack.push(_ref[1]);
            _ref = _ref[0];
            schema = (0,_deref__WEBPACK_IMPORTED_MODULE_0__.deref)(_ref);
            this._isMemberSchema = true;
        }
        if (traitStack.length > 0) {
            this.memberTraits = {};
            for (let i = traitStack.length - 1; i >= 0; --i) {
                const traitSet = traitStack[i];
                Object.assign(this.memberTraits, (0,_translateTraits__WEBPACK_IMPORTED_MODULE_1__.translateTraits)(traitSet));
            }
        }
        else {
            this.memberTraits = 0;
        }
        if (schema instanceof NormalizedSchema) {
            const computedMemberTraits = this.memberTraits;
            Object.assign(this, schema);
            this.memberTraits = Object.assign({}, computedMemberTraits, schema.getMemberTraits(), this.getMemberTraits());
            this.normalizedTraits = void 0;
            this.memberName = memberName ?? schema.memberName;
            return;
        }
        this.schema = (0,_deref__WEBPACK_IMPORTED_MODULE_0__.deref)(schema);
        if (isStaticSchema(this.schema)) {
            this.name = `${this.schema[1]}#${this.schema[2]}`;
            this.traits = this.schema[3];
        }
        else {
            this.name = this.memberName ?? String(schema);
            this.traits = 0;
        }
        if (this._isMemberSchema && !memberName) {
            throw new Error(`@smithy/core/schema - NormalizedSchema member init ${this.getName(true)} missing member name.`);
        }
    }
    static [Symbol.hasInstance](lhs) {
        const isPrototype = this.prototype.isPrototypeOf(lhs);
        if (!isPrototype && typeof lhs === "object" && lhs !== null) {
            const ns = lhs;
            return ns.symbol === this.symbol;
        }
        return isPrototype;
    }
    static of(ref) {
        const sc = (0,_deref__WEBPACK_IMPORTED_MODULE_0__.deref)(ref);
        if (sc instanceof NormalizedSchema) {
            return sc;
        }
        if (isMemberSchema(sc)) {
            const [ns, traits] = sc;
            if (ns instanceof NormalizedSchema) {
                Object.assign(ns.getMergedTraits(), (0,_translateTraits__WEBPACK_IMPORTED_MODULE_1__.translateTraits)(traits));
                return ns;
            }
            throw new Error(`@smithy/core/schema - may not init unwrapped member schema=${JSON.stringify(ref, null, 2)}.`);
        }
        return new NormalizedSchema(sc);
    }
    getSchema() {
        const sc = this.schema;
        if (sc[0] === 0) {
            return sc[4];
        }
        return sc;
    }
    getName(withNamespace = false) {
        const { name } = this;
        const short = !withNamespace && name && name.includes("#");
        return short ? name.split("#")[1] : name || undefined;
    }
    getMemberName() {
        return this.memberName;
    }
    isMemberSchema() {
        return this._isMemberSchema;
    }
    isListSchema() {
        const sc = this.getSchema();
        return typeof sc === "number"
            ? sc >= 64 && sc < 128
            : sc[0] === 1;
    }
    isMapSchema() {
        const sc = this.getSchema();
        return typeof sc === "number"
            ? sc >= 128 && sc <= 0b1111_1111
            : sc[0] === 2;
    }
    isStructSchema() {
        const sc = this.getSchema();
        return (sc[0] === 3 ||
            sc[0] === -3);
    }
    isBlobSchema() {
        const sc = this.getSchema();
        return sc === 21 || sc === 42;
    }
    isTimestampSchema() {
        const sc = this.getSchema();
        return (typeof sc === "number" &&
            sc >= 4 &&
            sc <= 7);
    }
    isUnitSchema() {
        return this.getSchema() === "unit";
    }
    isDocumentSchema() {
        return this.getSchema() === 15;
    }
    isStringSchema() {
        return this.getSchema() === 0;
    }
    isBooleanSchema() {
        return this.getSchema() === 2;
    }
    isNumericSchema() {
        return this.getSchema() === 1;
    }
    isBigIntegerSchema() {
        return this.getSchema() === 17;
    }
    isBigDecimalSchema() {
        return this.getSchema() === 19;
    }
    isStreaming() {
        const { streaming } = this.getMergedTraits();
        return !!streaming || this.getSchema() === 42;
    }
    isIdempotencyToken() {
        const match = (traits) => (traits & 0b0100) === 0b0100 ||
            !!traits?.idempotencyToken;
        const { normalizedTraits, traits, memberTraits } = this;
        return match(normalizedTraits) || match(traits) || match(memberTraits);
    }
    getMergedTraits() {
        return (this.normalizedTraits ??
            (this.normalizedTraits = {
                ...this.getOwnTraits(),
                ...this.getMemberTraits(),
            }));
    }
    getMemberTraits() {
        return (0,_translateTraits__WEBPACK_IMPORTED_MODULE_1__.translateTraits)(this.memberTraits);
    }
    getOwnTraits() {
        return (0,_translateTraits__WEBPACK_IMPORTED_MODULE_1__.translateTraits)(this.traits);
    }
    getKeySchema() {
        const [isDoc, isMap] = [this.isDocumentSchema(), this.isMapSchema()];
        if (!isDoc && !isMap) {
            throw new Error(`@smithy/core/schema - cannot get key for non-map: ${this.getName(true)}`);
        }
        const schema = this.getSchema();
        const memberSchema = isDoc
            ? 15
            : schema[4] ?? 0;
        return member([memberSchema, 0], "key");
    }
    getValueSchema() {
        const sc = this.getSchema();
        const [isDoc, isMap, isList] = [this.isDocumentSchema(), this.isMapSchema(), this.isListSchema()];
        const memberSchema = typeof sc === "number"
            ? 0b0011_1111 & sc
            : sc && typeof sc === "object" && (isMap || isList)
                ? sc[3 + sc[0]]
                : isDoc
                    ? 15
                    : void 0;
        if (memberSchema != null) {
            return member([memberSchema, 0], isMap ? "value" : "member");
        }
        throw new Error(`@smithy/core/schema - ${this.getName(true)} has no value member.`);
    }
    getMemberSchema(memberName) {
        const struct = this.getSchema();
        if (this.isStructSchema() && struct[4].includes(memberName)) {
            const i = struct[4].indexOf(memberName);
            const memberSchema = struct[5][i];
            return member(isMemberSchema(memberSchema) ? memberSchema : [memberSchema, 0], memberName);
        }
        if (this.isDocumentSchema()) {
            return member([15, 0], memberName);
        }
        throw new Error(`@smithy/core/schema - ${this.getName(true)} has no no member=${memberName}.`);
    }
    getMemberSchemas() {
        const buffer = {};
        try {
            for (const [k, v] of this.structIterator()) {
                buffer[k] = v;
            }
        }
        catch (ignored) { }
        return buffer;
    }
    getEventStreamMember() {
        if (this.isStructSchema()) {
            for (const [memberName, memberSchema] of this.structIterator()) {
                if (memberSchema.isStreaming() && memberSchema.isStructSchema()) {
                    return memberName;
                }
            }
        }
        return "";
    }
    *structIterator() {
        if (this.isUnitSchema()) {
            return;
        }
        if (!this.isStructSchema()) {
            throw new Error("@smithy/core/schema - cannot iterate non-struct schema.");
        }
        const struct = this.getSchema();
        for (let i = 0; i < struct[4].length; ++i) {
            yield [struct[4][i], member([struct[5][i], 0], struct[4][i])];
        }
    }
}
function member(memberSchema, memberName) {
    if (memberSchema instanceof NormalizedSchema) {
        return Object.assign(memberSchema, {
            memberName,
            _isMemberSchema: true,
        });
    }
    const internalCtorAccess = NormalizedSchema;
    return new internalCtorAccess(memberSchema, memberName);
}
const isMemberSchema = (sc) => Array.isArray(sc) && sc.length === 2;
const isStaticSchema = (sc) => Array.isArray(sc) && sc.length >= 5;


/***/ }),

/***/ 2086:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deref: () => (/* binding */ deref)
/* harmony export */ });
const deref = (schemaRef) => {
    if (typeof schemaRef === "function") {
        return schemaRef();
    }
    return schemaRef;
};


/***/ }),

/***/ 2087:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   translateTraits: () => (/* binding */ translateTraits)
/* harmony export */ });
function translateTraits(indicator) {
    if (typeof indicator === "object") {
        return indicator;
    }
    indicator = indicator | 0;
    const traits = {};
    let i = 0;
    for (const trait of [
        "httpLabel",
        "idempotent",
        "idempotencyToken",
        "sensitive",
        "httpPayload",
        "httpResponseCode",
        "httpQueryParams",
    ]) {
        if (((indicator >> i++) & 1) === 1) {
            traits[trait] = 1;
        }
    }
    return traits;
}


/***/ }),

/***/ 2088:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   collectBody: () => (/* binding */ collectBody)
/* harmony export */ });
/* harmony import */ var _smithy_util_stream__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2089);

const collectBody = async (streamBody = new Uint8Array(), context) => {
    if (streamBody instanceof Uint8Array) {
        return _smithy_util_stream__WEBPACK_IMPORTED_MODULE_0__.Uint8ArrayBlobAdapter.mutate(streamBody);
    }
    if (!streamBody) {
        return _smithy_util_stream__WEBPACK_IMPORTED_MODULE_0__.Uint8ArrayBlobAdapter.mutate(new Uint8Array());
    }
    const fromContext = context.streamCollector(streamBody);
    return _smithy_util_stream__WEBPACK_IMPORTED_MODULE_0__.Uint8ArrayBlobAdapter.mutate(await fromContext);
};


/***/ }),

/***/ 2089:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Uint8ArrayBlobAdapter: () => (/* binding */ Uint8ArrayBlobAdapter)
/* harmony export */ });
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1360);
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1361);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2090);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1364);


class Uint8ArrayBlobAdapter extends Uint8Array {
    static fromString(source, encoding = "utf-8") {
        if (typeof source === "string") {
            if (encoding === "base64") {
                return Uint8ArrayBlobAdapter.mutate((0,_smithy_util_base64__WEBPACK_IMPORTED_MODULE_0__.fromBase64)(source));
            }
            return Uint8ArrayBlobAdapter.mutate((0,_smithy_util_utf8__WEBPACK_IMPORTED_MODULE_2__.fromUtf8)(source));
        }
        throw new Error(`Unsupported conversion from ${typeof source} to Uint8ArrayBlobAdapter.`);
    }
    static mutate(source) {
        Object.setPrototypeOf(source, Uint8ArrayBlobAdapter.prototype);
        return source;
    }
    transformToString(encoding = "utf-8") {
        if (encoding === "base64") {
            return (0,_smithy_util_base64__WEBPACK_IMPORTED_MODULE_1__.toBase64)(this);
        }
        return (0,_smithy_util_utf8__WEBPACK_IMPORTED_MODULE_3__.toUtf8)(this);
    }
}


/***/ }),

/***/ 2090:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromUtf8: () => (/* binding */ fromUtf8)
/* harmony export */ });
/* harmony import */ var _smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1356);

const fromUtf8 = (input) => {
    const buf = (0,_smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__.fromString)(input, "utf8");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength / Uint8Array.BYTES_PER_ELEMENT);
};


/***/ }),

/***/ 2091:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   HttpProtocol: () => (/* binding */ HttpProtocol)
/* harmony export */ });
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2085);
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2087);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1350);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1336);
/* harmony import */ var _SerdeContext__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2092);



class HttpProtocol extends _SerdeContext__WEBPACK_IMPORTED_MODULE_4__.SerdeContext {
    options;
    constructor(options) {
        super();
        this.options = options;
    }
    getRequestType() {
        return _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__.HttpRequest;
    }
    getResponseType() {
        return _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_3__.HttpResponse;
    }
    setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
        this.serializer.setSerdeContext(serdeContext);
        this.deserializer.setSerdeContext(serdeContext);
        if (this.getPayloadCodec()) {
            this.getPayloadCodec().setSerdeContext(serdeContext);
        }
    }
    updateServiceEndpoint(request, endpoint) {
        if ("url" in endpoint) {
            request.protocol = endpoint.url.protocol;
            request.hostname = endpoint.url.hostname;
            request.port = endpoint.url.port ? Number(endpoint.url.port) : undefined;
            request.path = endpoint.url.pathname;
            request.fragment = endpoint.url.hash || void 0;
            request.username = endpoint.url.username || void 0;
            request.password = endpoint.url.password || void 0;
            if (!request.query) {
                request.query = {};
            }
            for (const [k, v] of endpoint.url.searchParams.entries()) {
                request.query[k] = v;
            }
            return request;
        }
        else {
            request.protocol = endpoint.protocol;
            request.hostname = endpoint.hostname;
            request.port = endpoint.port ? Number(endpoint.port) : undefined;
            request.path = endpoint.path;
            request.query = {
                ...endpoint.query,
            };
            return request;
        }
    }
    setHostPrefix(request, operationSchema, input) {
        const inputNs = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.NormalizedSchema.of(operationSchema.input);
        const opTraits = (0,_smithy_core_schema__WEBPACK_IMPORTED_MODULE_1__.translateTraits)(operationSchema.traits ?? {});
        if (opTraits.endpoint) {
            let hostPrefix = opTraits.endpoint?.[0];
            if (typeof hostPrefix === "string") {
                const hostLabelInputs = [...inputNs.structIterator()].filter(([, member]) => member.getMergedTraits().hostLabel);
                for (const [name] of hostLabelInputs) {
                    const replacement = input[name];
                    if (typeof replacement !== "string") {
                        throw new Error(`@smithy/core/schema - ${name} in input must be a string as hostLabel.`);
                    }
                    hostPrefix = hostPrefix.replace(`{${name}}`, replacement);
                }
                request.hostname = hostPrefix + request.hostname;
            }
        }
    }
    deserializeMetadata(output) {
        return {
            httpStatusCode: output.statusCode,
            requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
            extendedRequestId: output.headers["x-amz-id-2"],
            cfId: output.headers["x-amz-cf-id"],
        };
    }
    async serializeEventStream({ eventStream, requestSchema, initialRequest, }) {
        const eventStreamSerde = await this.loadEventStreamCapability();
        return eventStreamSerde.serializeEventStream({
            eventStream,
            requestSchema,
            initialRequest,
        });
    }
    async deserializeEventStream({ response, responseSchema, initialResponseContainer, }) {
        const eventStreamSerde = await this.loadEventStreamCapability();
        return eventStreamSerde.deserializeEventStream({
            response,
            responseSchema,
            initialResponseContainer,
        });
    }
    async loadEventStreamCapability() {
        const { EventStreamSerde } = await __webpack_require__.e(/* import() */ 8).then(__webpack_require__.bind(__webpack_require__, 2250));
        return new EventStreamSerde({
            marshaller: this.getEventStreamMarshaller(),
            serializer: this.serializer,
            deserializer: this.deserializer,
            serdeContext: this.serdeContext,
            defaultContentType: this.getDefaultContentType(),
        });
    }
    getDefaultContentType() {
        throw new Error(`@smithy/core/protocols - ${this.constructor.name} getDefaultContentType() implementation missing.`);
    }
    async deserializeHttpMessage(schema, context, response, arg4, arg5) {
        void schema;
        void context;
        void response;
        void arg4;
        void arg5;
        return [];
    }
    getEventStreamMarshaller() {
        const context = this.serdeContext;
        if (!context.eventStreamMarshaller) {
            throw new Error("@smithy/core - HttpProtocol: eventStreamMarshaller missing in serdeContext.");
        }
        return context.eventStreamMarshaller;
    }
}


/***/ }),

/***/ 2092:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SerdeContext: () => (/* binding */ SerdeContext)
/* harmony export */ });
class SerdeContext {
    serdeContext;
    setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
    }
}


/***/ }),

/***/ 2093:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TypeRegistry: () => (/* binding */ TypeRegistry)
/* harmony export */ });
class TypeRegistry {
    namespace;
    schemas;
    exceptions;
    static registries = new Map();
    constructor(namespace, schemas = new Map(), exceptions = new Map()) {
        this.namespace = namespace;
        this.schemas = schemas;
        this.exceptions = exceptions;
    }
    static for(namespace) {
        if (!TypeRegistry.registries.has(namespace)) {
            TypeRegistry.registries.set(namespace, new TypeRegistry(namespace));
        }
        return TypeRegistry.registries.get(namespace);
    }
    register(shapeId, schema) {
        const qualifiedName = this.normalizeShapeId(shapeId);
        const registry = TypeRegistry.for(qualifiedName.split("#")[0]);
        registry.schemas.set(qualifiedName, schema);
    }
    getSchema(shapeId) {
        const id = this.normalizeShapeId(shapeId);
        if (!this.schemas.has(id)) {
            throw new Error(`@smithy/core/schema - schema not found for ${id}`);
        }
        return this.schemas.get(id);
    }
    registerError(es, ctor) {
        const $error = es;
        const registry = TypeRegistry.for($error[1]);
        registry.schemas.set($error[1] + "#" + $error[2], $error);
        registry.exceptions.set($error, ctor);
    }
    getErrorCtor(es) {
        const $error = es;
        const registry = TypeRegistry.for($error[1]);
        return registry.exceptions.get($error);
    }
    getBaseException() {
        for (const exceptionKey of this.exceptions.keys()) {
            if (Array.isArray(exceptionKey)) {
                const [, ns, name] = exceptionKey;
                const id = ns + "#" + name;
                if (id.startsWith("smithy.ts.sdk.synthetic.") && id.endsWith("ServiceException")) {
                    return exceptionKey;
                }
            }
        }
        return undefined;
    }
    find(predicate) {
        return [...this.schemas.values()].find(predicate);
    }
    clear() {
        this.schemas.clear();
        this.exceptions.clear();
    }
    normalizeShapeId(shapeId) {
        if (shapeId.includes("#")) {
            return shapeId;
        }
        return this.namespace + "#" + shapeId;
    }
}


/***/ }),

/***/ 2094:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProtocolLib: () => (/* binding */ ProtocolLib)
/* harmony export */ });
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2085);
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2093);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2095);


class ProtocolLib {
    queryCompat;
    constructor(queryCompat = false) {
        this.queryCompat = queryCompat;
    }
    resolveRestContentType(defaultContentType, inputSchema) {
        const members = inputSchema.getMemberSchemas();
        const httpPayloadMember = Object.values(members).find((m) => {
            return !!m.getMergedTraits().httpPayload;
        });
        if (httpPayloadMember) {
            const mediaType = httpPayloadMember.getMergedTraits().mediaType;
            if (mediaType) {
                return mediaType;
            }
            else if (httpPayloadMember.isStringSchema()) {
                return "text/plain";
            }
            else if (httpPayloadMember.isBlobSchema()) {
                return "application/octet-stream";
            }
            else {
                return defaultContentType;
            }
        }
        else if (!inputSchema.isUnitSchema()) {
            const hasBody = Object.values(members).find((m) => {
                const { httpQuery, httpQueryParams, httpHeader, httpLabel, httpPrefixHeaders } = m.getMergedTraits();
                const noPrefixHeaders = httpPrefixHeaders === void 0;
                return !httpQuery && !httpQueryParams && !httpHeader && !httpLabel && noPrefixHeaders;
            });
            if (hasBody) {
                return defaultContentType;
            }
        }
    }
    async getErrorSchemaOrThrowBaseException(errorIdentifier, defaultNamespace, response, dataObject, metadata, getErrorSchema) {
        let namespace = defaultNamespace;
        let errorName = errorIdentifier;
        if (errorIdentifier.includes("#")) {
            [namespace, errorName] = errorIdentifier.split("#");
        }
        const errorMetadata = {
            $metadata: metadata,
            $fault: response.statusCode < 500 ? "client" : "server",
        };
        const registry = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_1__.TypeRegistry.for(namespace);
        try {
            const errorSchema = getErrorSchema?.(registry, errorName) ?? registry.getSchema(errorIdentifier);
            return { errorSchema, errorMetadata };
        }
        catch (e) {
            dataObject.message = dataObject.message ?? dataObject.Message ?? "UnknownError";
            const synthetic = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_1__.TypeRegistry.for("smithy.ts.sdk.synthetic." + namespace);
            const baseExceptionSchema = synthetic.getBaseException();
            if (baseExceptionSchema) {
                const ErrorCtor = synthetic.getErrorCtor(baseExceptionSchema) ?? Error;
                throw this.decorateServiceException(Object.assign(new ErrorCtor({ name: errorName }), errorMetadata), dataObject);
            }
            throw this.decorateServiceException(Object.assign(new Error(errorName), errorMetadata), dataObject);
        }
    }
    decorateServiceException(exception, additions = {}) {
        if (this.queryCompat) {
            const msg = exception.Message ?? additions.Message;
            const error = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, additions);
            if (msg) {
                error.message = msg;
            }
            error.Error = {
                ...error.Error,
                Type: error.Error.Type,
                Code: error.Error.Code,
                Message: error.Error.message ?? error.Error.Message ?? msg,
            };
            const reqId = error.$metadata.requestId;
            if (reqId) {
                error.RequestId = reqId;
            }
            return error;
        }
        return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, additions);
    }
    setQueryCompatError(output, response) {
        const queryErrorHeader = response.headers?.["x-amzn-query-error"];
        if (output !== undefined && queryErrorHeader != null) {
            const [Code, Type] = queryErrorHeader.split(";");
            const entries = Object.entries(output);
            const Error = {
                Code,
                Type,
            };
            Object.assign(output, Error);
            for (const [k, v] of entries) {
                Error[k === "message" ? "Message" : k] = v;
            }
            delete Error.__type;
            output.Error = Error;
        }
    }
    queryCompatOutput(queryCompatErrorData, errorData) {
        if (queryCompatErrorData.Error) {
            errorData.Error = queryCompatErrorData.Error;
        }
        if (queryCompatErrorData.Type) {
            errorData.Type = queryCompatErrorData.Type;
        }
        if (queryCompatErrorData.Code) {
            errorData.Code = queryCompatErrorData.Code;
        }
    }
    findQueryCompatibleError(registry, errorName) {
        try {
            return registry.getSchema(errorName);
        }
        catch (e) {
            return registry.find((schema) => _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.NormalizedSchema.of(schema).getMergedTraits().awsQueryError?.[0] === errorName);
        }
    }
}


/***/ }),

/***/ 2095:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ServiceException: () => (/* binding */ ServiceException),
/* harmony export */   decorateServiceException: () => (/* binding */ decorateServiceException)
/* harmony export */ });
class ServiceException extends Error {
    $fault;
    $response;
    $retryable;
    $metadata;
    constructor(options) {
        super(options.message);
        Object.setPrototypeOf(this, Object.getPrototypeOf(this).constructor.prototype);
        this.name = options.name;
        this.$fault = options.$fault;
        this.$metadata = options.$metadata;
    }
    static isInstance(value) {
        if (!value)
            return false;
        const candidate = value;
        return (ServiceException.prototype.isPrototypeOf(candidate) ||
            (Boolean(candidate.$fault) &&
                Boolean(candidate.$metadata) &&
                (candidate.$fault === "client" || candidate.$fault === "server")));
    }
    static [Symbol.hasInstance](instance) {
        if (!instance)
            return false;
        const candidate = instance;
        if (this === ServiceException) {
            return ServiceException.isInstance(instance);
        }
        if (ServiceException.isInstance(instance)) {
            if (candidate.name && this.name) {
                return this.prototype.isPrototypeOf(instance) || candidate.name === this.name;
            }
            return this.prototype.isPrototypeOf(instance);
        }
        return false;
    }
}
const decorateServiceException = (exception, additions = {}) => {
    Object.entries(additions)
        .filter(([, v]) => v !== undefined)
        .forEach(([k, v]) => {
        if (exception[k] == undefined || exception[k] === "") {
            exception[k] = v;
        }
    });
    const message = exception.message || exception.Message || "UnknownError";
    exception.message = message;
    delete exception.Message;
    return exception;
};


/***/ }),

/***/ 2097:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SerdeContextConfig: () => (/* binding */ SerdeContextConfig)
/* harmony export */ });
class SerdeContextConfig {
    serdeContext;
    setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
    }
}


/***/ }),

/***/ 2099:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   determineTimestampFormat: () => (/* binding */ determineTimestampFormat)
/* harmony export */ });
function determineTimestampFormat(ns, settings) {
    if (settings.timestampFormat.useTrait) {
        if (ns.isTimestampSchema() &&
            (ns.getSchema() === 5 ||
                ns.getSchema() === 6 ||
                ns.getSchema() === 7)) {
            return ns.getSchema();
        }
    }
    const { httpLabel, httpPrefixHeaders, httpHeader, httpQuery } = ns.getMergedTraits();
    const bindingFormat = settings.httpBindings
        ? typeof httpPrefixHeaders === "string" || Boolean(httpHeader)
            ? 6
            : Boolean(httpQuery) || Boolean(httpLabel)
                ? 5
                : undefined
        : undefined;
    return bindingFormat ?? settings.timestampFormat.default;
}


/***/ }),

/***/ 2100:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LazyJsonString: () => (/* binding */ LazyJsonString)
/* harmony export */ });
const LazyJsonString = function LazyJsonString(val) {
    const str = Object.assign(new String(val), {
        deserializeJSON() {
            return JSON.parse(String(val));
        },
        toString() {
            return String(val);
        },
        toJSON() {
            return String(val);
        },
    });
    return str;
};
LazyJsonString.from = (object) => {
    if (object && typeof object === "object" && (object instanceof LazyJsonString || "deserializeJSON" in object)) {
        return object;
    }
    else if (typeof object === "string" || Object.getPrototypeOf(object) === String.prototype) {
        return LazyJsonString(String(object));
    }
    return LazyJsonString(JSON.stringify(object));
};
LazyJsonString.fromObject = LazyJsonString.from;


/***/ }),

/***/ 2101:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NumericValue: () => (/* binding */ NumericValue),
/* harmony export */   nv: () => (/* binding */ nv)
/* harmony export */ });
const format = /^-?\d*(\.\d+)?$/;
class NumericValue {
    string;
    type;
    constructor(string, type) {
        this.string = string;
        this.type = type;
        if (!format.test(string)) {
            throw new Error(`@smithy/core/serde - NumericValue must only contain [0-9], at most one decimal point ".", and an optional negation prefix "-".`);
        }
    }
    toString() {
        return this.string;
    }
    static [Symbol.hasInstance](object) {
        if (!object || typeof object !== "object") {
            return false;
        }
        const _nv = object;
        return NumericValue.prototype.isPrototypeOf(object) || (_nv.type === "bigDecimal" && format.test(_nv.string));
    }
}
function nv(input) {
    return new NumericValue(String(input), "bigDecimal");
}


/***/ }),

/***/ 2102:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deserializingStructIterator: () => (/* binding */ deserializingStructIterator),
/* harmony export */   serializingStructIterator: () => (/* binding */ serializingStructIterator)
/* harmony export */ });
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2085);

function* serializingStructIterator(ns, sourceObject) {
    if (ns.isUnitSchema()) {
        return;
    }
    const struct = ns.getSchema();
    for (let i = 0; i < struct[4].length; ++i) {
        const key = struct[4][i];
        const memberSchema = struct[5][i];
        const memberNs = new _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.NormalizedSchema([memberSchema, 0], key);
        if (!(key in sourceObject) && !memberNs.isIdempotencyToken()) {
            continue;
        }
        yield [key, memberNs];
    }
}
function* deserializingStructIterator(ns, sourceObject, nameTrait) {
    if (ns.isUnitSchema()) {
        return;
    }
    const struct = ns.getSchema();
    let keysRemaining = Object.keys(sourceObject).filter((k) => k !== "__type").length;
    for (let i = 0; i < struct[4].length; ++i) {
        if (keysRemaining === 0) {
            break;
        }
        const key = struct[4][i];
        const memberSchema = struct[5][i];
        const memberNs = new _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.NormalizedSchema([memberSchema, 0], key);
        let serializationKey = key;
        if (nameTrait) {
            serializationKey = memberNs.getMergedTraits()[nameTrait] ?? key;
        }
        if (!(serializationKey in sourceObject)) {
            continue;
        }
        yield [key, memberNs];
        keysRemaining -= 1;
    }
}


/***/ }),

/***/ 2106:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   toUtf8: () => (/* binding */ toUtf8)
/* harmony export */ });
/* harmony import */ var _smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1356);

const toUtf8 = (input) => {
    if (typeof input === "string") {
        return input;
    }
    if (typeof input !== "object" || typeof input.byteOffset !== "number" || typeof input.byteLength !== "number") {
        throw new Error("@smithy/util-utf8: toUtf8 encoder function only accepts string | Uint8Array.");
    }
    return (0,_smithy_util_buffer_from__WEBPACK_IMPORTED_MODULE_0__.fromArrayBuffer)(input.buffer, input.byteOffset, input.byteLength).toString("utf8");
};


/***/ }),

/***/ 2109:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NoAuthSigner: () => (/* binding */ NoAuthSigner)
/* harmony export */ });
class NoAuthSigner {
    async sign(httpRequest, identity, signingProperties) {
        return httpRequest;
    }
}


/***/ }),

/***/ 2113:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EndpointCache: () => (/* binding */ EndpointCache)
/* harmony export */ });
class EndpointCache {
    capacity;
    data = new Map();
    parameters = [];
    constructor({ size, params }) {
        this.capacity = size ?? 50;
        if (params) {
            this.parameters = params;
        }
    }
    get(endpointParams, resolver) {
        const key = this.hash(endpointParams);
        if (key === false) {
            return resolver();
        }
        if (!this.data.has(key)) {
            if (this.data.size > this.capacity + 10) {
                const keys = this.data.keys();
                let i = 0;
                while (true) {
                    const { value, done } = keys.next();
                    this.data.delete(value);
                    if (done || ++i > 10) {
                        break;
                    }
                }
            }
            this.data.set(key, resolver());
        }
        return this.data.get(key);
    }
    size() {
        return this.data.size;
    }
    hash(endpointParams) {
        let buffer = "";
        const { parameters } = this;
        if (parameters.length === 0) {
            return false;
        }
        for (const param of parameters) {
            const val = String(endpointParams[param] ?? "");
            if (val.includes("|;")) {
                return false;
            }
            buffer += val + "|;";
        }
        return buffer;
    }
}


/***/ }),

/***/ 2116:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getAwsRegionExtensionConfiguration: () => (/* binding */ getAwsRegionExtensionConfiguration),
/* harmony export */   resolveAwsRegionExtensionConfiguration: () => (/* binding */ resolveAwsRegionExtensionConfiguration)
/* harmony export */ });
const getAwsRegionExtensionConfiguration = (runtimeConfig) => {
    return {
        setRegion(region) {
            runtimeConfig.region = region;
        },
        region() {
            return runtimeConfig.region;
        },
    };
};
const resolveAwsRegionExtensionConfiguration = (awsRegionExtensionConfiguration) => {
    return {
        region: awsRegionExtensionConfiguration.region(),
    };
};


/***/ }),

/***/ 2117:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getDefaultClientConfiguration: () => (/* binding */ getDefaultClientConfiguration),
/* harmony export */   getDefaultExtensionConfiguration: () => (/* binding */ getDefaultExtensionConfiguration),
/* harmony export */   resolveDefaultRuntimeConfig: () => (/* binding */ resolveDefaultRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _checksum__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2118);
/* harmony import */ var _retry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2120);


const getDefaultExtensionConfiguration = (runtimeConfig) => {
    return Object.assign((0,_checksum__WEBPACK_IMPORTED_MODULE_0__.getChecksumConfiguration)(runtimeConfig), (0,_retry__WEBPACK_IMPORTED_MODULE_1__.getRetryConfiguration)(runtimeConfig));
};
const getDefaultClientConfiguration = getDefaultExtensionConfiguration;
const resolveDefaultRuntimeConfig = (config) => {
    return Object.assign((0,_checksum__WEBPACK_IMPORTED_MODULE_0__.resolveChecksumRuntimeConfig)(config), (0,_retry__WEBPACK_IMPORTED_MODULE_1__.resolveRetryRuntimeConfig)(config));
};


/***/ }),

/***/ 2118:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AlgorithmId: () => (/* reexport safe */ _smithy_types__WEBPACK_IMPORTED_MODULE_0__.AlgorithmId),
/* harmony export */   getChecksumConfiguration: () => (/* binding */ getChecksumConfiguration),
/* harmony export */   resolveChecksumRuntimeConfig: () => (/* binding */ resolveChecksumRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _smithy_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2119);


const getChecksumConfiguration = (runtimeConfig) => {
    const checksumAlgorithms = [];
    for (const id in _smithy_types__WEBPACK_IMPORTED_MODULE_0__.AlgorithmId) {
        const algorithmId = _smithy_types__WEBPACK_IMPORTED_MODULE_0__.AlgorithmId[id];
        if (runtimeConfig[algorithmId] === undefined) {
            continue;
        }
        checksumAlgorithms.push({
            algorithmId: () => algorithmId,
            checksumConstructor: () => runtimeConfig[algorithmId],
        });
    }
    return {
        addChecksumAlgorithm(algo) {
            checksumAlgorithms.push(algo);
        },
        checksumAlgorithms() {
            return checksumAlgorithms;
        },
    };
};
const resolveChecksumRuntimeConfig = (clientConfig) => {
    const runtimeConfig = {};
    clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
        runtimeConfig[checksumAlgorithm.algorithmId()] = checksumAlgorithm.checksumConstructor();
    });
    return runtimeConfig;
};


/***/ }),

/***/ 2119:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AlgorithmId: () => (/* binding */ AlgorithmId),
/* harmony export */   getChecksumConfiguration: () => (/* binding */ getChecksumConfiguration),
/* harmony export */   resolveChecksumRuntimeConfig: () => (/* binding */ resolveChecksumRuntimeConfig)
/* harmony export */ });
var AlgorithmId;
(function (AlgorithmId) {
    AlgorithmId["MD5"] = "md5";
    AlgorithmId["CRC32"] = "crc32";
    AlgorithmId["CRC32C"] = "crc32c";
    AlgorithmId["SHA1"] = "sha1";
    AlgorithmId["SHA256"] = "sha256";
})(AlgorithmId || (AlgorithmId = {}));
const getChecksumConfiguration = (runtimeConfig) => {
    const checksumAlgorithms = [];
    if (runtimeConfig.sha256 !== undefined) {
        checksumAlgorithms.push({
            algorithmId: () => AlgorithmId.SHA256,
            checksumConstructor: () => runtimeConfig.sha256,
        });
    }
    if (runtimeConfig.md5 != undefined) {
        checksumAlgorithms.push({
            algorithmId: () => AlgorithmId.MD5,
            checksumConstructor: () => runtimeConfig.md5,
        });
    }
    return {
        addChecksumAlgorithm(algo) {
            checksumAlgorithms.push(algo);
        },
        checksumAlgorithms() {
            return checksumAlgorithms;
        },
    };
};
const resolveChecksumRuntimeConfig = (clientConfig) => {
    const runtimeConfig = {};
    clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
        runtimeConfig[checksumAlgorithm.algorithmId()] = checksumAlgorithm.checksumConstructor();
    });
    return runtimeConfig;
};


/***/ }),

/***/ 2120:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRetryConfiguration: () => (/* binding */ getRetryConfiguration),
/* harmony export */   resolveRetryRuntimeConfig: () => (/* binding */ resolveRetryRuntimeConfig)
/* harmony export */ });
const getRetryConfiguration = (runtimeConfig) => {
    return {
        setRetryStrategy(retryStrategy) {
            runtimeConfig.retryStrategy = retryStrategy;
        },
        retryStrategy() {
            return runtimeConfig.retryStrategy;
        },
    };
};
const resolveRetryRuntimeConfig = (retryStrategyConfiguration) => {
    const runtimeConfig = {};
    runtimeConfig.retryStrategy = retryStrategyConfiguration.retryStrategy();
    return runtimeConfig;
};


/***/ }),

/***/ 2123:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   endpointMiddlewareOptions: () => (/* binding */ endpointMiddlewareOptions),
/* harmony export */   getEndpointPlugin: () => (/* binding */ getEndpointPlugin)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2124);
/* harmony import */ var _endpointMiddleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2127);


const endpointMiddlewareOptions = {
    step: "serialize",
    tags: ["ENDPOINT_PARAMETERS", "ENDPOINT_V2", "ENDPOINT"],
    name: "endpointV2Middleware",
    override: true,
    relation: "before",
    toMiddleware: _smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_0__.serializerMiddlewareOption.name,
};
const getEndpointPlugin = (config, instructions) => ({
    applyToStack: (clientStack) => {
        clientStack.addRelativeTo((0,_endpointMiddleware__WEBPACK_IMPORTED_MODULE_1__.endpointMiddleware)({
            config,
            instructions,
        }), endpointMiddlewareOptions);
    },
});


/***/ }),

/***/ 2124:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deserializerMiddlewareOption: () => (/* binding */ deserializerMiddlewareOption),
/* harmony export */   getSerdePlugin: () => (/* binding */ getSerdePlugin),
/* harmony export */   serializerMiddlewareOption: () => (/* binding */ serializerMiddlewareOption)
/* harmony export */ });
/* harmony import */ var _deserializerMiddleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2125);
/* harmony import */ var _serializerMiddleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2126);


const deserializerMiddlewareOption = {
    name: "deserializerMiddleware",
    step: "deserialize",
    tags: ["DESERIALIZER"],
    override: true,
};
const serializerMiddlewareOption = {
    name: "serializerMiddleware",
    step: "serialize",
    tags: ["SERIALIZER"],
    override: true,
};
function getSerdePlugin(config, serializer, deserializer) {
    return {
        applyToStack: (commandStack) => {
            commandStack.add((0,_deserializerMiddleware__WEBPACK_IMPORTED_MODULE_0__.deserializerMiddleware)(config, deserializer), deserializerMiddlewareOption);
            commandStack.add((0,_serializerMiddleware__WEBPACK_IMPORTED_MODULE_1__.serializerMiddleware)(config, serializer), serializerMiddlewareOption);
        },
    };
}


/***/ }),

/***/ 2125:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deserializerMiddleware: () => (/* binding */ deserializerMiddleware)
/* harmony export */ });
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1336);

const deserializerMiddleware = (options, deserializer) => (next, context) => async (args) => {
    const { response } = await next(args);
    try {
        const parsed = await deserializer(response, options);
        return {
            response,
            output: parsed,
        };
    }
    catch (error) {
        Object.defineProperty(error, "$response", {
            value: response,
            enumerable: false,
            writable: false,
            configurable: false,
        });
        if (!("$metadata" in error)) {
            const hint = `Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.`;
            try {
                error.message += "\n  " + hint;
            }
            catch (e) {
                if (!context.logger || context.logger?.constructor?.name === "NoOpLogger") {
                    console.warn(hint);
                }
                else {
                    context.logger?.warn?.(hint);
                }
            }
            if (typeof error.$responseBodyText !== "undefined") {
                if (error.$response) {
                    error.$response.body = error.$responseBodyText;
                }
            }
            try {
                if (_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_0__.HttpResponse.isInstance(response)) {
                    const { headers = {} } = response;
                    const headerEntries = Object.entries(headers);
                    error.$metadata = {
                        httpStatusCode: response.statusCode,
                        requestId: findHeader(/^x-[\w-]+-request-?id$/, headerEntries),
                        extendedRequestId: findHeader(/^x-[\w-]+-id-2$/, headerEntries),
                        cfId: findHeader(/^x-[\w-]+-cf-id$/, headerEntries),
                    };
                }
            }
            catch (e) {
            }
        }
        throw error;
    }
};
const findHeader = (pattern, headers) => {
    return (headers.find(([k]) => {
        return k.match(pattern);
    }) || [void 0, void 1])[1];
};


/***/ }),

/***/ 2126:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   serializerMiddleware: () => (/* binding */ serializerMiddleware)
/* harmony export */ });
const serializerMiddleware = (options, serializer) => (next, context) => async (args) => {
    const endpointConfig = options;
    const endpoint = context.endpointV2?.url && endpointConfig.urlParser
        ? async () => endpointConfig.urlParser(context.endpointV2.url)
        : endpointConfig.endpoint;
    if (!endpoint) {
        throw new Error("No valid endpoint provider available.");
    }
    const request = await serializer(args.input, { ...options, endpoint });
    return next({
        ...args,
        request,
    });
};


/***/ }),

/***/ 2127:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   endpointMiddleware: () => (/* binding */ endpointMiddleware)
/* harmony export */ });
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2128);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2016);
/* harmony import */ var _adaptors_getEndpointFromInstructions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2129);



const endpointMiddleware = ({ config, instructions, }) => {
    return (next, context) => async (args) => {
        if (config.isCustomEndpoint) {
            (0,_smithy_core__WEBPACK_IMPORTED_MODULE_0__.setFeature)(context, "ENDPOINT_OVERRIDE", "N");
        }
        const endpoint = await (0,_adaptors_getEndpointFromInstructions__WEBPACK_IMPORTED_MODULE_2__.getEndpointFromInstructions)(args.input, {
            getEndpointParameterInstructions() {
                return instructions;
            },
        }, { ...config }, context);
        context.endpointV2 = endpoint;
        context.authSchemes = endpoint.properties?.authSchemes;
        const authScheme = context.authSchemes?.[0];
        if (authScheme) {
            context["signing_region"] = authScheme.signingRegion;
            context["signing_service"] = authScheme.signingName;
            const smithyContext = (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__.getSmithyContext)(context);
            const httpAuthOption = smithyContext?.selectedHttpAuthScheme?.httpAuthOption;
            if (httpAuthOption) {
                httpAuthOption.signingProperties = Object.assign(httpAuthOption.signingProperties || {}, {
                    signing_region: authScheme.signingRegion,
                    signingRegion: authScheme.signingRegion,
                    signing_service: authScheme.signingName,
                    signingName: authScheme.signingName,
                    signingRegionSet: authScheme.signingRegionSet,
                }, authScheme.properties);
            }
        }
        return next({
            ...args,
        });
    };
};


/***/ }),

/***/ 2128:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   setFeature: () => (/* binding */ setFeature)
/* harmony export */ });
function setFeature(context, feature, value) {
    if (!context.__smithy_context) {
        context.__smithy_context = {
            features: {},
        };
    }
    else if (!context.__smithy_context.features) {
        context.__smithy_context.features = {};
    }
    context.__smithy_context.features[feature] = value;
}


/***/ }),

/***/ 2129:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getEndpointFromInstructions: () => (/* binding */ getEndpointFromInstructions),
/* harmony export */   resolveParams: () => (/* binding */ resolveParams)
/* harmony export */ });
/* harmony import */ var _service_customizations__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2130);
/* harmony import */ var _createConfigValueProvider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2131);
/* harmony import */ var _getEndpointFromConfig__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2027);
/* harmony import */ var _toEndpointV1__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2029);




const getEndpointFromInstructions = async (commandInput, instructionsSupplier, clientConfig, context) => {
    if (!clientConfig.isCustomEndpoint) {
        let endpointFromConfig;
        if (clientConfig.serviceConfiguredEndpoint) {
            endpointFromConfig = await clientConfig.serviceConfiguredEndpoint();
        }
        else {
            endpointFromConfig = await (0,_getEndpointFromConfig__WEBPACK_IMPORTED_MODULE_2__.getEndpointFromConfig)(clientConfig.serviceId);
        }
        if (endpointFromConfig) {
            clientConfig.endpoint = () => Promise.resolve((0,_toEndpointV1__WEBPACK_IMPORTED_MODULE_3__.toEndpointV1)(endpointFromConfig));
            clientConfig.isCustomEndpoint = true;
        }
    }
    const endpointParams = await resolveParams(commandInput, instructionsSupplier, clientConfig);
    if (typeof clientConfig.endpointProvider !== "function") {
        throw new Error("config.endpointProvider is not set.");
    }
    const endpoint = clientConfig.endpointProvider(endpointParams, context);
    return endpoint;
};
const resolveParams = async (commandInput, instructionsSupplier, clientConfig) => {
    const endpointParams = {};
    const instructions = instructionsSupplier?.getEndpointParameterInstructions?.() || {};
    for (const [name, instruction] of Object.entries(instructions)) {
        switch (instruction.type) {
            case "staticContextParams":
                endpointParams[name] = instruction.value;
                break;
            case "contextParams":
                endpointParams[name] = commandInput[instruction.name];
                break;
            case "clientContextParams":
            case "builtInParams":
                endpointParams[name] = await (0,_createConfigValueProvider__WEBPACK_IMPORTED_MODULE_1__.createConfigValueProvider)(instruction.name, name, clientConfig, instruction.type !== "builtInParams")();
                break;
            case "operationContextParams":
                endpointParams[name] = instruction.get(commandInput);
                break;
            default:
                throw new Error("Unrecognized endpoint parameter instruction: " + JSON.stringify(instruction));
        }
    }
    if (Object.keys(instructions).length === 0) {
        Object.assign(endpointParams, clientConfig);
    }
    if (String(clientConfig.serviceId).toLowerCase() === "s3") {
        await (0,_service_customizations__WEBPACK_IMPORTED_MODULE_0__.resolveParamsForS3)(endpointParams);
    }
    return endpointParams;
};


/***/ }),

/***/ 2130:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DOT_PATTERN: () => (/* binding */ DOT_PATTERN),
/* harmony export */   S3_HOSTNAME_PATTERN: () => (/* binding */ S3_HOSTNAME_PATTERN),
/* harmony export */   isArnBucketName: () => (/* binding */ isArnBucketName),
/* harmony export */   isDnsCompatibleBucketName: () => (/* binding */ isDnsCompatibleBucketName),
/* harmony export */   resolveParamsForS3: () => (/* binding */ resolveParamsForS3)
/* harmony export */ });
const resolveParamsForS3 = async (endpointParams) => {
    const bucket = endpointParams?.Bucket || "";
    if (typeof endpointParams.Bucket === "string") {
        endpointParams.Bucket = bucket.replace(/#/g, encodeURIComponent("#")).replace(/\?/g, encodeURIComponent("?"));
    }
    if (isArnBucketName(bucket)) {
        if (endpointParams.ForcePathStyle === true) {
            throw new Error("Path-style addressing cannot be used with ARN buckets");
        }
    }
    else if (!isDnsCompatibleBucketName(bucket) ||
        (bucket.indexOf(".") !== -1 && !String(endpointParams.Endpoint).startsWith("http:")) ||
        bucket.toLowerCase() !== bucket ||
        bucket.length < 3) {
        endpointParams.ForcePathStyle = true;
    }
    if (endpointParams.DisableMultiRegionAccessPoints) {
        endpointParams.disableMultiRegionAccessPoints = true;
        endpointParams.DisableMRAP = true;
    }
    return endpointParams;
};
const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$/;
const IP_ADDRESS_PATTERN = /(\d+\.){3}\d+/;
const DOTS_PATTERN = /\.\./;
const DOT_PATTERN = /\./;
const S3_HOSTNAME_PATTERN = /^(.+\.)?s3(-fips)?(\.dualstack)?[.-]([a-z0-9-]+)\./;
const isDnsCompatibleBucketName = (bucketName) => DOMAIN_PATTERN.test(bucketName) && !IP_ADDRESS_PATTERN.test(bucketName) && !DOTS_PATTERN.test(bucketName);
const isArnBucketName = (bucketName) => {
    const [arn, partition, service, , , bucket] = bucketName.split(":");
    const isArn = arn === "arn" && bucketName.split(":").length >= 6;
    const isValidArn = Boolean(isArn && partition && service && bucket);
    if (isArn && !isValidArn) {
        throw new Error(`Invalid ARN: ${bucketName} was an invalid ARN.`);
    }
    return isValidArn;
};


/***/ }),

/***/ 2131:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createConfigValueProvider: () => (/* binding */ createConfigValueProvider)
/* harmony export */ });
const createConfigValueProvider = (configKey, canonicalEndpointParamKey, config, isClientContextParam = false) => {
    const configProvider = async () => {
        let configValue;
        if (isClientContextParam) {
            const clientContextParams = config.clientContextParams;
            const nestedValue = clientContextParams?.[configKey];
            configValue = nestedValue ?? config[configKey] ?? config[canonicalEndpointParamKey];
        }
        else {
            configValue = config[configKey] ?? config[canonicalEndpointParamKey];
        }
        if (typeof configValue === "function") {
            return configValue();
        }
        return configValue;
    };
    if (configKey === "credentialScope" || canonicalEndpointParamKey === "CredentialScope") {
        return async () => {
            const credentials = typeof config.credentials === "function" ? await config.credentials() : config.credentials;
            const configValue = credentials?.credentialScope ?? credentials?.CredentialScope;
            return configValue;
        };
    }
    if (configKey === "accountId" || canonicalEndpointParamKey === "AccountId") {
        return async () => {
            const credentials = typeof config.credentials === "function" ? await config.credentials() : config.credentials;
            const configValue = credentials?.accountId ?? credentials?.AccountId;
            return configValue;
        };
    }
    if (configKey === "endpoint" || canonicalEndpointParamKey === "endpoint") {
        return async () => {
            if (config.isCustomEndpoint === false) {
                return undefined;
            }
            const endpoint = await configProvider();
            if (endpoint && typeof endpoint === "object") {
                if ("url" in endpoint) {
                    return endpoint.url.href;
                }
                if ("hostname" in endpoint) {
                    const { protocol, hostname, port, path } = endpoint;
                    return `${protocol}//${hostname}${port ? ":" + port : ""}${path}`;
                }
            }
            return endpoint;
        };
    }
    return configProvider;
};


/***/ }),

/***/ 2132:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Command: () => (/* binding */ Command)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_stack__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2047);
/* harmony import */ var _smithy_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2017);
/* harmony import */ var _schemaLogFilter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2133);



class Command {
    middlewareStack = (0,_smithy_middleware_stack__WEBPACK_IMPORTED_MODULE_0__.constructStack)();
    schema;
    static classBuilder() {
        return new ClassBuilder();
    }
    resolveMiddlewareWithContext(clientStack, configuration, options, { middlewareFn, clientName, commandName, inputFilterSensitiveLog, outputFilterSensitiveLog, smithyContext, additionalContext, CommandCtor, }) {
        for (const mw of middlewareFn.bind(this)(CommandCtor, clientStack, configuration, options)) {
            this.middlewareStack.use(mw);
        }
        const stack = clientStack.concat(this.middlewareStack);
        const { logger } = configuration;
        const handlerExecutionContext = {
            logger,
            clientName,
            commandName,
            inputFilterSensitiveLog,
            outputFilterSensitiveLog,
            [_smithy_types__WEBPACK_IMPORTED_MODULE_1__.SMITHY_CONTEXT_KEY]: {
                commandInstance: this,
                ...smithyContext,
            },
            ...additionalContext,
        };
        const { requestHandler } = configuration;
        return stack.resolve((request) => requestHandler.handle(request.request, options || {}), handlerExecutionContext);
    }
}
class ClassBuilder {
    _init = () => { };
    _ep = {};
    _middlewareFn = () => [];
    _commandName = "";
    _clientName = "";
    _additionalContext = {};
    _smithyContext = {};
    _inputFilterSensitiveLog = undefined;
    _outputFilterSensitiveLog = undefined;
    _serializer = null;
    _deserializer = null;
    _operationSchema;
    init(cb) {
        this._init = cb;
    }
    ep(endpointParameterInstructions) {
        this._ep = endpointParameterInstructions;
        return this;
    }
    m(middlewareSupplier) {
        this._middlewareFn = middlewareSupplier;
        return this;
    }
    s(service, operation, smithyContext = {}) {
        this._smithyContext = {
            service,
            operation,
            ...smithyContext,
        };
        return this;
    }
    c(additionalContext = {}) {
        this._additionalContext = additionalContext;
        return this;
    }
    n(clientName, commandName) {
        this._clientName = clientName;
        this._commandName = commandName;
        return this;
    }
    f(inputFilter = (_) => _, outputFilter = (_) => _) {
        this._inputFilterSensitiveLog = inputFilter;
        this._outputFilterSensitiveLog = outputFilter;
        return this;
    }
    ser(serializer) {
        this._serializer = serializer;
        return this;
    }
    de(deserializer) {
        this._deserializer = deserializer;
        return this;
    }
    sc(operation) {
        this._operationSchema = operation;
        this._smithyContext.operationSchema = operation;
        return this;
    }
    build() {
        const closure = this;
        let CommandRef;
        return (CommandRef = class extends Command {
            input;
            static getEndpointParameterInstructions() {
                return closure._ep;
            }
            constructor(...[input]) {
                super();
                this.input = input ?? {};
                closure._init(this);
                this.schema = closure._operationSchema;
            }
            resolveMiddleware(stack, configuration, options) {
                const op = closure._operationSchema;
                const input = op?.[4] ?? op?.input;
                const output = op?.[5] ?? op?.output;
                return this.resolveMiddlewareWithContext(stack, configuration, options, {
                    CommandCtor: CommandRef,
                    middlewareFn: closure._middlewareFn,
                    clientName: closure._clientName,
                    commandName: closure._commandName,
                    inputFilterSensitiveLog: closure._inputFilterSensitiveLog ?? (op ? _schemaLogFilter__WEBPACK_IMPORTED_MODULE_2__.schemaLogFilter.bind(null, input) : (_) => _),
                    outputFilterSensitiveLog: closure._outputFilterSensitiveLog ?? (op ? _schemaLogFilter__WEBPACK_IMPORTED_MODULE_2__.schemaLogFilter.bind(null, output) : (_) => _),
                    smithyContext: closure._smithyContext,
                    additionalContext: closure._additionalContext,
                });
            }
            serialize = closure._serializer;
            deserialize = closure._deserializer;
        });
    }
}


/***/ }),

/***/ 2133:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   schemaLogFilter: () => (/* binding */ schemaLogFilter)
/* harmony export */ });
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2085);

const SENSITIVE_STRING = "***SensitiveInformation***";
function schemaLogFilter(schema, data) {
    if (data == null) {
        return data;
    }
    const ns = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.NormalizedSchema.of(schema);
    if (ns.getMergedTraits().sensitive) {
        return SENSITIVE_STRING;
    }
    if (ns.isListSchema()) {
        const isSensitive = !!ns.getValueSchema().getMergedTraits().sensitive;
        if (isSensitive) {
            return SENSITIVE_STRING;
        }
    }
    else if (ns.isMapSchema()) {
        const isSensitive = !!ns.getKeySchema().getMergedTraits().sensitive || !!ns.getValueSchema().getMergedTraits().sensitive;
        if (isSensitive) {
            return SENSITIVE_STRING;
        }
    }
    else if (ns.isStructSchema() && typeof data === "object") {
        const object = data;
        const newObject = {};
        for (const [member, memberNs] of ns.structIterator()) {
            if (object[member] != null) {
                newObject[member] = schemaLogFilter(memberNs, object[member]);
            }
        }
        return newObject;
    }
    return data;
}


/***/ })

};
;
//# sourceMappingURL=2.extension.js.map