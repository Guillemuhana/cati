# Cómo agregar una plantilla de hoja

Una plantilla es el papel en el que salen el presupuesto, la factura y el
recibo: una imagen de fondo y un color de títulos. Son tres pasos.

## 1. Preparar la imagen

**Medida:** proporción A4 vertical, 1 a 1,414. Lo cómodo es diseñar a
**1054 × 1492 px**, que es lo que mide la de gasista. Más grande no se
nota en el papel y engorda cada PDF.

**Dónde poner las cosas:** el texto del presupuesto ocupa la hoja entera,
de arriba abajo. Lo único que queda razonablemente libre es el borde. Las
plantillas funcionan cuando el dibujo vive en los **3 cm de abajo** y en
los costados, y el centro queda vacío.

Zonas ocupadas por el contenido, para no pelearse con ellas:

- **Arriba (primeros 4 cm):** el recuadro del encabezado, con el logo, los
  datos del negocio y el número. Es lo más cargado de la hoja.
- **Centro:** la tabla de ítems. Nunca poner nada con detalle acá.
- **Abajo a la derecha:** la caja de totales y la de pagos.
- **Pie (últimos 2 cm):** el renglón de la firma y la leyenda del pie.

**Aguarla.** La imagen tiene que ir tenue o compite con los números. No se
le baja la opacidad al dibujarla —no todos los visores de PDF la respetan
igual— sino que se guarda ya mezclada con blanco:

```bash
python -c "
from PIL import Image
im = Image.open('original.png').convert('RGB')
blanco = Image.new('RGB', im.size, (255,255,255))
Image.blend(blanco, im, 0.18).save('public/plantillas/NOMBRE.jpg', quality=85, optimize=True)
"
```

**La fuerza no es siempre la misma.** Una foto de máscaras de soldar
negras y una de latas de pintura blancas, aguadas al mismo número, no
quedan igual: la primera sale oscura y la segunda desaparece. El número
se calcula por imagen, para que a todas les quede el mismo gris más
oscuro (224 sobre 255, que es el de la de gasista):

```bash
python -c "
from PIL import Image
h = Image.open('original.png').convert('L').histogram()
total, acum, p1 = sum(h), 0, 0
for v, c in enumerate(h):
    acum += c
    if acum >= total * 0.01: p1 = v; break
print('alpha:', round((255 - 224) / max(255 - p1, 1), 3))
"
```

Los que salieron hasta ahora van de 0.125 a 0.191: las fotos con objetos
negros (automotor, herrero, fotografía) piden menos, las claras
(gastronomía, pintor) piden más.

Si te pasás de 100 KB, revisá el `quality` antes de subirla.

Guardala como **.jpg** (no PNG: el fondo es opaco y pesa la mitad).

## 2. Anotarla en el catálogo

En `src/lib/plantillas.js`, agregá una entrada:

```js
{
  key: 'electricista',            // NUNCA se cambia: queda guardada en los perfiles
  label: 'Electricidad',
  descripcion: 'Lo que se ve al pasar el mouse por la miniatura.',
  rubros: ['oficios'],            // solo decide el orden en el selector
  fondo: '/plantillas/electricista.jpg',
  color: '#1B3B6F'                // el color de títulos que propone
}
```

`rubros` **no** limita quién la puede usar: todas se muestran a todos, las
del rubro propio primero. Es orden, no permiso.

El `color` es una propuesta: al elegir la plantilla se escribe en el color
de marca del perfil, donde el usuario lo puede cambiar. El PDF siempre
dibuja con el color del perfil, nunca con este.

## 3. Mirarla impresa

Generá un presupuesto de prueba con esa plantilla y abrí el PDF. Las dos
cosas que salen mal siempre:

- Algo del dibujo tapando la tabla de ítems o la caja de totales.
- La imagen demasiado fuerte: si tenés que forzar la vista para leer un
  número, bajá el `0.18`.

Acordate de que el fondo se repite en **todas** las hojas, no solo en la
primera. Probá con un presupuesto de treinta ítems, no con uno de dos.
