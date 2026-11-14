import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const { outputFiles } = await build({
  stdin: {
    contents: `
      import { createRoot } from 'react-dom/client';
      import HomePage from './app/page';
      import RootLayout from './app/layout';
      const { props: { className, children } } = RootLayout({ children: <HomePage /> });
      document.documentElement.className = className;
      const body = children[1];
      document.body.className = body.props.className;
      createRoot(document.getElementById('root')).render(body.props.children);
    `,
    loader: 'tsx',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  jsx: 'automatic',
  minify: true,
  loader: { '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'offline-next-image',
    setup(builder) {
      builder.onResolve({ filter: /^next\/image$/ }, () => ({
        path: 'image',
        namespace: 'offline',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'offline' }, () => ({
        loader: 'jsx',
        resolveDir: process.cwd(),
        contents: `
          export default function Image({ fill, priority, style, ...props }) {
            const sizing = fill && { position: 'absolute', inset: 0, width: '100%', height: '100%' };
            return <img {...props} loading={priority ? 'eager' : 'lazy'} style={{ ...sizing, ...style }} />;
          }
        `,
      }));
    },
  }],
});

const script = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const cssPath = 'app/globals.css';
const { css } = await postcss([tailwind()]).process(await readFile(cssPath, 'utf8'), {
  from: cssPath,
});

// Include literal image references from the bundle and stage assets built from slugs.
const assets = new Set(script.match(/\/assets\/[\w/.-]+\.png/g));
for (const stage of await readdir('public/assets/stages', { withFileTypes: true })) {
  if (!stage.isDirectory()) continue;
  const base = `/assets/stages/${stage.name}`;
  assets.add(`${base}/background.png`);
  for (const layer of ['far', 'mid', 'near', 'floor']) {
    assets.add(`${base}/layers/${layer}.png`);
  }
}

async function* html() {
  yield `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:">
<title>Arcade Fighters '96: The Ultimate Tournament</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
`;
  for (const asset of [...assets].sort()) {
    const png = await readFile(`public${asset}`);
    yield `<script type="application/octet-stream" data-asset="${asset}">${png.toString('base64')}</script>\n`;
  }
  yield `<script>
  // Resolve embedded images just before React or the canvas assigns their source.
  const images = new Map();
  const imageSource = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  function embeddedSource(path) {
    if (images.has(path)) return images.get(path);
    if (typeof path !== 'string' || !path.startsWith('/assets/')) return path;
    const data = document.querySelector('script[data-asset="' + CSS.escape(path) + '"]');
    if (!data) throw new Error('Recurso sin conexión ausente: ' + path);
    const bytes = Uint8Array.from(atob(data.textContent), byte => byte.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    images.set(path, url);
    data.remove();
    return url;
  }
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...imageSource,
    set(path) { imageSource.set.call(this, embeddedSource(path)); },
  });
  const setAttribute = HTMLImageElement.prototype.setAttribute;
  HTMLImageElement.prototype.setAttribute = function (name, value) {
    setAttribute.call(this, name, name === 'src' ? embeddedSource(value) : value);
  };
</script>
<script>${script}</script>
</body>
</html>\n`;
}

await mkdir('dist', { recursive: true });
const output = 'dist/arcade-fighters-96.html';
await pipeline(Readable.from(html()), createWriteStream(output));
console.log(`${output} · ${assets.size} imágenes integradas`);
