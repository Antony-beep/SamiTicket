---
name: SamiTicket
description: "Una invitación nocturna al encuentro: carbón, tiza y coral."
colors:
  primary: "#ff895f"
  primary-foreground: "#21130e"
  background: "#121313"
  foreground: "#f3f0e9"
  card: "#1a1b1b"
  popover: "#202121"
  secondary: "#272828"
  muted: "#242626"
  muted-foreground: "#aeadab"
  accent: "#32302d"
  destructive: "#ff9a9a"
  border: "#353636"
  surface-input: "#151616"
  gold: "#e8c691"
  neon-red: "#ff455f"
  neon-lime: "#ceff70"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(3rem, 7.1vw, 6rem)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-.04em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(1.65rem, 3vw, 2.5rem)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-.035em"
  card-title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: ".8rem"
    fontWeight: 500
    lineHeight: 1.6
  action:
    fontFamily: "Inter, sans-serif"
    fontSize: ".875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  md: "8px"
  lg: "12px"
  halo-control: "11px"
  cutout-media: "14px"
  halo-panel: "16px"
  pill: "9999px"
spacing:
  8: "8px"
  12: "12px"
  16: "16px"
  20: "20px"
  24: "24px"
  28: "28px"
  32: "32px"
  40: "40px"
  44: "44px"
  64: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.action}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  button-outline:
    textColor: "{colors.foreground}"
    typography: "{typography.action}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  input:
    textColor: "{colors.foreground}"
    rounded: "{rounded.halo-control}"
    padding: "8px 12px"
    height: "48px"
  navigation:
    textColor: "{colors.foreground}"
    typography: "{typography.action}"
  category-badge:
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
    height: "28px"
  catalog-card:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.halo-panel}"
  halo-card:
    textColor: "{colors.foreground}"
    rounded: "{rounded.halo-panel}"
    padding: "24px"
  cutout-label:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    rounded: "{rounded.halo-panel}"
    padding: "12px 18px 4px 0"
---

# Design System: SamiTicket

## Overview

**Creative North Star: "Una invitación nocturna al encuentro"**

SamiTicket usa una interfaz nocturna, elegante y contenida. El carbón cálido sostiene texto tiza y acentos coral; la energía de fiesta aparece en las portadas de los organizadores, el ritmo de los títulos y los detalles de acción. La identidad conserva el vínculo con Huancayo y las celebraciones peruanas.

Los controles mantienen la lectura sobria y accesible. La ampliación Cult UI confirmada añade luz localizada: letrero rojo, bordes Halo, selección con gradiente y avisos continuos. El confeti breve celebra únicamente la creación guardada de un evento. La composición específica de cada página permanece en su contrato de superficie.

**Key Characteristics:**

- Fondo nocturno continuo y capas tonales discretas.
- Coral para acciones, fechas y detalles de identidad.
- Manrope en títulos e Inter en lectura y controles.
- Portadas reales con información de evento siempre visible.
- Luz y respuesta de color en componentes seleccionados, sobre la base nocturna.
- Movimiento que se suspende fuera de pantalla, con pestaña oculta o por preferencia reducida.

## Colors

El coral activa una base de carbón y tiza. El rojo y la lima neón identifican la ampliación interactiva; los colores semánticos conservan sus funciones.

### Primary

- **Coral de encuentro** (`primary`): acciones principales, fechas, enlaces destacados, selección y foco.
- **Tinta sobre coral** (`primary-foreground`): texto oscuro sobre acciones coral.

### Secondary

- **Rojo de pista** (`neon-red`): borde de acción al hover, selección con gradiente y luz del letrero inspirado en Danger Zone.
- **Lima de celebración** (`neon-lime`): respuesta al pulsar, confirmaciones y detalles del letrero y del confeti.

### Neutral

