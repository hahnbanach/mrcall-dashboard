module.exports = {
    publicPath: '/',
    //productionSourceMap: process.env.NODE_ENV !== 'production',
    devServer: {
        historyApiFallback: true,
        allowedHosts: 'all',
        client: {
            webSocketURL: 'auto://0.0.0.0:0/ws',
            overlay: {
                // Build warnings must not take over the page. `serve --mode test`
                // produces one, DefinePlugin "Conflicting values for
                // process.env.NODE_ENV", because vue-cli derives NODE_ENV from the
                // mode name while serve hardcodes webpack's own mode to
                // development. Harmless at runtime, but the overlay it raised
                // dimmed every page and swallowed pointer events, so E2E clicks
                // timed out and every visual comparison diffed against a greyed
                // screenshot. Errors still show; only warnings are suppressed.
                warnings: false,
                runtimeErrors: (error) => {
                    if (error?.message?.includes('ResizeObserver loop')) return false
                    return true
                }
            }
        },
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    },
    configureWebpack: {
        devtool: 'source-map',
        optimization: {
            splitChunks: {
                chunks: 'async',
                maxSize: 64000,
            },
        }
    },
    transpileDependencies: [
        'vue-meta',
    ],
    pluginOptions: {
        sitemap: {
            trailingSlash: true,
            pretty: true,
            hashMode: false,
            baseURL: process.env.VUE_APP_SERVICE_BASE_URL,
            urls: [
                process.env.VUE_APP_PUBLIC_PATH,
                process.env.VUE_APP_PUBLIC_PATH + '/login',
                process.env.VUE_APP_PUBLIC_PATH + '/signup',
            ]
        },
        i18n: {
            locale: 'en',
            fallbackLocale: 'en',
            localeDir: 'locales',
            enableLegacy: false,
            runtimeOnly: false,
            compositionOnly: false,
            fullInstall: true
        }
    }
}
