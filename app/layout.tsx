import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Arcade Fighters '96: The Ultimate Tournament",
  description:
    'Videojuego de lucha 2D estilo arcade de 1996 con seis luchadores originales, combate a 60Hz, movimientos especiales, superataques, escenarios parallax y sonido sintetizado.',
  openGraph: {
    title: "Arcade Fighters '96: The Ultimate Tournament",
    description:
      'Videojuego de lucha 2D estilo arcade de 1996 con seis luchadores originales, combate a 60Hz, movimientos especiales, superataques, escenarios parallax y sonido sintetizado.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Arcade Fighters '96: The Ultimate Tournament",
    description:
      'Videojuego de lucha 2D estilo arcade de 1996 con seis luchadores originales, combate a 60Hz, movimientos especiales, superataques, escenarios parallax y sonido sintetizado.',
  },
};

const EXTENSION_GUARD_SCRIPT = `
(function() {
  try {
    var origFetch = window.fetch ? window.fetch.bind(window) : undefined;
    var desc = Object.getOwnPropertyDescriptor(window, 'fetch') || Object.getOwnPropertyDescriptor(Window.prototype, 'fetch');
    if (desc && desc.configurable && (!desc.writable && !desc.set)) {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        enumerable: true,
        get: function() { return origFetch; },
        set: function(fn) { if (typeof fn === 'function') { origFetch = fn; } }
      });
    }
  } catch (_) {}

  window.addEventListener('error', function(e) {
    var filename = (e && e.filename) ? String(e.filename) : '';
    var message = (e && e.message) ? String(e.message) : '';
    if (
      filename.indexOf('chrome-extension://') === 0 ||
      filename.indexOf('moz-extension://') === 0 ||
      message.indexOf('Cannot set property fetch of #<Window>') !== -1
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  }, true);
})();
`;

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{__html: EXTENSION_GUARD_SCRIPT}} />
      </head>
      <body
        suppressHydrationWarning
        className="bg-zinc-950 text-zinc-100 antialiased selection:bg-amber-500 selection:text-zinc-950 overflow-hidden select-none"
      >
        {children}
      </body>
    </html>
  );
}
