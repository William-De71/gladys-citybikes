# CityBikes

## Presentación

Esta integración lleva a Gladys las **estaciones de bicicletas compartidas** de tu ciudad: las **bicis disponibles**, las **eléctricas**, las **mecánicas** y los **anclajes libres** de las estaciones que sigues, para más de 800 redes en el mundo — Bicing en Barcelona, BiciMAD en Madrid, Valenbisi en Valencia, Vélib' en París, las redes nextbike, Santander Cycles en Londres… Cada estación se convierte en un dispositivo que puedes mostrar en un panel y usar en escenas: recibe un aviso cuando vuelve una bici a la estación bajo tu ventana, o encuentra el anclaje libre más cercano antes de salir del trabajo.

Los datos proceden de la **API de CityBikes** (https://citybik.es), un proyecto gratuito que reúne los datos de los operadores: sin cuenta ni clave. Toda la red se lee en una sola petición cada 2 minutos por defecto, sea cual sea el número de estaciones seguidas. Las condiciones de la API piden citarla: los widgets muestran «Datos: CityBikes (citybik.es)».

Es una integración **cloud**: contacta con `api.citybik.es`. La ubicación de tu casa solo se usa dentro de la integración, para encontrar la red y las estaciones más cercanas: nunca se envía a CityBikes.

## Requisitos previos

- Gladys Assistant 5.3.0 o posterior.
- Para las estaciones cerca de la casa: una ubicación para la casa (Ajustes → Casas) y el permiso de ubicación aceptado al instalar la integración. Sin él, escribe la red y las estaciones.

## Configuración

| Campo                       | Qué escribir                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Red                         | El identificador CityBikes de la red («bicing», «velib»), su nombre o su ciudad. Vacío: la red más cercana a la casa.                        |
| Casa                        | La casa desde la que se buscan la red y las estaciones más cercanas. Vacío: la primera casa con ubicación.                                   |
| Estaciones seguidas         | Hasta 20, separadas por comas: sus identificadores («22002») o nombres exactos. El botón **Buscar una estación** da los identificadores.     |
| Estaciones cerca de la casa | Ninguna, o las 1, 2, 3 (por defecto) o 5 estaciones más cercanas, seguidas sin escribirlas.                                                  |
| Lectura de las estaciones   | Cada 1, 2 (por defecto), 5 o 10 minutos. Una petición por lectura; la API permite 300 por hora.                                              |
| Idioma de los textos        | Nombres de las funciones, resúmenes y salidas de las escenas. Automático: el idioma de tu panel en cuanto se muestre un widget de CityBikes. |

Los botones bajo el formulario:

- **Probar la conexión**: vuelve a leer la lista de redes, luego tu red y tus estaciones, y muestra lo encontrado.
- **Buscar una red**: escribe una ciudad, una red o un operador («Barcelona», «Madrid», «nextbike»); vacío, lista las redes más cercanas a la casa. Copia el identificador en el campo **Red**.
- **Buscar una estación**: escribe palabras del nombre o de la dirección («Catalunya»); da el identificador de cada estación con sus bicis en este momento. Copia los identificadores en **Estaciones seguidas**.
- **Diagnóstico**: escribe en la pestaña Registros la red, las estaciones, la última lectura, el último error y la cuota restante, para un informe.

## Uso

### Dispositivos

Tras guardar, abre la pestaña **Descubrir** de la integración y crea las estaciones que quieras. Cada una se llama «Estación (Red)» y contiene, cuando el operador los da:

- **Bicicletas disponibles**: todo tipo de bicis;
- **Bicicletas eléctricas disponibles** y **Bicicletas mecánicas disponibles** (Bicing, Vélib', Vélo'v…);
- **Anclajes libres**: para devolver una bici (falta en algunas redes sin estación).

Los valores siguen las lecturas de la integración; Gladys guarda su historial.

### Widgets del panel

- **Estaciones de bicis**: las estaciones que añadiste (o las elegidas en sus ajustes); una estación en tres mosaicos, varias en lista con una insignia de color de las bicis que quedan.
- **Bicis cerca de casa**: las 1 a 8 estaciones más cercanas a la casa, con su distancia, opcionalmente solo las que tienen una bici, una eléctrica o un anclaje libre.

![El widget Estaciones de bicis con cuatro estaciones de Vélib', luego con una, y el widget Bicis cerca de casa (ilustración generada, no es una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-citybikes/main/docs/assets/widgets.es.png)

### Escenas

Disparadores, para una estación o cualquier estación seguida: **vuelve a haber bicis**, **estación vacía**, **vuelve a haber eléctricas**, **no quedan eléctricas**, **vuelve a haber anclajes**, **estación llena**. Sus variables dan la estación, la red, las bicis, eléctricas, mecánicas y anclajes libres (-1 cuando el operador no los cuenta).

Acciones: **leer una estación** (sus contadores y una frase lista para un mensaje) y **encontrar la estación más cercana** con una bici, una eléctrica o un anclaje libre, desde la casa o desde una estación seguida (nombre, distancia en metros, contadores, frase).

Ejemplos:

- Cuando «Estación vacía» se dispara para la estación bajo tu ventana, entre semana entre las 7:00 y las 8:30 → enviar «No quedan bicis abajo, prueba la de la plaza» a tu móvil.
- Cuando «Vuelve a haber eléctricas» se dispara → anunciarlo en el altavoz de la entrada.
- A las 18:00 → «encontrar la estación más cercana» con anclaje libre desde la estación de tu oficina → enviar su resumen.

### Transporte

Solo cloud: el catálogo muestra la insignia cloud, no hay conexión local. La integración pide a `api.citybik.es` la lista de redes una vez por semana y tu red en cada lectura. Las coordenadas de la casa nunca salen de Gladys y de la integración.

## Solución de problemas

- **«CityBikes no conoce ninguna red …»**: usa **Buscar una red** y copia el identificador exacto («bicing», no «Bicing Barcelona»).
- **Una estación sale como «No encontrado»**: su nombre es ambiguo o se escribe de otra forma; usa **Buscar una estación** y escribe su identificador.
- **«Cuota horaria de la API de CityBikes alcanzada»**: la API permite 300 peticiones por hora y por dirección, compartidas con todo lo demás de tu conexión; elige una lectura más espaciada. Las lecturas se reanudan solas.
- **Ningún dispositivo en Descubrir**: no se encontró ninguna red o estación; mira el estado de la integración y pulsa **Probar la conexión**.
- **Los contadores parecen antiguos**: algunos operadores solo actualizan sus datos cada pocos minutos; los widgets muestran la hora de la última lectura.
- Para un informe, pulsa **Diagnóstico** y adjunta las líneas «CityBikes diagnostic» de la pestaña Registros, con las versiones de Gladys y de la integración.