- **Carbón nocturno** (`background`): lienzo continuo y bloque de información del catálogo.
- **Tiza cálida** (`foreground`): lectura principal y títulos.
- **Carbón de tarjeta** (`card`): formularios y compra.
- **Carbón elevado** (`popover`): capa semántica del tema.
- **Carbón secundario** (`secondary`): precio, acciones secundarias y fondos de espera.
- **Carbón tenue** (`muted`) y **carbón de interacción** (`accent`): estados de controles.
- **Tiza tenue** (`muted-foreground`): información secundaria, ayudas y metadatos.
- **Línea carbón** (`border`): separación de secciones y perímetro de controles.
- **Carbón de campo** (`surface-input`): interior de campos.

El rosa de error (`destructive`) y el ámbar de aviso (`gold`) son semánticos, no nuevos acentos decorativos. Las portadas pueden aportar sus propios colores.

Los gradientes multicolor de Halo pertenecen al borde y a la luz difusa de esos componentes. Sus colores internos no amplían la paleta general de superficies ni sustituyen los colores semánticos.

**The Coral de acción Rule.** Usa el coral del tema para acciones y énfasis puntuales; conserva las superficies estructurales en carbón.

## Typography

**Display Font:** Manrope, con respaldo sans-serif.
**Body Font:** Inter, con respaldo sans-serif.

Las dos familias se sirven mediante `next/font` desde el layout. Los títulos tienen peso medio, espaciado cerrado y saltos equilibrados; el cuerpo prioriza lectura y escaneo. La marca combina pesos de Manrope dentro de una sola línea.

### Hierarchy

- **Display** (`display`): invitación principal del catálogo. En móvil pasa a `clamp(2.65rem, 9.5vw, 4.3rem)`.
- **Headline** (`headline`): título principal compartido, incluido detalle de evento; en detalle móvil se fija en (2.5rem).
- **Title** (`title`): encabezados de sección.
- **Card title** (`card-title`): nombre enlazado del evento.
- **Body** (`body`): lectura general; los párrafos tienen un máximo compartido de (72ch). La introducción del catálogo usa (1rem).
- **Label** (`label`): etiquetas de formulario. Las ayudas y metadatos se mueven entre (.75rem) y (.875rem).
- **Action** (`action`): botones y navegación.

Los importes usan cifras tabulares. No hay familia monoespaciada de identidad; el token técnico de una entrada conserva monospace por su función.

**The Dos voces Rule.** Mantén Manrope para títulos e Inter para lectura y controles; utiliza la escala y el espacio para establecer jerarquía.

## Layout

El contenedor compartido centra el contenido con un máximo de (1200px). Sus márgenes laterales son (48px), bajan a (32px) hasta (1000px) y a (20px) hasta (760px). La separación usa con frecuencia pasos de ocho píxeles y valores intermedios de veinte y veintiocho; los tokens reflejan ese ritmo real.

El catálogo observado usa tres columnas con separación de (28px), dos hasta (1000px) y una hasta (600px). Las portadas Cutout se recortan a proporción (4:5). Las secciones principales usan espacios verticales de (40px) a (64px).

El detalle observado divide afiche y compra en columnas `minmax(0, 1.4fr) minmax(320px, .8fr)`, separadas por (64px). Hasta (1000px) reduce la separación a (32px); hasta (760px) pasa a una columna. El afiche del detalle conserva su imagen completa mediante ancho total y altura automática.

La compra queda adherida a (24px) del borde superior en escritorio. En móvil vuelve al flujo y aparece un enlace fijo inferior hacia la sección de entradas. El enlace incluye el precio, respeta el área segura del dispositivo y la página reserva espacio inferior para no tapar contenido. Los formularios compartidos también pasan a una columna hasta (760px).

## Elevation & Depth

El catálogo es plano: Cutout usa el recorte de su etiqueta y la portada, sin adoptar la sombra opcional del registro Cult UI. Los paneles de compra, formularios y navegación se separan mediante fondos y líneas. Halo incorpora un borde luminoso, fondo translúcido y sombra suave en campos, carga de portada, selección y paneles elegidos. Dynamic Island tiene sombra propia para distinguir un aviso flotante del contenido.

**The Profundidad por tono Rule.** Distingue las superficies estructurales mediante carbón, bordes y espacio; reserva el brillo y la elevación de Cult UI para sus componentes seleccionados.

