"use strict";
exports.id = 1;
exports.ids = [1];
exports.modules = {

/***/ 1950:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CognitoIdentityClient: () => (/* reexport safe */ _aws_sdk_client_cognito_identity__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityClient),
/* harmony export */   GetCredentialsForIdentityCommand: () => (/* reexport safe */ _aws_sdk_client_cognito_identity__WEBPACK_IMPORTED_MODULE_1__.GetCredentialsForIdentityCommand),
/* harmony export */   GetIdCommand: () => (/* reexport safe */ _aws_sdk_client_cognito_identity__WEBPACK_IMPORTED_MODULE_2__.GetIdCommand)
/* harmony export */ });
/* harmony import */ var _aws_sdk_client_cognito_identity__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1951);
/* harmony import */ var _aws_sdk_client_cognito_identity__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2122);
/* harmony import */ var _aws_sdk_client_cognito_identity__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2137);




/***/ }),

/***/ 1951:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CognitoIdentityClient: () => (/* binding */ CognitoIdentityClient),
/* harmony export */   __Client: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_14__.Client)
/* harmony export */ });
/* harmony import */ var _aws_sdk_middleware_host_header__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1952);
/* harmony import */ var _aws_sdk_middleware_logger__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1953);
/* harmony import */ var _aws_sdk_middleware_recursion_detection__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1954);
/* harmony import */ var _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1958);
/* harmony import */ var _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(1959);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(2009);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(2013);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(2014);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(2019);
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(2021);
/* harmony import */ var _smithy_middleware_content_length__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(2025);
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(2026);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(2030);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(2040);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(2046);
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(2048);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(2051);
/* harmony import */ var _runtimeConfig__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(2052);
/* harmony import */ var _runtimeExtensions__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(2115);
















class CognitoIdentityClient extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_14__.Client {
    config;
    constructor(...[configuration]) {
        const _config_0 = (0,_runtimeConfig__WEBPACK_IMPORTED_MODULE_17__.getRuntimeConfig)(configuration || {});
        super(_config_0);
        this.initConfig = _config_0;
        const _config_1 = (0,_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_16__.resolveClientEndpointParameters)(_config_0);
        const _config_2 = (0,_aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_3__.resolveUserAgentConfig)(_config_1);
        const _config_3 = (0,_smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_12__.resolveRetryConfig)(_config_2);
        const _config_4 = (0,_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_5__.resolveRegionConfig)(_config_3);
        const _config_5 = (0,_aws_sdk_middleware_host_header__WEBPACK_IMPORTED_MODULE_0__.resolveHostHeaderConfig)(_config_4);
        const _config_6 = (0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_11__.resolveEndpointConfig)(_config_5);
        const _config_7 = (0,_auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_15__.resolveHttpAuthSchemeConfig)(_config_6);
        const _config_8 = (0,_runtimeExtensions__WEBPACK_IMPORTED_MODULE_18__.resolveRuntimeExtensions)(_config_7, configuration?.extensions || []);
        this.config = _config_8;
        this.middlewareStack.use((0,_smithy_core_schema__WEBPACK_IMPORTED_MODULE_9__.getSchemaSerdePlugin)(this.config));
        this.middlewareStack.use((0,_aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_4__.getUserAgentPlugin)(this.config));
        this.middlewareStack.use((0,_smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_13__.getRetryPlugin)(this.config));
        this.middlewareStack.use((0,_smithy_middleware_content_length__WEBPACK_IMPORTED_MODULE_10__.getContentLengthPlugin)(this.config));
        this.middlewareStack.use((0,_aws_sdk_middleware_host_header__WEBPACK_IMPORTED_MODULE_0__.getHostHeaderPlugin)(this.config));
        this.middlewareStack.use((0,_aws_sdk_middleware_logger__WEBPACK_IMPORTED_MODULE_1__.getLoggerPlugin)(this.config));
        this.middlewareStack.use((0,_aws_sdk_middleware_recursion_detection__WEBPACK_IMPORTED_MODULE_2__.getRecursionDetectionPlugin)(this.config));
        this.middlewareStack.use((0,_smithy_core__WEBPACK_IMPORTED_MODULE_7__.getHttpAuthSchemeEndpointRuleSetPlugin)(this.config, {
            httpAuthSchemeParametersProvider: _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_15__.defaultCognitoIdentityHttpAuthSchemeParametersProvider,
            identityProviderConfigProvider: async (config) => new _smithy_core__WEBPACK_IMPORTED_MODULE_6__.DefaultIdentityProviderConfig({
                "aws.auth#sigv4": config.credentials,
            }),
        }));
        this.middlewareStack.use((0,_smithy_core__WEBPACK_IMPORTED_MODULE_8__.getHttpSigningPlugin)(this.config));
    }
    destroy() {
        super.destroy();
    }
}


/***/ }),

/***/ 2048:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultCognitoIdentityHttpAuthSchemeParametersProvider: () => (/* binding */ defaultCognitoIdentityHttpAuthSchemeParametersProvider),
/* harmony export */   defaultCognitoIdentityHttpAuthSchemeProvider: () => (/* binding */ defaultCognitoIdentityHttpAuthSchemeProvider),
/* harmony export */   resolveHttpAuthSchemeConfig: () => (/* binding */ resolveHttpAuthSchemeConfig)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2049);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2016);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1470);


const defaultCognitoIdentityHttpAuthSchemeParametersProvider = async (config, context, input) => {
    return {
        operation: (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__.getSmithyContext)(context).operation,
        region: (await (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_2__.normalizeProvider)(config.region)()) ||
            (() => {
                throw new Error("expected `region` to be configured for `aws.auth#sigv4`");
            })(),
    };
};
function createAwsAuthSigv4HttpAuthOption(authParameters) {
    return {
        schemeId: "aws.auth#sigv4",
        signingProperties: {
            name: "cognito-identity",
            region: authParameters.region,
        },
        propertiesExtractor: (config, context) => ({
            signingProperties: {
                config,
                context,
            },
        }),
    };
}
function createSmithyApiNoAuthHttpAuthOption(authParameters) {
    return {
        schemeId: "smithy.api#noAuth",
    };
}
const defaultCognitoIdentityHttpAuthSchemeProvider = (authParameters) => {
    const options = [];
    switch (authParameters.operation) {
        case "GetCredentialsForIdentity": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        case "GetId": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        case "GetOpenIdToken": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        case "UnlinkIdentity": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        default: {
            options.push(createAwsAuthSigv4HttpAuthOption(authParameters));
        }
    }
    return options;
};
const resolveHttpAuthSchemeConfig = (config) => {
    const config_0 = (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.resolveAwsSdkSigV4Config)(config);
    return Object.assign(config_0, {
        authSchemePreference: (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_2__.normalizeProvider)(config.authSchemePreference ?? []),
    });
};


/***/ }),

/***/ 2051:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   commonParams: () => (/* binding */ commonParams),
/* harmony export */   resolveClientEndpointParameters: () => (/* binding */ resolveClientEndpointParameters)
/* harmony export */ });
const resolveClientEndpointParameters = (options) => {
    return Object.assign(options, {
        useDualstackEndpoint: options.useDualstackEndpoint ?? false,
        useFipsEndpoint: options.useFipsEndpoint ?? false,
        defaultSigningName: "cognito-identity",
    });
};
const commonParams = {
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
    UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
};


/***/ }),

/***/ 2052:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntimeConfig: () => (/* binding */ getRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _package_json__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2053);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2054);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2055);
/* harmony import */ var _aws_sdk_credential_provider_node__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1417);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2058);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(2062);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(1443);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(2063);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(2066);
/* harmony import */ var _smithy_hash_node__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(2067);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(2030);
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(1398);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(1335);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(1354);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(2070);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(2071);
/* harmony import */ var _smithy_util_body_length_node__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(2072);
/* harmony import */ var _smithy_util_defaults_mode_node__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(2073);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(2032);
/* harmony import */ var _runtimeConfig_shared__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(2076);














