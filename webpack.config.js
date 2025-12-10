const path = require('path');

const extensionConfig = {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            compilerOptions: {
                                jsx: 'react-jsx'
                            }
                        }
                    }
                ]
            }
        ]
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: "log",
    },
};

const webviewConfig = {
    target: 'web',
    mode: 'none',
    entry: './src/webview/app.tsx',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'webview.js'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            compilerOptions: {
                                jsx: 'react-jsx',
                                module: 'esnext'
                            }
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: "log",
    },
};

module.exports = [extensionConfig, webviewConfig];