## Shapes

Los botones conservan curvas discretas (`rounded.md`) y los paneles existentes curvas amplias (`rounded.lg`). Halo usa un control interior de `rounded.halo-control` y paneles de `rounded.halo-panel`; Cutout comparte esa curva exterior y una portada de `rounded.cutout-media`. Su etiqueta nace del borde inferior izquierdo con esquinas inversas. Las categorías outline del detalle conservan la cápsula (`rounded.pill`). Los controles y paneles recurren a un borde fino de (1px). El afiche de detalle conserva su formato completo.

## Components

### Buttons

Acciones claras y de peso medio. La base shadcn usa Base UI; los estilos compartidos establecen la altura mínima y el espacio recogidos en los tokens de componente. La cabecera móvil conserva ese mínimo y reduce el relleno a (8px 12px).

- **Primary:** coral con tinta oscura.
- **Outline:** borde del tema, texto tiza y fondo de borde al (30%) en modo oscuro.
- **Secondary:** carbón secundario.
- **Ghost:** fondo transparente.
- **Destructive:** texto de error y fondo de error al (20%) en modo oscuro.
- **Link:** texto coral, con subrayado al pasar el puntero.
- **Hover:** las acciones compartidas pasan a carbón rojizo con borde rojo neón, texto claro y una sombra corta durante (.22s).
- **Active / Focus:** al pulsar, el fondo pasa a carbón violeta, el borde a lima y el botón baja (1px). El foco shadcn conserva borde y anillo coral. Deshabilitado reduce opacidad al (50%) y bloquea la interacción.

Los enlaces que actúan como acciones reutilizan las mismas variantes y respuesta de color.

### Chips

Las categorías siguen siendo informativas. En Cutout se integran en el recorte inferior de la portada, sobre fondo de página y con texto coral; el detalle conserva la variante outline en cápsula. El filtro de disponibilidad es un control distinto y tiene comportamiento real.

### Cards / Containers

Los paneles compartidos usan fondo de tarjeta, borde discreto, curvas amplias y relleno habitual de (24px). HaloCard añade un borde difuso y translúcido en acceso y clima; el borde se enfatiza con hover o foco dentro. El acceso usa (32px) de relleno y (24px) en móvil. La tarjeta Cutout deja el fondo transparente y reúne portada, fecha, nombre, lugar, importe y disponibilidad. La información esencial permanece visible sin hover.

### Inputs / Fields

Input y Textarea compartidos reutilizan Halo. El borde luminoso rodea una superficie translúcida de carbón; la fila interior dispone icono, campo y ayuda sin superponerlos. La geometría de la fila está recogida en `input`; el texto pasa de (1rem) a (.875rem) desde el breakpoint de (768px). Las etiquetas están separadas del placeholder.

El foco se dibuja en el contenedor mediante borde y anillo coral de (2px), evitando anillos duplicados en el campo transparente. Los errores utilizan `aria-invalid`, borde rosa y texto de ayuda visible. Los controles deshabilitados reducen opacidad. El textarea permite redimensionado vertical y conserva altura interior mínima de (96px).

HaloDropzone ofrece elegir o arrastrar una única portada JPEG, PNG o WebP. La selección aceptada conserva la vista previa e indica que se guardará con el evento; el éxito del selector no afirma una subida terminada. Errores y ayudas se relacionan con el campo y el foco de teclado rodea la zona completa. HaloSegmented representa la elección real de espacio cerrado o al aire libre con botones de altura mínima de (44px), estado pulsado y selección única.

### Navigation

Una cabecera horizontal con marca a la izquierda y enlaces y sesión a la derecha. Su altura mínima es de (96px), baja a (80px) hasta (760px) y admite saltos de línea. Los enlaces pasan a coral en hover; el enlace de cartelera se oculta en móvil. Un enlace de salto aparece al recibir foco de teclado. La navegación no usa un fondo independiente ni sombra.

### Cutout Card de eventos