const getRuntimeConfig = (config) => {
    (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_15__.emitWarningIfUnsupportedVersion)(process.version);
    const defaultsMode = (0,_smithy_util_defaults_mode_node__WEBPACK_IMPORTED_MODULE_17__.resolveDefaultsModeConfig)(config);
    const defaultConfigProvider = () => defaultsMode().then(_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_14__.loadConfigsForDefaultMode);
    const clientSharedValues = (0,_runtimeConfig_shared__WEBPACK_IMPORTED_MODULE_19__.getRuntimeConfig)(config);
    (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_1__.emitWarningIfUnsupportedVersion)(process.version);
    const loaderConfig = {
        profile: config?.profile,
        logger: clientSharedValues.logger,
    };
    return {
        ...clientSharedValues,
        ...config,
        runtime: "node",
        defaultsMode,
        authSchemePreference: config?.authSchemePreference ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__.loadConfig)(_aws_sdk_core__WEBPACK_IMPORTED_MODULE_2__.NODE_AUTH_SCHEME_PREFERENCE_OPTIONS, loaderConfig),
        bodyLengthChecker: config?.bodyLengthChecker ?? _smithy_util_body_length_node__WEBPACK_IMPORTED_MODULE_16__.calculateBodyLength,
        credentialDefaultProvider: config?.credentialDefaultProvider ?? _aws_sdk_credential_provider_node__WEBPACK_IMPORTED_MODULE_3__.defaultProvider,
        defaultUserAgentProvider: config?.defaultUserAgentProvider ??
            (0,_aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_4__.createDefaultUserAgentProvider)({ serviceId: clientSharedValues.serviceId, clientVersion: _package_json__WEBPACK_IMPORTED_MODULE_0__.version }),
        maxAttempts: config?.maxAttempts ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__.loadConfig)(_smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_10__.NODE_MAX_ATTEMPT_CONFIG_OPTIONS, config),
        region: config?.region ??
            (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_6__.NODE_REGION_CONFIG_OPTIONS, { ..._smithy_config_resolver__WEBPACK_IMPORTED_MODULE_6__.NODE_REGION_CONFIG_FILE_OPTIONS, ...loaderConfig }),
        requestHandler: _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_12__.NodeHttpHandler.create(config?.requestHandler ?? defaultConfigProvider),
        retryMode: config?.retryMode ??
            (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__.loadConfig)({
                ..._smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_10__.NODE_RETRY_MODE_CONFIG_OPTIONS,
                default: async () => (await defaultConfigProvider()).retryMode || _smithy_util_retry__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_RETRY_MODE,
            }, config),
        sha256: config?.sha256 ?? _smithy_hash_node__WEBPACK_IMPORTED_MODULE_9__.Hash.bind(null, "sha256"),
        streamCollector: config?.streamCollector ?? _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_13__.streamCollector,
        useDualstackEndpoint: config?.useDualstackEndpoint ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_7__.NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS, loaderConfig),
        useFipsEndpoint: config?.useFipsEndpoint ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_8__.NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS, loaderConfig),
        userAgentAppId: config?.userAgentAppId ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_11__.loadConfig)(_aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_5__.NODE_APP_ID_CONFIG_OPTIONS, loaderConfig),
    };
};


/***/ }),

/***/ 2053:
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"name":"@aws-sdk/client-cognito-identity","description":"AWS SDK for JavaScript Cognito Identity Client for Node.js, Browser and React Native","version":"3.954.0","scripts":{"build":"concurrently \'yarn:build:types\' \'yarn:build:es\' && yarn build:cjs","build:cjs":"node ../../scripts/compilation/inline client-cognito-identity","build:es":"tsc -p tsconfig.es.json","build:include:deps":"lerna run --scope $npm_package_name --include-dependencies build","build:types":"tsc -p tsconfig.types.json","build:types:downlevel":"downlevel-dts dist-types dist-types/ts3.4","clean":"rimraf ./dist-* && rimraf *.tsbuildinfo","extract:docs":"api-extractor run --local","generate:client":"node ../../scripts/generate-clients/single-service --solo cognito-identity","test:e2e":"yarn g:vitest run -c vitest.config.e2e.mts --mode development","test:e2e:watch":"yarn g:vitest watch -c vitest.config.e2e.mts","test:index":"tsc --noEmit ./test/index-types.ts && node ./test/index-objects.spec.mjs"},"main":"./dist-cjs/index.js","types":"./dist-types/index.d.ts","module":"./dist-es/index.js","sideEffects":false,"dependencies":{"@aws-crypto/sha256-browser":"5.2.0","@aws-crypto/sha256-js":"5.2.0","@aws-sdk/core":"3.954.0","@aws-sdk/credential-provider-node":"3.954.0","@aws-sdk/middleware-host-header":"3.953.0","@aws-sdk/middleware-logger":"3.953.0","@aws-sdk/middleware-recursion-detection":"3.953.0","@aws-sdk/middleware-user-agent":"3.954.0","@aws-sdk/region-config-resolver":"3.953.0","@aws-sdk/types":"3.953.0","@aws-sdk/util-endpoints":"3.953.0","@aws-sdk/util-user-agent-browser":"3.953.0","@aws-sdk/util-user-agent-node":"3.954.0","@smithy/config-resolver":"^4.4.4","@smithy/core":"^3.19.0","@smithy/fetch-http-handler":"^5.3.7","@smithy/hash-node":"^4.2.6","@smithy/invalid-dependency":"^4.2.6","@smithy/middleware-content-length":"^4.2.6","@smithy/middleware-endpoint":"^4.4.0","@smithy/middleware-retry":"^4.4.16","@smithy/middleware-serde":"^4.2.7","@smithy/middleware-stack":"^4.2.6","@smithy/node-config-provider":"^4.3.6","@smithy/node-http-handler":"^4.4.6","@smithy/protocol-http":"^5.3.6","@smithy/smithy-client":"^4.10.1","@smithy/types":"^4.10.0","@smithy/url-parser":"^4.2.6","@smithy/util-base64":"^4.3.0","@smithy/util-body-length-browser":"^4.2.0","@smithy/util-body-length-node":"^4.2.1","@smithy/util-defaults-mode-browser":"^4.3.15","@smithy/util-defaults-mode-node":"^4.2.18","@smithy/util-endpoints":"^3.2.6","@smithy/util-middleware":"^4.2.6","@smithy/util-retry":"^4.2.6","@smithy/util-utf8":"^4.2.0","tslib":"^2.6.2"},"devDependencies":{"@aws-sdk/client-iam":"3.954.0","@tsconfig/node18":"18.2.4","@types/chai":"^4.2.11","@types/node":"^18.19.69","concurrently":"7.0.0","downlevel-dts":"0.10.1","rimraf":"3.0.2","typescript":"~5.8.3"},"engines":{"node":">=18.0.0"},"typesVersions":{"<4.0":{"dist-types/*":["dist-types/ts3.4/*"]}},"files":["dist-*/**"],"author":{"name":"AWS SDK for JavaScript Team","url":"https://aws.amazon.com/javascript/"},"license":"Apache-2.0","browser":{"./dist-es/runtimeConfig":"./dist-es/runtimeConfig.browser"},"react-native":{"./dist-es/runtimeConfig":"./dist-es/runtimeConfig.native"},"homepage":"https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-cognito-identity","repository":{"type":"git","url":"https://github.com/aws/aws-sdk-js-v3.git","directory":"clients/client-cognito-identity"}}');

/***/ }),

/***/ 2076:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntimeConfig: () => (/* binding */ getRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2077);
/* harmony import */ var _aws_sdk_core_protocols__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2082);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2109);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2041);
/* harmony import */ var _smithy_url_parser__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(1407);
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(1360);
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(1361);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(2110);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(2111);
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(2048);
/* harmony import */ var _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(2112);









const getRuntimeConfig = (config) => {
    return {
        apiVersion: "2014-06-30",
        base64Decoder: config?.base64Decoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_5__.fromBase64,
        base64Encoder: config?.base64Encoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_6__.toBase64,
        disableHostPrefix: config?.disableHostPrefix ?? false,
        endpointProvider: config?.endpointProvider ?? _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_10__.defaultEndpointResolver,
        extensions: config?.extensions ?? [],
        httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_9__.defaultCognitoIdentityHttpAuthSchemeProvider,
        httpAuthSchemes: config?.httpAuthSchemes ?? [
            {
                schemeId: "aws.auth#sigv4",
                identityProvider: (ipc) => ipc.getIdentityProvider("aws.auth#sigv4"),
                signer: new _aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.AwsSdkSigV4Signer(),
            },
            {
                schemeId: "smithy.api#noAuth",
                identityProvider: (ipc) => ipc.getIdentityProvider("smithy.api#noAuth") || (async () => ({})),
                signer: new _smithy_core__WEBPACK_IMPORTED_MODULE_2__.NoAuthSigner(),
            },
        ],
        logger: config?.logger ?? new _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.NoOpLogger(),
        protocol: config?.protocol ?? _aws_sdk_core_protocols__WEBPACK_IMPORTED_MODULE_1__.AwsJson1_1Protocol,
        protocolSettings: config?.protocolSettings ?? {
            defaultNamespace: "com.amazonaws.cognitoidentity",
            xmlNamespace: "http://cognito-identity.amazonaws.com/doc/2014-06-30/",
            version: "2014-06-30",
            serviceTarget: "AWSCognitoIdentityService",
        },
        serviceId: config?.serviceId ?? "Cognito Identity",
        urlParser: config?.urlParser ?? _smithy_url_parser__WEBPACK_IMPORTED_MODULE_4__.parseUrl,
        utf8Decoder: config?.utf8Decoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_7__.fromUtf8,
        utf8Encoder: config?.utf8Encoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_8__.toUtf8,
    };
};


