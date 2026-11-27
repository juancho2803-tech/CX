# Guardar los datos del tablero en Google Sheets

El tablero guarda las bases que subís de Postventa (encuestas, detalle de tipologías y pasos por taller) y de Ventas (control de encuestas, motivos de reclamos y circuito 0km) en una hoja de Google Sheets a través de un Apps Script. Al abrir el tablero, los datos se cargan solos desde esa hoja: no hace falta volver a subir los reportes.

Se guardan solo los campos que usa el tablero. No se guardan DNI, teléfonos ni correos.

## Instalación (una sola vez, unos 5 minutos)

1. **Crear la hoja.** En Google Drive: Nuevo → Hojas de cálculo de Google. Ponele un nombre, por ejemplo "Tablero CX - datos".
2. **Abrir el editor de scripts.** En la hoja: Extensiones → Apps Script. Borrá el contenido de `Código.gs` y pegá el de [`Code.gs`](Code.gs). Guardá (ícono del disquete).
3. **Elegir la clave.** En `Code.gs`, dentro de `configurarClave()`, reemplazá `CAMBIAR-POR-UNA-CLAVE-LARGA` por una clave larga (por ejemplo 20 letras y números al azar). Guardá.
4. **Guardar la clave.** Arriba, elegí la función `configurarClave` y tocá **Ejecutar**. La primera vez Google pide permisos: Revisar permisos → elegí tu cuenta → Configuración avanzada → Ir a (nombre del proyecto) → Permitir.
   Después podés volver a dejar el texto de ejemplo en `configurarClave()`: la clave ya quedó guardada en las propiedades del script.
5. **Publicar la aplicación web.** Implementar → Nueva implementación → ícono de engranaje → **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Tocá Implementar y copiá la **URL de la aplicación web** (termina en `/exec`).
6. **Conectar el tablero.** En el tablero, debajo de "Cargar reportes": ☁️ **Conectar** → pegá la URL y la clave → **Probar y conectar**.
   Si el tablero ya tenía datos, se guardan en la hoja; si no, se cargan los de la hoja.

Cada persona que use el tablero tiene que hacer el paso 6 una vez en su navegador, con la misma URL y clave.

## Uso diario

- **Subir reportes:** se suman a lo guardado y la hoja se actualiza sola. Si una orden ya estaba, queda la versión nueva (por ejemplo, una encuesta que pasó de pendiente a completada, o una orden recodificada por el analista).
- **Recargar:** vuelve a leer la hoja (por ejemplo, si otra persona subió reportes).
- **Guardar ahora:** vuelve a guardar todo lo que está en pantalla.

## Seguridad

- **La clave protege los datos.** "Cualquier usuario" significa que la URL responde a quien la tenga, pero sin la clave correcta no devuelve ni escribe nada. No compartas la URL junto con la clave por canales abiertos.
- **El repositorio no guarda nada sensible.** La URL y la clave no van al repositorio (es público): quedan guardadas solo en el navegador de cada usuario.
- **Para cambiar la clave:** volvé a ejecutar `configurarClave()` con la nueva y actualizala en el tablero (☁️ ⚙️).
- **Para cortar el acceso:** en Apps Script, Implementar → Administrar implementaciones → Archivar.

## Cómo queda la hoja

| Pestaña | Contenido |
| --- | --- |
| Info | Cantidad de filas y fecha del último guardado de cada base |
| Encuestas | Una fila por encuesta |
| Tipologias | Una fila por tipología cargada por el analista |
| Pasos | Una fila por orden de taller (las tareas van separadas por " \| ") |
| Encuestas Ventas · Tipologias Ventas | Lo mismo para el área de Ventas |
| Circuito Ventas | Una fila por unidad del Circuito Integral 0km (fechas de cada paso; sin DNI, domicilio, teléfonos ni email) |

Las celdas se guardan como texto, para que Sheets no cambie números de orden, patentes ni rangos como "0 - 6".

No edites a mano las pestañas de datos: el próximo guardado las reemplaza.

## Actualización: área de Ventas

Si ya tenías el script instalado, reemplazá el código por el nuevo `Code.gs` y publicá una versión nueva (paso de abajo): agrega las pestañas "Encuestas Ventas", "Tipologias Ventas" y "Circuito Ventas". Hasta que lo hagas, Ventas no se guarda en la hoja.

## Si cambiás el código del script

Implementar → Administrar implementaciones → editar (lápiz) → Versión: **Nueva versión** → Implementar. Así la URL sigue siendo la misma.

## Hoja en uso

El tablero ya trae la URL de la aplicación web de la hoja actual (`SHEETS_URL_BASE` en `js/sheets.js`): al tocar ☁️ Conectar solo hay que escribir la clave. Si se crea otra hoja o una implementación nueva (no una versión nueva de la misma), hay que cambiar esa URL o pegarla en Conectar.
