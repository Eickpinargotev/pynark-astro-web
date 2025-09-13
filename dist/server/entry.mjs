import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_BZdiNFjX.mjs';
import { manifest } from './manifest_D6rhZlik.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/chat-response.astro.mjs');
const _page2 = () => import('./pages/faq.astro.mjs');
const _page3 = () => import('./pages/pricing.astro.mjs');
const _page4 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/node.js", _page0],
    ["src/pages/api/chat-response.ts", _page1],
    ["src/pages/faq.astro", _page2],
    ["src/pages/pricing.astro", _page3],
    ["src/pages/index.astro", _page4]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "mode": "standalone",
    "client": "file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/dist/client/",
    "server": "file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/dist/server/",
    "host": false,
    "port": 4321,
    "assets": "assets",
    "experimentalStaticHeaders": false
};
const _exports = createExports(_manifest, _args);
const handler = _exports['handler'];
const startServer = _exports['startServer'];
const options = _exports['options'];
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { handler, options, pageMap, startServer };