/***/ }),

/***/ 2082:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AwsJson1_1Protocol: () => (/* binding */ AwsJson1_1Protocol)
/* harmony export */ });
/* harmony import */ var _AwsJsonRpcProtocol__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2083);

class AwsJson1_1Protocol extends _AwsJsonRpcProtocol__WEBPACK_IMPORTED_MODULE_0__.AwsJsonRpcProtocol {
    constructor({ defaultNamespace, serviceTarget, awsQueryCompatible, jsonCodec, }) {
        super({
            defaultNamespace,
            serviceTarget,
            awsQueryCompatible,
            jsonCodec,
        });
    }
    getShapeId() {
        return "aws.protocols#awsJson1_1";
    }
    getJsonRpcVersion() {
        return "1.1";
    }
    getDefaultContentType() {
        return "application/x-amz-json-1.1";
    }
}


/***/ }),

/***/ 2083:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AwsJsonRpcProtocol: () => (/* binding */ AwsJsonRpcProtocol)
/* harmony export */ });
/* harmony import */ var _smithy_core_protocols__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2084);
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2086);
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2085);
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2093);
/* harmony import */ var _ProtocolLib__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2094);
/* harmony import */ var _JsonCodec__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(2096);
/* harmony import */ var _parseJsonBody__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(2104);





class AwsJsonRpcProtocol extends _smithy_core_protocols__WEBPACK_IMPORTED_MODULE_0__.RpcProtocol {
    serializer;
    deserializer;
    serviceTarget;
    codec;
    mixin;
    awsQueryCompatible;
    constructor({ defaultNamespace, serviceTarget, awsQueryCompatible, jsonCodec, }) {
        super({
            defaultNamespace,
        });
        this.serviceTarget = serviceTarget;
        this.codec =
            jsonCodec ??
                new _JsonCodec__WEBPACK_IMPORTED_MODULE_5__.JsonCodec({
                    timestampFormat: {
                        useTrait: true,
                        default: 7,
                    },
                    jsonName: false,
                });
        this.serializer = this.codec.createSerializer();
        this.deserializer = this.codec.createDeserializer();
        this.awsQueryCompatible = !!awsQueryCompatible;
        this.mixin = new _ProtocolLib__WEBPACK_IMPORTED_MODULE_4__.ProtocolLib(this.awsQueryCompatible);
    }
    async serializeRequest(operationSchema, input, context) {
        const request = await super.serializeRequest(operationSchema, input, context);
        if (!request.path.endsWith("/")) {
            request.path += "/";
        }
        Object.assign(request.headers, {
            "content-type": `application/x-amz-json-${this.getJsonRpcVersion()}`,
            "x-amz-target": `${this.serviceTarget}.${operationSchema.name}`,
        });
        if (this.awsQueryCompatible) {
            request.headers["x-amzn-query-mode"] = "true";
        }
        if ((0,_smithy_core_schema__WEBPACK_IMPORTED_MODULE_1__.deref)(operationSchema.input) === "unit" || !request.body) {
            request.body = "{}";
        }
        return request;
    }
    getPayloadCodec() {
        return this.codec;
    }
    async handleError(operationSchema, context, response, dataObject, metadata) {
        if (this.awsQueryCompatible) {
            this.mixin.setQueryCompatError(dataObject, response);
        }
        const errorIdentifier = (0,_parseJsonBody__WEBPACK_IMPORTED_MODULE_6__.loadRestJsonErrorCode)(response, dataObject) ?? "Unknown";
        const { errorSchema, errorMetadata } = await this.mixin.getErrorSchemaOrThrowBaseException(errorIdentifier, this.options.defaultNamespace, response, dataObject, metadata, this.awsQueryCompatible ? this.mixin.findQueryCompatibleError : undefined);
        const ns = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_2__.NormalizedSchema.of(errorSchema);
        const message = dataObject.message ?? dataObject.Message ?? "Unknown";
        const ErrorCtor = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_3__.TypeRegistry.for(errorSchema[1]).getErrorCtor(errorSchema) ?? Error;
        const exception = new ErrorCtor(message);
        const output = {};
        for (const [name, member] of ns.structIterator()) {
            if (dataObject[name] != null) {
                output[name] = this.codec.createDeserializer().readObject(member, dataObject[name]);
            }
        }
        if (this.awsQueryCompatible) {
            this.mixin.queryCompatOutput(dataObject, output);
        }
        throw this.mixin.decorateServiceException(Object.assign(exception, errorMetadata, {
            $fault: ns.getMergedTraits().error,
            message,
        }, output), dataObject);
    }
}


/***/ }),

/***/ 2084:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RpcProtocol: () => (/* binding */ RpcProtocol)
/* harmony export */ });
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2085);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1350);
/* harmony import */ var _collect_stream_body__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2088);
/* harmony import */ var _HttpProtocol__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2091);




class RpcProtocol extends _HttpProtocol__WEBPACK_IMPORTED_MODULE_3__.HttpProtocol {
    async serializeRequest(operationSchema, input, context) {
        const serializer = this.serializer;
        const query = {};
        const headers = {};
        const endpoint = await context.endpoint();
        const ns = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.NormalizedSchema.of(operationSchema?.input);
        const schema = ns.getSchema();
        let payload;
        const request = new _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__.HttpRequest({
            protocol: "",
            hostname: "",
            port: undefined,
            path: "/",
            fragment: undefined,
            query: query,
            headers: headers,
            body: undefined,
        });
        if (endpoint) {
            this.updateServiceEndpoint(request, endpoint);
            this.setHostPrefix(request, operationSchema, input);
        }
        const _input = {
            ...input,
        };
        if (input) {
            const eventStreamMember = ns.getEventStreamMember();
            if (eventStreamMember) {
                if (_input[eventStreamMember]) {
                    const initialRequest = {};
                    for (const [memberName, memberSchema] of ns.structIterator()) {
                        if (memberName !== eventStreamMember && _input[memberName]) {
                            serializer.write(memberSchema, _input[memberName]);
                            initialRequest[memberName] = serializer.flush();
                        }
                    }
                    payload = await this.serializeEventStream({
                        eventStream: _input[eventStreamMember],
                        requestSchema: ns,
                        initialRequest,
                    });
                }
            }
            else {
                serializer.write(schema, _input);
                payload = serializer.flush();
            }
        }
        request.headers = headers;
        request.query = query;
        request.body = payload;
        request.method = "POST";
        return request;
    }
    async deserializeResponse(operationSchema, context, response) {
        const deserializer = this.deserializer;
        const ns = _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.NormalizedSchema.of(operationSchema.output);
        const dataObject = {};
        if (response.statusCode >= 300) {
            const bytes = await (0,_collect_stream_body__WEBPACK_IMPORTED_MODULE_2__.collectBody)(response.body, context);
            if (bytes.byteLength > 0) {
                Object.assign(dataObject, await deserializer.read(15, bytes));
            }
            await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
            throw new Error("@smithy/core/protocols - RPC Protocol error handler failed to throw.");
        }
        for (const header in response.headers) {
            const value = response.headers[header];
            delete response.headers[header];
            response.headers[header.toLowerCase()] = value;
        }
        const eventStreamMember = ns.getEventStreamMember();
        if (eventStreamMember) {
            dataObject[eventStreamMember] = await this.deserializeEventStream({
                response,
                responseSchema: ns,
                initialResponseContainer: dataObject,
            });
        }
        else {
            const bytes = await (0,_collect_stream_body__WEBPACK_IMPORTED_MODULE_2__.collectBody)(response.body, context);
            if (bytes.byteLength > 0) {
                Object.assign(dataObject, await deserializer.read(ns, bytes));
            }
        }
        dataObject.$metadata = this.deserializeMetadata(response);
        return dataObject;
    }
}


/***/ }),

/***/ 2110:
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

/***/ 2111:
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

/***/ 2112:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultEndpointResolver: () => (/* binding */ defaultEndpointResolver)
/* harmony export */ });
/* harmony import */ var _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1960);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2113);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1962);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1972);
/* harmony import */ var _ruleset__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2114);



