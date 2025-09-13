import 'kleur/colors';
import { p as decodeKey } from './chunks/astro/server_CX0crnCc.mjs';
import 'clsx';
import 'cookie';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_nmdfGRBs.mjs';
import 'es-module-lexer';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/","cacheDir":"file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/node_modules/.astro/","outDir":"file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/dist/","srcDir":"file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/src/","publicDir":"file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/public/","buildClientDir":"file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/dist/client/","buildServerDir":"file:///C:/Users/User/Desktop/PROYECTOS/Proyecto%20Pynark%20V1/dist/server/","adapterName":"@astrojs/node","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/node.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/chat-response","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/chat-response\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"chat-response","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/chat-response.ts","pathname":"/api/chat-response","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/assets/faq.DrTJJzna.css"},{"type":"inline","content":".faq-content[data-astro-cid-6kmwghhu]{transition:all .3s ease-in-out}.faq-icon[data-astro-cid-6kmwghhu]{transition:transform .3s ease-in-out}\n"}],"routeData":{"route":"/faq","isIndex":false,"type":"page","pattern":"^\\/faq\\/?$","segments":[[{"content":"faq","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/faq.astro","pathname":"/faq","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/assets/faq.DrTJJzna.css"}],"routeData":{"route":"/pricing","isIndex":false,"type":"page","pattern":"^\\/pricing\\/?$","segments":[[{"content":"pricing","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/pricing.astro","pathname":"/pricing","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/assets/faq.DrTJJzna.css"},{"type":"inline","content":"@keyframes fade-in{0%{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in[data-astro-cid-j7pv25f6]{animation:fade-in .5s ease-out forwards}\n"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/faq.astro",{"propagation":"none","containsHead":true}],["C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/index.astro",{"propagation":"none","containsHead":true}],["C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/pricing.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000noop-actions":"_noop-actions.mjs","\u0000@astro-page:src/pages/api/chat-response@_@ts":"pages/api/chat-response.astro.mjs","\u0000@astro-page:src/pages/faq@_@astro":"pages/faq.astro.mjs","\u0000@astro-page:src/pages/pricing@_@astro":"pages/pricing.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/node@_@js":"pages/_image.astro.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_D6rhZlik.mjs","C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/node_modules/unstorage/drivers/fs-lite.mjs":"chunks/fs-lite_COtHaKzy.mjs","C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_CAchpy7w.mjs","C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/components/Chat.tsx":"assets/Chat.C6oJtVOO.js","C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/components/ChatSimulation.tsx":"assets/ChatSimulation.CtEL2szV.js","@astrojs/react/client.js":"assets/client.DVxemvf8.js","C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/faq.astro?astro&type=script&index=0&lang.ts":"assets/faq.astro_astro_type_script_index_0_lang.dGGx6Wcq.js","C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/index.astro?astro&type=script&index=0&lang.ts":"assets/index.astro_astro_type_script_index_0_lang.B9IMdPCi.js","C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/layouts/Layout.astro?astro&type=script&index=0&lang.ts":"assets/Layout.astro_astro_type_script_index_0_lang.C9kvez8N.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[["C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/faq.astro?astro&type=script&index=0&lang.ts","document.addEventListener(\"DOMContentLoaded\",function(){const s=document.querySelectorAll(\".faq-button\");s.forEach(i=>{i.addEventListener(\"click\",function(){const e=this.nextElementSibling,t=this.querySelector(\".faq-icon\"),d=e&&!e.classList.contains(\"hidden\");s.forEach(n=>{if(n!==i){const o=n.nextElementSibling,c=n.querySelector(\".faq-icon\");o&&o.classList.add(\"hidden\"),c&&(c.style.transform=\"rotate(0deg)\")}}),d&&e?(e.classList.add(\"hidden\"),t&&(t.style.transform=\"rotate(0deg)\")):e&&(e.classList.remove(\"hidden\"),t&&(t.style.transform=\"rotate(180deg)\"))})})});"],["C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/pages/index.astro?astro&type=script&index=0&lang.ts","document.addEventListener(\"DOMContentLoaded\",()=>{(!window.location.hash||window.location.hash===\"#\")&&window.scrollTo(0,0)});const e=document.getElementById(\"show-agents-btn\"),t=document.getElementById(\"agent-buttons\"),o=document.getElementById(\"ecommerce-btn\"),c=document.getElementById(\"chat-container\");e?.addEventListener(\"click\",()=>{e.style.display=\"none\",t?.classList.remove(\"hidden\")});o?.addEventListener(\"click\",()=>{t?.classList.add(\"hidden\"),c?.classList.remove(\"hidden\")});const s=document.querySelector(\"form\");s?.addEventListener(\"submit\",n=>{n.preventDefault(),alert(\"¡Gracias por tu mensaje! Te contactaremos pronto.\")});"],["C:/Users/User/Desktop/PROYECTOS/Proyecto Pynark V1/src/layouts/Layout.astro?astro&type=script&index=0&lang.ts","const s=document.getElementById(\"theme-toggle\"),n=document.getElementById(\"theme-toggle-dark-icon\"),c=document.getElementById(\"theme-toggle-light-icon\"),l=document.getElementById(\"mobile-menu-toggle\"),a=document.getElementById(\"mobile-menu\");localStorage.getItem(\"color-theme\")===\"dark\"||!(\"color-theme\"in localStorage)&&window.matchMedia(\"(prefers-color-scheme: dark)\").matches?(document.documentElement.classList.add(\"dark\"),c?.classList.remove(\"hidden\")):(document.documentElement.classList.remove(\"dark\"),n?.classList.remove(\"hidden\"));s?.addEventListener(\"click\",function(){n?.classList.toggle(\"hidden\"),c?.classList.toggle(\"hidden\"),document.documentElement.classList.contains(\"dark\")?(document.documentElement.classList.remove(\"dark\"),localStorage.setItem(\"color-theme\",\"light\")):(document.documentElement.classList.add(\"dark\"),localStorage.setItem(\"color-theme\",\"dark\"))});l?.addEventListener(\"click\",function(){a?.classList.toggle(\"hidden\")});const o=window.location.pathname,d=document.querySelectorAll(\".nav-link\");d.forEach(t=>{const e=t.getAttribute(\"href\");(o===\"/\"&&e===\"/\"||o!==\"/\"&&e!==\"/\"&&e&&o.startsWith(e))&&(t.classList.add(\"text-primary-600\",\"dark:text-primary-400\"),t.classList.remove(\"text-slate-700\",\"dark:text-slate-300\"))});window.location.hash&&!window.location.hash.startsWith(\"#contact\")&&setTimeout(()=>{window.scrollTo(0,0)},100);"]],"assets":["/assets/faq.DrTJJzna.css","/assets/Chat.C6oJtVOO.js","/assets/ChatSimulation.CtEL2szV.js","/assets/client.DVxemvf8.js","/assets/createLucideIcon.C6V8OSr9.js","/assets/index.RH_Wq4ov.js","/assets/pynark_favicon.png"],"buildFormat":"directory","checkOrigin":true,"serverIslandNameMap":[],"key":"S+Ma3BBT/r/xbicJBUYwFL2PP4hAYJvHzSvWms7ZGXU=","sessionConfig":{"driver":"fs-lite","options":{"base":"C:\\Users\\User\\Desktop\\PROYECTOS\\Proyecto Pynark V1\\node_modules\\.astro\\sessions"}}});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = () => import('./chunks/fs-lite_COtHaKzy.mjs');

export { manifest };
