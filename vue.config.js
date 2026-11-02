module.exports = {
    publicPath: '/',
    //productionSourceMap: process.env.NODE_ENV !== 'production',
    devServer: {
        historyApiFallback: true,
        // No gzip on the dev server: it serves loopback, where compression only costs. The dev
        // app.js is ~25 MB and was gzipped again on every full load (route interception in the
        // e2e disables the browser cache): 3.4-5.6 s per request against 0.4-0.6 s uncompressed,
        // measured with curl on 2026-10-22.
        compress: false,
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
    // No splitChunks override: Vue CLI's own groups (chunk-vendors, chunk-common) apply. The override that was here,
    // `maxSize: 64000`, cut the vendors into about a hundred files of 64 KB, all named by index.html and all needed
    // before the first paint (103 initial scripts on v2.2.47): one request each, for no cache benefit, since a vendor
    // update changed most of them anyway (docs/execution-plans/2026-10-23-dashboard-load.md, M1).
    configureWebpack: {
        devtool: 'source-map',
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