const cache = new _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_1__.EndpointCache({
    size: 50,
    params: ["Endpoint", "Region", "UseDualStack", "UseFIPS"],
});
const defaultEndpointResolver = (endpointParams, context = {}) => {
    return cache.get(endpointParams, () => (0,_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_3__.resolveEndpoint)(_ruleset__WEBPACK_IMPORTED_MODULE_4__.ruleSet, {
        endpointParams: endpointParams,
        logger: context.logger,
    }));
};
_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_2__.customEndpointFunctions.aws = _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.awsEndpointFunctions;


/***/ }),

/***/ 2114:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ruleSet: () => (/* binding */ ruleSet)
/* harmony export */ });
const w = "required", x = "fn", y = "argv", z = "ref";
const a = true, b = "isSet", c = "booleanEquals", d = "error", e = "endpoint", f = "tree", g = "PartitionResult", h = "getAttr", i = "stringEquals", j = { [w]: false, "type": "string" }, k = { [w]: true, "default": false, "type": "boolean" }, l = { [z]: "Endpoint" }, m = { [x]: c, [y]: [{ [z]: "UseFIPS" }, true] }, n = { [x]: c, [y]: [{ [z]: "UseDualStack" }, true] }, o = {}, p = { [z]: "Region" }, q = { [x]: h, [y]: [{ [z]: g }, "supportsFIPS"] }, r = { [z]: g }, s = { [x]: c, [y]: [true, { [x]: h, [y]: [r, "supportsDualStack"] }] }, t = [m], u = [n], v = [p];
const _data = { version: "1.0", parameters: { Region: j, UseDualStack: k, UseFIPS: k, Endpoint: j }, rules: [{ conditions: [{ [x]: b, [y]: [l] }], rules: [{ conditions: t, error: "Invalid Configuration: FIPS and custom endpoint are not supported", type: d }, { conditions: u, error: "Invalid Configuration: Dualstack and custom endpoint are not supported", type: d }, { endpoint: { url: l, properties: o, headers: o }, type: e }], type: f }, { conditions: [{ [x]: b, [y]: v }], rules: [{ conditions: [{ [x]: "aws.partition", [y]: v, assign: g }], rules: [{ conditions: [m, n], rules: [{ conditions: [{ [x]: c, [y]: [a, q] }, s], rules: [{ conditions: [{ [x]: i, [y]: [p, "us-east-1"] }], endpoint: { url: "https://cognito-identity-fips.us-east-1.amazonaws.com", properties: o, headers: o }, type: e }, { conditions: [{ [x]: i, [y]: [p, "us-east-2"] }], endpoint: { url: "https://cognito-identity-fips.us-east-2.amazonaws.com", properties: o, headers: o }, type: e }, { conditions: [{ [x]: i, [y]: [p, "us-west-1"] }], endpoint: { url: "https://cognito-identity-fips.us-west-1.amazonaws.com", properties: o, headers: o }, type: e }, { conditions: [{ [x]: i, [y]: [p, "us-west-2"] }], endpoint: { url: "https://cognito-identity-fips.us-west-2.amazonaws.com", properties: o, headers: o }, type: e }, { endpoint: { url: "https://cognito-identity-fips.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: o, headers: o }, type: e }], type: f }, { error: "FIPS and DualStack are enabled, but this partition does not support one or both", type: d }], type: f }, { conditions: t, rules: [{ conditions: [{ [x]: c, [y]: [q, a] }], rules: [{ endpoint: { url: "https://cognito-identity-fips.{Region}.{PartitionResult#dnsSuffix}", properties: o, headers: o }, type: e }], type: f }, { error: "FIPS is enabled but this partition does not support FIPS", type: d }], type: f }, { conditions: u, rules: [{ conditions: [s], rules: [{ conditions: [{ [x]: i, [y]: ["aws", { [x]: h, [y]: [r, "name"] }] }], endpoint: { url: "https://cognito-identity.{Region}.amazonaws.com", properties: o, headers: o }, type: e }, { endpoint: { url: "https://cognito-identity.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: o, headers: o }, type: e }], type: f }, { error: "DualStack is enabled but this partition does not support DualStack", type: d }], type: f }, { endpoint: { url: "https://cognito-identity.{Region}.{PartitionResult#dnsSuffix}", properties: o, headers: o }, type: e }], type: f }], type: f }, { error: "Invalid Configuration: Missing Region", type: d }] };
const ruleSet = _data;


/***/ }),

/***/ 2115:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveRuntimeExtensions: () => (/* binding */ resolveRuntimeExtensions)
/* harmony export */ });
/* harmony import */ var _aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2116);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1452);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2117);
/* harmony import */ var _auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2121);




const resolveRuntimeExtensions = (runtimeConfig, extensions) => {
    const extensionConfiguration = Object.assign((0,_aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__.getAwsRegionExtensionConfiguration)(runtimeConfig), (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.getDefaultExtensionConfiguration)(runtimeConfig), (0,_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__.getHttpHandlerExtensionConfiguration)(runtimeConfig), (0,_auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__.getHttpAuthExtensionConfiguration)(runtimeConfig));
    extensions.forEach((extension) => extension.configure(extensionConfiguration));
    return Object.assign(runtimeConfig, (0,_aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__.resolveAwsRegionExtensionConfiguration)(extensionConfiguration), (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.resolveDefaultRuntimeConfig)(extensionConfiguration), (0,_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_1__.resolveHttpHandlerRuntimeConfig)(extensionConfiguration), (0,_auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__.resolveHttpAuthRuntimeConfig)(extensionConfiguration));
};


/***/ }),

/***/ 2121:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getHttpAuthExtensionConfiguration: () => (/* binding */ getHttpAuthExtensionConfiguration),
/* harmony export */   resolveHttpAuthRuntimeConfig: () => (/* binding */ resolveHttpAuthRuntimeConfig)
/* harmony export */ });
const getHttpAuthExtensionConfiguration = (runtimeConfig) => {
    const _httpAuthSchemes = runtimeConfig.httpAuthSchemes;
    let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider;
    let _credentials = runtimeConfig.credentials;
    return {
        setHttpAuthScheme(httpAuthScheme) {
            const index = _httpAuthSchemes.findIndex((scheme) => scheme.schemeId === httpAuthScheme.schemeId);
            if (index === -1) {
                _httpAuthSchemes.push(httpAuthScheme);
            }
            else {
                _httpAuthSchemes.splice(index, 1, httpAuthScheme);
            }
        },
        httpAuthSchemes() {
            return _httpAuthSchemes;
        },
        setHttpAuthSchemeProvider(httpAuthSchemeProvider) {
            _httpAuthSchemeProvider = httpAuthSchemeProvider;
        },
        httpAuthSchemeProvider() {
            return _httpAuthSchemeProvider;
        },
        setCredentials(credentials) {
            _credentials = credentials;
        },
        credentials() {
            return _credentials;
        },
    };
};
const resolveHttpAuthRuntimeConfig = (config) => {
    return {
        httpAuthSchemes: config.httpAuthSchemes(),
        httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
        credentials: config.credentials(),
    };
};


/***/ }),

/***/ 2122:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.Command),
/* harmony export */   GetCredentialsForIdentityCommand: () => (/* binding */ GetCredentialsForIdentityCommand)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2123);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2132);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2051);
/* harmony import */ var _schemas_schemas_0__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2134);





class GetCredentialsForIdentityCommand extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.Command
    .classBuilder()
    .ep(_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__.commonParams)
    .m(function (Command, cs, config, o) {
    return [(0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_0__.getEndpointPlugin)(config, Command.getEndpointParameterInstructions())];
})
    .s("AWSCognitoIdentityService", "GetCredentialsForIdentity", {})
    .n("CognitoIdentityClient", "GetCredentialsForIdentityCommand")
    .sc(_schemas_schemas_0__WEBPACK_IMPORTED_MODULE_3__.GetCredentialsForIdentity$)
    .build() {
}


/***/ }),

