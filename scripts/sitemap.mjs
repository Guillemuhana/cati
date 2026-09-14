// ------------------------------------------------------------
// Genera el sitemap y el robots.txt en cada build.
//
// A mano se desactualiza: se agrega un oficio, nadie se acuerda de
// tocar el XML, y esa página queda invisible para Google aunque exista.
// Escrito acá, sale de la misma lista que dibuja las páginas, así que
// no pueden diferir.
//
// Corre después de `vite build`, sobre dist/.
// ------------------------------------------------------------

import { writeFileSync, readFileSync } from 'node:fs'
import { PAGINAS, SITIO } from '../src/lib/landings.js'

const hoy = new Date().toISOString().slice(0, 10)

// Solo lo que queremos en Google. El resto de la app es privado y ya
// está bloqueado en robots.txt; repetirlo acá sería pedirle que indexe
// lo que le estamos negando por el otro lado.
const publicas = [
  { url: `${SITIO}/`, prioridad: '1.0', frecuencia: 'weekly' },
  { url: `${SITIO}/registro`, prioridad: '0.6', frecuencia: 'monthly' },
  ...PAGINAS.map((p) => ({ url: p.url, prioridad: '0.8', frecuencia: 'monthly' }))
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicas
  .map(
    (p) => `  <url>
    <loc>${p.url}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>${p.frecuencia}</changefreq>
    <priority>${p.prioridad}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`

writeFileSync('dist/sitemap.xml', xml, 'utf8')

// El robots.txt vive en public/ y lo copia Vite. Se le agrega la línea
// del sitemap acá para no tener que acordarse del dominio en dos
// lugares.
const robots = readFileSync('dist/robots.txt', 'utf8')
const sinSitemap = robots.replace(/\n*Sitemap: .*$/gm, '').trimEnd()
writeFileSync('dist/robots.txt', `${sinSitemap}\n\nSitemap: ${SITIO}/sitemap.xml\n`, 'utf8')

console.log(`sitemap.xml: ${publicas.length} direcciones (${PAGINAS.length} oficios)`)