El catálogo y el panel usan el mismo recorte de etiqueta, portada vertical y datos siempre visibles. Al pasar el puntero la portada crece a (1.05) durante (.7s), con `cubic-bezier(.23,1,.32,1)`; no se desplaza el bloque de información. El movimiento reducido elimina esa escala.

### LightBoard y Gradient Button Group

El letrero debajo del hero muestra música, fiestas y tradición en luz roja sobre carbón. Tiene botón de pausa de (44px), texto equivalente para lector de pantalla y alternativa estática cuando está pausado o se solicita movimiento reducido. Solo se anima visible y con la pestaña activa.

El grupo de gradiente filtra de verdad la disponibilidad: Todos, Disponibles y Agotados. Su selección usa `aria-pressed`, anillo rojo/lima giratorio y foco coral. La transición entre selecciones dura (.24s); el giro dura (5s). Ambos se detienen con movimiento reducido, fuera de pantalla o con la pestaña oculta.

### Carga, avisos y celebración

HaloProgress usa carga indeterminada cuando se desconoce el avance: rutas, guardado, clima y solicitudes compartidas. El indicador superior cuenta solicitudes concurrentes y permanece mientras haya alguna pendiente; no muestra porcentajes inventados. Con movimiento reducido queda una señal estática y conserva su nombre accesible.

Dynamic Island muestra avisos reales con título, explicación y botón de cierre de (44px). Los errores usan `role="alert"` y persisten hasta cerrarse; los demás avisos usan `role="status"` y se retiran a los (6.5s). Los errores de campo siguen junto al formulario.

El confeti aparece una sola vez tras crear correctamente un evento y llegar a su panel correspondiente: (44) piezas durante (2.1s), con retardos breves. No celebra una edición ni un fallo. Es decorativo, no intercepta clics, desaparece si se oculta la pestaña y se omite con movimiento reducido; el aviso permanece disponible.

### Clima con SVG

El pronóstico disponible se presenta en HaloCard con un SVG decorativo acorde con el código y la condición diarios. La condición de la hora de inicio se indica por separado. El icono deriva suavemente durante (4s), dos veces; se pausa fuera de pantalla o con pestaña oculta y queda estático con movimiento reducido. Una fecha fuera del rango informa la limitación y la indisponibilidad permite reintentar sin impedir continuar.

## Do's and Don'ts

### Do:

- **Do** usa los tokens de carbón, tiza y coral en las superficies compartidas.
- **Do** conserva Manrope en títulos e Inter en lectura y controles.
- **Do** muestra las portadas aportadas por organizadores y conserva el afiche completo en detalle.
- **Do** mantén fecha, lugar, precio y disponibilidad visibles sin hover.
- **Do** conserva etiquetas, errores, foco visible y la preferencia de movimiento reducido.
- **Do** reserva espacio para la compra fija móvil y su área segura.
- **Do** limita el neón y los gradientes a los componentes Cult UI seleccionados y sus estados.
- **Do** muestra progreso indeterminado, avisos reales y celebración solo después del éxito confirmado.

### Don't:

- **Don't** extiendas los gradientes internos de Halo a todas las superficies nocturnas.
- **Don't** heredes las sombras de la base Cult UI en las tarjetas del catálogo.
- **Don't** conviertas las categorías informativas en controles sin implementar su comportamiento.
- **Don't** sustituyas datos reales o estados vacíos por eventos ficticios comprables.

Extracción: `src/app/globals.css`, layout y superficies de catálogo y detalle; `event-card`, `event-catalog`, `live-subtitles`, `event-arrival`, `app-feedback`, `cover-input`, `weather-panel`, `weather-icon`; `lib/feedback`, `lib/client-api` y los primitivos de `src/components/ui/`. La procedencia de la identidad es PRODUCT.md y el contrato de catálogo y detalle, incluida la ampliación Cult UI confirmada. La extracción de esta ampliación procede del código; no afirma verificación visual, cobros reales ni validación offline.

No canonizado: la sombra opcional del registro Cutout no se aplica al catálogo. Los valores heredados no utilizados y las variaciones ajenas a la ampliación autorizada, incluidas las advertencias previas del detector, no se elevan a reglas ni se corrigen en esta actualización.