/***/ 2134:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CognitoIdentityProvider$: () => (/* binding */ CognitoIdentityProvider$),
/* harmony export */   CognitoIdentityServiceException$: () => (/* binding */ CognitoIdentityServiceException$),
/* harmony export */   ConcurrentModificationException$: () => (/* binding */ ConcurrentModificationException$),
/* harmony export */   CreateIdentityPool$: () => (/* binding */ CreateIdentityPool$),
/* harmony export */   CreateIdentityPoolInput$: () => (/* binding */ CreateIdentityPoolInput$),
/* harmony export */   Credentials$: () => (/* binding */ Credentials$),
/* harmony export */   DeleteIdentities$: () => (/* binding */ DeleteIdentities$),
/* harmony export */   DeleteIdentitiesInput$: () => (/* binding */ DeleteIdentitiesInput$),
/* harmony export */   DeleteIdentitiesResponse$: () => (/* binding */ DeleteIdentitiesResponse$),
/* harmony export */   DeleteIdentityPool$: () => (/* binding */ DeleteIdentityPool$),
/* harmony export */   DeleteIdentityPoolInput$: () => (/* binding */ DeleteIdentityPoolInput$),
/* harmony export */   DescribeIdentity$: () => (/* binding */ DescribeIdentity$),
/* harmony export */   DescribeIdentityInput$: () => (/* binding */ DescribeIdentityInput$),
/* harmony export */   DescribeIdentityPool$: () => (/* binding */ DescribeIdentityPool$),
/* harmony export */   DescribeIdentityPoolInput$: () => (/* binding */ DescribeIdentityPoolInput$),
/* harmony export */   DeveloperUserAlreadyRegisteredException$: () => (/* binding */ DeveloperUserAlreadyRegisteredException$),
/* harmony export */   ExternalServiceException$: () => (/* binding */ ExternalServiceException$),
/* harmony export */   GetCredentialsForIdentity$: () => (/* binding */ GetCredentialsForIdentity$),
/* harmony export */   GetCredentialsForIdentityInput$: () => (/* binding */ GetCredentialsForIdentityInput$),
/* harmony export */   GetCredentialsForIdentityResponse$: () => (/* binding */ GetCredentialsForIdentityResponse$),
/* harmony export */   GetId$: () => (/* binding */ GetId$),
/* harmony export */   GetIdInput$: () => (/* binding */ GetIdInput$),
/* harmony export */   GetIdResponse$: () => (/* binding */ GetIdResponse$),
/* harmony export */   GetIdentityPoolRoles$: () => (/* binding */ GetIdentityPoolRoles$),
/* harmony export */   GetIdentityPoolRolesInput$: () => (/* binding */ GetIdentityPoolRolesInput$),
/* harmony export */   GetIdentityPoolRolesResponse$: () => (/* binding */ GetIdentityPoolRolesResponse$),
/* harmony export */   GetOpenIdToken$: () => (/* binding */ GetOpenIdToken$),
/* harmony export */   GetOpenIdTokenForDeveloperIdentity$: () => (/* binding */ GetOpenIdTokenForDeveloperIdentity$),
/* harmony export */   GetOpenIdTokenForDeveloperIdentityInput$: () => (/* binding */ GetOpenIdTokenForDeveloperIdentityInput$),
/* harmony export */   GetOpenIdTokenForDeveloperIdentityResponse$: () => (/* binding */ GetOpenIdTokenForDeveloperIdentityResponse$),
/* harmony export */   GetOpenIdTokenInput$: () => (/* binding */ GetOpenIdTokenInput$),
/* harmony export */   GetOpenIdTokenResponse$: () => (/* binding */ GetOpenIdTokenResponse$),
/* harmony export */   GetPrincipalTagAttributeMap$: () => (/* binding */ GetPrincipalTagAttributeMap$),
/* harmony export */   GetPrincipalTagAttributeMapInput$: () => (/* binding */ GetPrincipalTagAttributeMapInput$),
/* harmony export */   GetPrincipalTagAttributeMapResponse$: () => (/* binding */ GetPrincipalTagAttributeMapResponse$),
/* harmony export */   IdentityDescription$: () => (/* binding */ IdentityDescription$),
/* harmony export */   IdentityPool$: () => (/* binding */ IdentityPool$),
/* harmony export */   IdentityPoolShortDescription$: () => (/* binding */ IdentityPoolShortDescription$),
/* harmony export */   InternalErrorException$: () => (/* binding */ InternalErrorException$),
/* harmony export */   InvalidIdentityPoolConfigurationException$: () => (/* binding */ InvalidIdentityPoolConfigurationException$),
/* harmony export */   InvalidParameterException$: () => (/* binding */ InvalidParameterException$),
/* harmony export */   LimitExceededException$: () => (/* binding */ LimitExceededException$),
/* harmony export */   ListIdentities$: () => (/* binding */ ListIdentities$),
/* harmony export */   ListIdentitiesInput$: () => (/* binding */ ListIdentitiesInput$),
/* harmony export */   ListIdentitiesResponse$: () => (/* binding */ ListIdentitiesResponse$),
/* harmony export */   ListIdentityPools$: () => (/* binding */ ListIdentityPools$),
/* harmony export */   ListIdentityPoolsInput$: () => (/* binding */ ListIdentityPoolsInput$),
/* harmony export */   ListIdentityPoolsResponse$: () => (/* binding */ ListIdentityPoolsResponse$),
/* harmony export */   ListTagsForResource$: () => (/* binding */ ListTagsForResource$),
/* harmony export */   ListTagsForResourceInput$: () => (/* binding */ ListTagsForResourceInput$),
/* harmony export */   ListTagsForResourceResponse$: () => (/* binding */ ListTagsForResourceResponse$),
/* harmony export */   LookupDeveloperIdentity$: () => (/* binding */ LookupDeveloperIdentity$),
/* harmony export */   LookupDeveloperIdentityInput$: () => (/* binding */ LookupDeveloperIdentityInput$),
/* harmony export */   LookupDeveloperIdentityResponse$: () => (/* binding */ LookupDeveloperIdentityResponse$),
/* harmony export */   MappingRule$: () => (/* binding */ MappingRule$),
/* harmony export */   MergeDeveloperIdentities$: () => (/* binding */ MergeDeveloperIdentities$),
/* harmony export */   MergeDeveloperIdentitiesInput$: () => (/* binding */ MergeDeveloperIdentitiesInput$),
/* harmony export */   MergeDeveloperIdentitiesResponse$: () => (/* binding */ MergeDeveloperIdentitiesResponse$),
/* harmony export */   NotAuthorizedException$: () => (/* binding */ NotAuthorizedException$),
/* harmony export */   ResourceConflictException$: () => (/* binding */ ResourceConflictException$),
/* harmony export */   ResourceNotFoundException$: () => (/* binding */ ResourceNotFoundException$),
/* harmony export */   RoleMapping$: () => (/* binding */ RoleMapping$),
/* harmony export */   RulesConfigurationType$: () => (/* binding */ RulesConfigurationType$),
/* harmony export */   SetIdentityPoolRoles$: () => (/* binding */ SetIdentityPoolRoles$),
/* harmony export */   SetIdentityPoolRolesInput$: () => (/* binding */ SetIdentityPoolRolesInput$),
/* harmony export */   SetPrincipalTagAttributeMap$: () => (/* binding */ SetPrincipalTagAttributeMap$),
/* harmony export */   SetPrincipalTagAttributeMapInput$: () => (/* binding */ SetPrincipalTagAttributeMapInput$),
/* harmony export */   SetPrincipalTagAttributeMapResponse$: () => (/* binding */ SetPrincipalTagAttributeMapResponse$),
/* harmony export */   TagResource$: () => (/* binding */ TagResource$),
/* harmony export */   TagResourceInput$: () => (/* binding */ TagResourceInput$),
/* harmony export */   TagResourceResponse$: () => (/* binding */ TagResourceResponse$),
/* harmony export */   TooManyRequestsException$: () => (/* binding */ TooManyRequestsException$),
/* harmony export */   UnlinkDeveloperIdentity$: () => (/* binding */ UnlinkDeveloperIdentity$),
/* harmony export */   UnlinkDeveloperIdentityInput$: () => (/* binding */ UnlinkDeveloperIdentityInput$),
/* harmony export */   UnlinkIdentity$: () => (/* binding */ UnlinkIdentity$),
/* harmony export */   UnlinkIdentityInput$: () => (/* binding */ UnlinkIdentityInput$),
/* harmony export */   UnprocessedIdentityId$: () => (/* binding */ UnprocessedIdentityId$),
/* harmony export */   UntagResource$: () => (/* binding */ UntagResource$),
/* harmony export */   UntagResourceInput$: () => (/* binding */ UntagResourceInput$),
/* harmony export */   UntagResourceResponse$: () => (/* binding */ UntagResourceResponse$),
/* harmony export */   UpdateIdentityPool$: () => (/* binding */ UpdateIdentityPool$)
/* harmony export */ });
/* harmony import */ var _smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2093);
/* harmony import */ var _models_CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2135);
/* harmony import */ var _models_errors__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2136);
const _ACF = "AllowClassicFlow";
const _AI = "AccountId";
const _AKI = "AccessKeyId";
const _ARR = "AmbiguousRoleResolution";
const _AUI = "AllowUnauthenticatedIdentities";
const _C = "Credentials";
const _CD = "CreationDate";
const _CI = "ClientId";
const _CIP = "CognitoIdentityProvider";
const _CIPI = "CreateIdentityPoolInput";
const _CIPL = "CognitoIdentityProviderList";
const _CIPo = "CognitoIdentityProviders";
const _CIPr = "CreateIdentityPool";
const _CME = "ConcurrentModificationException";
const _CRA = "CustomRoleArn";
const _Cl = "Claim";
const _DI = "DeleteIdentities";
const _DII = "DeleteIdentitiesInput";
const _DIIe = "DescribeIdentityInput";
const _DIP = "DeleteIdentityPool";
const _DIPI = "DeleteIdentityPoolInput";
const _DIPIe = "DescribeIdentityPoolInput";
const _DIPe = "DescribeIdentityPool";
const _DIR = "DeleteIdentitiesResponse";
const _DIe = "DescribeIdentity";
const _DPN = "DeveloperProviderName";
const _DUARE = "DeveloperUserAlreadyRegisteredException";
const _DUI = "DeveloperUserIdentifier";
const _DUIL = "DeveloperUserIdentifierList";
const _DUIe = "DestinationUserIdentifier";
const _E = "Expiration";
const _EC = "ErrorCode";
const _ESE = "ExternalServiceException";
const _GCFI = "GetCredentialsForIdentity";
const _GCFII = "GetCredentialsForIdentityInput";
const _GCFIR = "GetCredentialsForIdentityResponse";
const _GI = "GetId";
const _GII = "GetIdInput";
const _GIPR = "GetIdentityPoolRoles";
const _GIPRI = "GetIdentityPoolRolesInput";
const _GIPRR = "GetIdentityPoolRolesResponse";
const _GIR = "GetIdResponse";
const _GOIT = "GetOpenIdToken";
const _GOITFDI = "GetOpenIdTokenForDeveloperIdentity";
const _GOITFDII = "GetOpenIdTokenForDeveloperIdentityInput";
const _GOITFDIR = "GetOpenIdTokenForDeveloperIdentityResponse";
const _GOITI = "GetOpenIdTokenInput";
const _GOITR = "GetOpenIdTokenResponse";
const _GPTAM = "GetPrincipalTagAttributeMap";
const _GPTAMI = "GetPrincipalTagAttributeMapInput";
const _GPTAMR = "GetPrincipalTagAttributeMapResponse";
const _HD = "HideDisabled";
const _I = "Identities";
const _ID = "IdentityDescription";
const _IEE = "InternalErrorException";
const _II = "IdentityId";
const _IIPCE = "InvalidIdentityPoolConfigurationException";
const _IITD = "IdentityIdsToDelete";
const _IL = "IdentitiesList";
const _IP = "IdentityPool";
const _IPE = "InvalidParameterException";
const _IPI = "IdentityPoolId";
const _IPL = "IdentityPoolsList";
const _IPN = "IdentityPoolName";
const _IPNd = "IdentityProviderName";
const _IPSD = "IdentityPoolShortDescription";
const _IPT = "IdentityProviderToken";
const _IPTd = "IdentityPoolTags";
const _IPd = "IdentityPools";
const _L = "Logins";
const _LDI = "LookupDeveloperIdentity";
const _LDII = "LookupDeveloperIdentityInput";
const _LDIR = "LookupDeveloperIdentityResponse";
const _LEE = "LimitExceededException";
const _LI = "ListIdentities";
const _LII = "ListIdentitiesInput";
const _LIP = "ListIdentityPools";
const _LIPI = "ListIdentityPoolsInput";
const _LIPR = "ListIdentityPoolsResponse";
const _LIR = "ListIdentitiesResponse";
const _LM = "LoginsMap";
const _LMD = "LastModifiedDate";
const _LTFR = "ListTagsForResource";
const _LTFRI = "ListTagsForResourceInput";
const _LTFRR = "ListTagsForResourceResponse";
const _LTR = "LoginsToRemove";
const _MDI = "MergeDeveloperIdentities";
const _MDII = "MergeDeveloperIdentitiesInput";
const _MDIR = "MergeDeveloperIdentitiesResponse";
const _MR = "MaxResults";
const _MRL = "MappingRulesList";
const _MRa = "MappingRule";
const _MT = "MatchType";
const _NAE = "NotAuthorizedException";
const _NT = "NextToken";
const _OICPARN = "OpenIdConnectProviderARNs";
const _OIDCT = "OIDCToken";
const _PN = "ProviderName";
const _PT = "PrincipalTags";
const _R = "Roles";
const _RA = "ResourceArn";
const _RARN = "RoleARN";
const _RC = "RulesConfiguration";
const _RCE = "ResourceConflictException";
const _RCT = "RulesConfigurationType";
const _RM = "RoleMappings";
const _RMM = "RoleMappingMap";
const _RMo = "RoleMapping";
const _RNFE = "ResourceNotFoundException";
const _Ru = "Rules";
const _SIPR = "SetIdentityPoolRoles";
const _SIPRI = "SetIdentityPoolRolesInput";
const _SK = "SecretKey";
const _SKS = "SecretKeyString";
const _SLP = "SupportedLoginProviders";
const _SPARN = "SamlProviderARNs";
const _SPTAM = "SetPrincipalTagAttributeMap";
const _SPTAMI = "SetPrincipalTagAttributeMapInput";
const _SPTAMR = "SetPrincipalTagAttributeMapResponse";
const _SSTC = "ServerSideTokenCheck";
const _ST = "SessionToken";
const _SUI = "SourceUserIdentifier";
const _T = "Token";
const _TD = "TokenDuration";
const _TK = "TagKeys";
const _TMRE = "TooManyRequestsException";
const _TR = "TagResource";
const _TRI = "TagResourceInput";
const _TRR = "TagResourceResponse";
const _Ta = "Tags";
const _Ty = "Type";
const _UD = "UseDefaults";
const _UDI = "UnlinkDeveloperIdentity";
const _UDII = "UnlinkDeveloperIdentityInput";
const _UI = "UnlinkIdentity";
const _UII = "UnprocessedIdentityIds";
const _UIIL = "UnprocessedIdentityIdList";
const _UIIn = "UnlinkIdentityInput";
const _UIInp = "UnprocessedIdentityId";
const _UIP = "UpdateIdentityPool";
const _UR = "UntagResource";
const _URI = "UntagResourceInput";
const _URR = "UntagResourceResponse";
const _V = "Value";
const _c = "client";
const _e = "error";
const _hE = "httpError";
const _m = "message";
const _s = "server";
const _sm = "smithy.ts.sdk.synthetic.com.amazonaws.cognitoidentity";
const n0 = "com.amazonaws.cognitoidentity";



var IdentityProviderToken = [0, n0, _IPT, 8, 0];
var OIDCToken = [0, n0, _OIDCT, 8, 0];
var SecretKeyString = [0, n0, _SKS, 8, 0];
var CognitoIdentityProvider$ = [3, n0, _CIP, 0, [_PN, _CI, _SSTC], [0, 0, 2]];
var ConcurrentModificationException$ = [-3, n0, _CME, { [_e]: _c, [_hE]: 400 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(ConcurrentModificationException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.ConcurrentModificationException);
var CreateIdentityPoolInput$ = [
    3,
    n0,
    _CIPI,
    0,
    [_IPN, _AUI, _ACF, _SLP, _DPN, _OICPARN, _CIPo, _SPARN, _IPTd],
    [0, 2, 2, 128 | 0, 0, 64 | 0, () => CognitoIdentityProviderList, 64 | 0, 128 | 0],
];
var Credentials$ = [
    3,
    n0,
    _C,
    0,
    [_AKI, _SK, _ST, _E],
    [0, [() => SecretKeyString, 0], 0, 4],
];
var DeleteIdentitiesInput$ = [3, n0, _DII, 0, [_IITD], [64 | 0]];
var DeleteIdentitiesResponse$ = [
    3,
    n0,
    _DIR,
    0,
    [_UII],
    [() => UnprocessedIdentityIdList],
];
var DeleteIdentityPoolInput$ = [3, n0, _DIPI, 0, [_IPI], [0]];
var DescribeIdentityInput$ = [3, n0, _DIIe, 0, [_II], [0]];
var DescribeIdentityPoolInput$ = [3, n0, _DIPIe, 0, [_IPI], [0]];
var DeveloperUserAlreadyRegisteredException$ = [
    -3,
    n0,
    _DUARE,
    { [_e]: _c, [_hE]: 400 },
    [_m],
    [0],
];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(DeveloperUserAlreadyRegisteredException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.DeveloperUserAlreadyRegisteredException);
var ExternalServiceException$ = [-3, n0, _ESE, { [_e]: _c, [_hE]: 400 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(ExternalServiceException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.ExternalServiceException);
var GetCredentialsForIdentityInput$ = [
    3,
    n0,
    _GCFII,
    0,
    [_II, _L, _CRA],
    [0, [() => LoginsMap, 0], 0],
];
var GetCredentialsForIdentityResponse$ = [
    3,
    n0,
    _GCFIR,
    0,
    [_II, _C],
    [0, [() => Credentials$, 0]],
];
var GetIdentityPoolRolesInput$ = [3, n0, _GIPRI, 0, [_IPI], [0]];
var GetIdentityPoolRolesResponse$ = [
    3,
    n0,
    _GIPRR,
    0,
    [_IPI, _R, _RM],
    [0, 128 | 0, () => RoleMappingMap],
];
var GetIdInput$ = [3, n0, _GII, 0, [_AI, _IPI, _L], [0, 0, [() => LoginsMap, 0]]];
var GetIdResponse$ = [3, n0, _GIR, 0, [_II], [0]];
var GetOpenIdTokenForDeveloperIdentityInput$ = [
    3,
    n0,
    _GOITFDII,
    0,
    [_IPI, _II, _L, _PT, _TD],
    [0, 0, [() => LoginsMap, 0], 128 | 0, 1],
];
var GetOpenIdTokenForDeveloperIdentityResponse$ = [
    3,
    n0,
    _GOITFDIR,
    0,
    [_II, _T],
    [0, [() => OIDCToken, 0]],
];
var GetOpenIdTokenInput$ = [3, n0, _GOITI, 0, [_II, _L], [0, [() => LoginsMap, 0]]];
var GetOpenIdTokenResponse$ = [3, n0, _GOITR, 0, [_II, _T], [0, [() => OIDCToken, 0]]];
var GetPrincipalTagAttributeMapInput$ = [3, n0, _GPTAMI, 0, [_IPI, _IPNd], [0, 0]];
var GetPrincipalTagAttributeMapResponse$ = [
    3,
    n0,
    _GPTAMR,
    0,
    [_IPI, _IPNd, _UD, _PT],
    [0, 0, 2, 128 | 0],
];
var IdentityDescription$ = [3, n0, _ID, 0, [_II, _L, _CD, _LMD], [0, 64 | 0, 4, 4]];
var IdentityPool$ = [
    3,
    n0,
    _IP,
    0,
    [_IPI, _IPN, _AUI, _ACF, _SLP, _DPN, _OICPARN, _CIPo, _SPARN, _IPTd],
    [0, 0, 2, 2, 128 | 0, 0, 64 | 0, () => CognitoIdentityProviderList, 64 | 0, 128 | 0],
];
var IdentityPoolShortDescription$ = [3, n0, _IPSD, 0, [_IPI, _IPN], [0, 0]];
var InternalErrorException$ = [-3, n0, _IEE, { [_e]: _s }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(InternalErrorException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.InternalErrorException);
var InvalidIdentityPoolConfigurationException$ = [
    -3,
    n0,
    _IIPCE,
    { [_e]: _c, [_hE]: 400 },
    [_m],
    [0],
];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(InvalidIdentityPoolConfigurationException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.InvalidIdentityPoolConfigurationException);
var InvalidParameterException$ = [-3, n0, _IPE, { [_e]: _c, [_hE]: 400 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(InvalidParameterException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.InvalidParameterException);
var LimitExceededException$ = [-3, n0, _LEE, { [_e]: _c, [_hE]: 400 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(LimitExceededException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.LimitExceededException);
var ListIdentitiesInput$ = [3, n0, _LII, 0, [_IPI, _MR, _NT, _HD], [0, 1, 0, 2]];
var ListIdentitiesResponse$ = [
    3,
    n0,
    _LIR,
    0,
    [_IPI, _I, _NT],
    [0, () => IdentitiesList, 0],
];
var ListIdentityPoolsInput$ = [3, n0, _LIPI, 0, [_MR, _NT], [1, 0]];
var ListIdentityPoolsResponse$ = [
    3,
    n0,
    _LIPR,
    0,
    [_IPd, _NT],
    [() => IdentityPoolsList, 0],
];
var ListTagsForResourceInput$ = [3, n0, _LTFRI, 0, [_RA], [0]];
var ListTagsForResourceResponse$ = [3, n0, _LTFRR, 0, [_Ta], [128 | 0]];
var LookupDeveloperIdentityInput$ = [
    3,
    n0,
    _LDII,
    0,
    [_IPI, _II, _DUI, _MR, _NT],
    [0, 0, 0, 1, 0],
];
var LookupDeveloperIdentityResponse$ = [
    3,
    n0,
    _LDIR,
    0,
    [_II, _DUIL, _NT],
    [0, 64 | 0, 0],
];
var MappingRule$ = [3, n0, _MRa, 0, [_Cl, _MT, _V, _RARN], [0, 0, 0, 0]];
var MergeDeveloperIdentitiesInput$ = [
    3,
    n0,
    _MDII,
    0,
    [_SUI, _DUIe, _DPN, _IPI],
    [0, 0, 0, 0],
];
var MergeDeveloperIdentitiesResponse$ = [3, n0, _MDIR, 0, [_II], [0]];
var NotAuthorizedException$ = [-3, n0, _NAE, { [_e]: _c, [_hE]: 403 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(NotAuthorizedException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.NotAuthorizedException);
var ResourceConflictException$ = [-3, n0, _RCE, { [_e]: _c, [_hE]: 409 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(ResourceConflictException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.ResourceConflictException);
var ResourceNotFoundException$ = [-3, n0, _RNFE, { [_e]: _c, [_hE]: 404 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(ResourceNotFoundException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.ResourceNotFoundException);
var RoleMapping$ = [
    3,
    n0,
    _RMo,
    0,
    [_Ty, _ARR, _RC],
    [0, 0, () => RulesConfigurationType$],
];
var RulesConfigurationType$ = [3, n0, _RCT, 0, [_Ru], [() => MappingRulesList]];
var SetIdentityPoolRolesInput$ = [
    3,
    n0,
    _SIPRI,
    0,
    [_IPI, _R, _RM],
    [0, 128 | 0, () => RoleMappingMap],
];
var SetPrincipalTagAttributeMapInput$ = [
    3,
    n0,
    _SPTAMI,
    0,
    [_IPI, _IPNd, _UD, _PT],
    [0, 0, 2, 128 | 0],
];
var SetPrincipalTagAttributeMapResponse$ = [
    3,
    n0,
    _SPTAMR,
    0,
    [_IPI, _IPNd, _UD, _PT],
    [0, 0, 2, 128 | 0],
];
var TagResourceInput$ = [3, n0, _TRI, 0, [_RA, _Ta], [0, 128 | 0]];
var TagResourceResponse$ = [3, n0, _TRR, 0, [], []];
var TooManyRequestsException$ = [-3, n0, _TMRE, { [_e]: _c, [_hE]: 429 }, [_m], [0]];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(n0).registerError(TooManyRequestsException$, _models_errors__WEBPACK_IMPORTED_MODULE_2__.TooManyRequestsException);
var UnlinkDeveloperIdentityInput$ = [
    3,
    n0,
    _UDII,
    0,
    [_II, _IPI, _DPN, _DUI],
    [0, 0, 0, 0],
];
var UnlinkIdentityInput$ = [
    3,
    n0,
    _UIIn,
    0,
    [_II, _L, _LTR],
    [0, [() => LoginsMap, 0], 64 | 0],
];
var UnprocessedIdentityId$ = [3, n0, _UIInp, 0, [_II, _EC], [0, 0]];
var UntagResourceInput$ = [3, n0, _URI, 0, [_RA, _TK], [0, 64 | 0]];
var UntagResourceResponse$ = [3, n0, _URR, 0, [], []];
var __Unit = "unit";
var CognitoIdentityServiceException$ = [
    -3,
    _sm,
    "CognitoIdentityServiceException",
    0,
    [],
    [],
];
_smithy_core_schema__WEBPACK_IMPORTED_MODULE_0__.TypeRegistry.for(_sm).registerError(CognitoIdentityServiceException$, _models_CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_1__.CognitoIdentityServiceException);
var CognitoIdentityProviderList = [1, n0, _CIPL, 0, () => CognitoIdentityProvider$];
var DeveloperUserIdentifierList = 64 | 0;
var IdentitiesList = [1, n0, _IL, 0, () => IdentityDescription$];
var IdentityIdList = 64 | 0;
var IdentityPoolsList = [1, n0, _IPL, 0, () => IdentityPoolShortDescription$];
var IdentityPoolTagsListType = 64 | 0;
var LoginsList = 64 | 0;
var MappingRulesList = [1, n0, _MRL, 0, () => MappingRule$];
var OIDCProviderList = 64 | 0;
var SAMLProviderList = 64 | 0;
var UnprocessedIdentityIdList = [1, n0, _UIIL, 0, () => UnprocessedIdentityId$];
var IdentityPoolTagsType = 128 | 0;
var IdentityProviders = 128 | 0;
var LoginsMap = [2, n0, _LM, 0, [0, 0], [() => IdentityProviderToken, 0]];
var PrincipalTags = 128 | 0;
var RoleMappingMap = [2, n0, _RMM, 0, 0, () => RoleMapping$];
var RolesMap = 128 | 0;
var CreateIdentityPool$ = [
    9,
    n0,
    _CIPr,
    0,
    () => CreateIdentityPoolInput$,
    () => IdentityPool$,
];
var DeleteIdentities$ = [
    9,
    n0,
    _DI,
    0,
    () => DeleteIdentitiesInput$,
    () => DeleteIdentitiesResponse$,
];
var DeleteIdentityPool$ = [9, n0, _DIP, 0, () => DeleteIdentityPoolInput$, () => __Unit];
var DescribeIdentity$ = [
    9,
    n0,
    _DIe,
    0,
    () => DescribeIdentityInput$,
    () => IdentityDescription$,
];
var DescribeIdentityPool$ = [
    9,
    n0,
    _DIPe,
    0,
    () => DescribeIdentityPoolInput$,
    () => IdentityPool$,
];
var GetCredentialsForIdentity$ = [
    9,
    n0,
    _GCFI,
    0,
    () => GetCredentialsForIdentityInput$,
    () => GetCredentialsForIdentityResponse$,
];
var GetId$ = [9, n0, _GI, 0, () => GetIdInput$, () => GetIdResponse$];
var GetIdentityPoolRoles$ = [
    9,
    n0,
    _GIPR,
    0,
    () => GetIdentityPoolRolesInput$,
    () => GetIdentityPoolRolesResponse$,
];
var GetOpenIdToken$ = [
    9,
    n0,
    _GOIT,
    0,
    () => GetOpenIdTokenInput$,
    () => GetOpenIdTokenResponse$,
];
var GetOpenIdTokenForDeveloperIdentity$ = [
    9,
    n0,
    _GOITFDI,
    0,
    () => GetOpenIdTokenForDeveloperIdentityInput$,
    () => GetOpenIdTokenForDeveloperIdentityResponse$,
];
var GetPrincipalTagAttributeMap$ = [
    9,
    n0,
    _GPTAM,
    0,
    () => GetPrincipalTagAttributeMapInput$,
    () => GetPrincipalTagAttributeMapResponse$,
];
var ListIdentities$ = [
    9,
    n0,
    _LI,
    0,
    () => ListIdentitiesInput$,
    () => ListIdentitiesResponse$,
];
var ListIdentityPools$ = [
    9,
    n0,
    _LIP,
    0,
    () => ListIdentityPoolsInput$,
    () => ListIdentityPoolsResponse$,
];
var ListTagsForResource$ = [
    9,
    n0,
    _LTFR,
    0,
    () => ListTagsForResourceInput$,
    () => ListTagsForResourceResponse$,
];
var LookupDeveloperIdentity$ = [
    9,
    n0,
    _LDI,
    0,
    () => LookupDeveloperIdentityInput$,
    () => LookupDeveloperIdentityResponse$,
];
var MergeDeveloperIdentities$ = [
    9,
    n0,
    _MDI,
    0,
    () => MergeDeveloperIdentitiesInput$,
    () => MergeDeveloperIdentitiesResponse$,
];
var SetIdentityPoolRoles$ = [
    9,
    n0,
    _SIPR,
    0,
    () => SetIdentityPoolRolesInput$,
    () => __Unit,
];
var SetPrincipalTagAttributeMap$ = [
    9,
    n0,
    _SPTAM,
    0,
    () => SetPrincipalTagAttributeMapInput$,
    () => SetPrincipalTagAttributeMapResponse$,
];
var TagResource$ = [9, n0, _TR, 0, () => TagResourceInput$, () => TagResourceResponse$];
var UnlinkDeveloperIdentity$ = [
    9,
    n0,
    _UDI,
    0,
    () => UnlinkDeveloperIdentityInput$,
    () => __Unit,
];
var UnlinkIdentity$ = [9, n0, _UI, 0, () => UnlinkIdentityInput$, () => __Unit];
var UntagResource$ = [
    9,
    n0,
    _UR,
    0,
    () => UntagResourceInput$,
    () => UntagResourceResponse$,
];
var UpdateIdentityPool$ = [9, n0, _UIP, 0, () => IdentityPool$, () => IdentityPool$];


/***/ }),

/***/ 2135:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CognitoIdentityServiceException: () => (/* binding */ CognitoIdentityServiceException),
/* harmony export */   __ServiceException: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2095);


class CognitoIdentityServiceException extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException {
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, CognitoIdentityServiceException.prototype);
    }
}


/***/ }),

/***/ 2136:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ConcurrentModificationException: () => (/* binding */ ConcurrentModificationException),
/* harmony export */   DeveloperUserAlreadyRegisteredException: () => (/* binding */ DeveloperUserAlreadyRegisteredException),
/* harmony export */   ExternalServiceException: () => (/* binding */ ExternalServiceException),
/* harmony export */   InternalErrorException: () => (/* binding */ InternalErrorException),
/* harmony export */   InvalidIdentityPoolConfigurationException: () => (/* binding */ InvalidIdentityPoolConfigurationException),
/* harmony export */   InvalidParameterException: () => (/* binding */ InvalidParameterException),
/* harmony export */   LimitExceededException: () => (/* binding */ LimitExceededException),
/* harmony export */   NotAuthorizedException: () => (/* binding */ NotAuthorizedException),
/* harmony export */   ResourceConflictException: () => (/* binding */ ResourceConflictException),
/* harmony export */   ResourceNotFoundException: () => (/* binding */ ResourceNotFoundException),
/* harmony export */   TooManyRequestsException: () => (/* binding */ TooManyRequestsException)
/* harmony export */ });
/* harmony import */ var _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2135);

class InternalErrorException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "InternalErrorException";
    $fault = "server";
    constructor(opts) {
        super({
            name: "InternalErrorException",
            $fault: "server",
            ...opts,
        });
        Object.setPrototypeOf(this, InternalErrorException.prototype);
    }
}
class InvalidParameterException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "InvalidParameterException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidParameterException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidParameterException.prototype);
    }
}
class LimitExceededException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "LimitExceededException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "LimitExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, LimitExceededException.prototype);
    }
}
class NotAuthorizedException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "NotAuthorizedException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NotAuthorizedException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NotAuthorizedException.prototype);
    }
}
class ResourceConflictException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "ResourceConflictException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ResourceConflictException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ResourceConflictException.prototype);
    }
}
class TooManyRequestsException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "TooManyRequestsException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TooManyRequestsException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TooManyRequestsException.prototype);
    }
}
class ResourceNotFoundException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "ResourceNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ResourceNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
    }
}
class ExternalServiceException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "ExternalServiceException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ExternalServiceException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ExternalServiceException.prototype);
    }
}
class InvalidIdentityPoolConfigurationException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "InvalidIdentityPoolConfigurationException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidIdentityPoolConfigurationException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidIdentityPoolConfigurationException.prototype);
    }
}
class DeveloperUserAlreadyRegisteredException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "DeveloperUserAlreadyRegisteredException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "DeveloperUserAlreadyRegisteredException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, DeveloperUserAlreadyRegisteredException.prototype);
    }
}
class ConcurrentModificationException extends _CognitoIdentityServiceException__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityServiceException {
    name = "ConcurrentModificationException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ConcurrentModificationException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ConcurrentModificationException.prototype);
    }
}


/***/ }),

/***/ 2137:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.Command),
/* harmony export */   GetIdCommand: () => (/* binding */ GetIdCommand)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2123);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2132);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2051);
/* harmony import */ var _schemas_schemas_0__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2134);





class GetIdCommand extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.Command
    .classBuilder()
    .ep(_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__.commonParams)
    .m(function (Command, cs, config, o) {
    return [(0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_0__.getEndpointPlugin)(config, Command.getEndpointParameterInstructions())];
})
    .s("AWSCognitoIdentityService", "GetId", {})
    .n("CognitoIdentityClient", "GetIdCommand")
    .sc(_schemas_schemas_0__WEBPACK_IMPORTED_MODULE_3__.GetId$)
    .build() {
}


/***/ })

};
;
//# sourceMappingURL=1.extension.js.map