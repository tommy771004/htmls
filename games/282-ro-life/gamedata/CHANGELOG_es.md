# Changelog

Lo que va cambiando en RO Life. Los jugadores lo ven en el juego (botón «Novedades» de la portada, una pestaña
por publicación), así que solo van cosas del juego en sí (clases, skills, stages, jefes, equipo, equilibrio, sistemas,
arreglos) contadas para quien juega; nada de cambios internos ni de la web. La versión en inglés está en
CHANGELOG.en.md (mismas secciones).

Cómo se usa:
- «Sin publicar» es el borrador del próximo bloque: ahí se apunta según se va haciendo y los jugadores no lo ven.
- «Para el siguiente push» guarda lo que ya está hecho pero apagado en producción hasta el push de después
  (game/src/nextrelease.ts); tampoco se ve. Al encenderlo, sus líneas pasan a «Sin publicar».
- Al subir el bloque a live, esa sección se renombra a su versión y fecha (`## Beta 0.2 — 20 de noviembre de 2026`; la 1.0 queda para cuando salga de beta), se
  abre otra «Sin publicar» vacía encima y en el juego sale la pestaña nueva con el aviso de novedades.
- Dentro de cada versión: `### Nuevo`, `### Clases`, `### Equilibrio`, `### Mejoras`, `### Arreglos` (los que hagan
- [Arreglo] Merchant: Zeny Rain ya no gasta una carga de Crazy Uproar (no le daba un enemigo más: es una zona). La carga queda para la siguiente skill que sí la aprovecha.
  falta). Una línea suelta bajo el título de la versión sale como entradilla.
- Desde la Beta 0.2 los apartados van por tema (Stages, Jefes, Equipo y cartas...) y cada punto empieza con su
  etiqueta: `[Nuevo]`, `[Cambio]`, `[Mejora]` o `[Arreglo]` (en inglés `[New]`, `[Change]`, `[Improvement]`, `[Fix]`);
  en el juego sale como una chapita de color.

## Beta 0.6.1 — 11 de noviembre de 2026

Arreglado lo que dejaba la plaza a medias después de actualizar.

### Prontera
- [Arreglo] Después de una actualización, a algunos jugadores les faltaban NPC en la plaza (el Guardián de la Torre) y no respondían algunos clics, como el de abrir la ficha del personaje, hasta pasadas unas horas. Ahora el juego pide siempre la lista de sprites de su versión, y si falta uno, los demás NPC salen igual.

## Beta 0.6 — 11 de noviembre de 2026

La plaza se reparte en varios lobbies con nombre propio, llega el Cartero con el correo del juego, velocidad x2 y x4 en los pisos de la torre ya superados, historias que se pueden saltar y muchos arreglos.

### Prontera
- [Nuevo] Lobbies: la plaza se reparte en varios mundos con nombre propio (Asgard, Midgard, Alfheim, Vanaheim), cada uno con sus canales, su chat y sus grupos. Al entrar en Prontera eliges uno: la lista dice si va normal, concurrido o lleno, y marca el de la última vez. Al volver de una partida sigues en el mismo. Puedes cambiar desde el cartel de arriba (encima de los canales). Tus amigos salen estén en el lobby que estén, y los susurros y las peticiones de amistad llegan igual. La Endless Tower es la misma para todos. Si todos están llenos, juegas sin conexión y el juego vuelve a mirar cada minuto. Puedes invitar al grupo a un amigo que está en otro lobby (botón «Invitar» en tu lista de amigos): si acepta, se cambia a tu lobby, y al salir del grupo el juego le ofrece volver al suyo.
- [Nuevo] El Cartero, en la plaza junto a la fuente (al sureste, frente al Bibliotecario): el correo del juego. Ahí llegan los avisos y regalos del equipo y lo que recuperemos de tu cuenta; lo que viene adjunto se recoge con «Recoger». Cuando tienes carta nueva lleva una «!». Solo con cuenta.
- [Mejora] Vendedor de minerales: botones para marcar de golpe todo el equipo de una calidad (Común, Poco común, Raro, Épico o Legendario), dentro del filtro de tipo que tengas puesto; lo que lleva puesto algún personaje no se marca. Si vuelves a pulsar, se desmarca. «Desmarcar todo» quita todas las marcas, y si la venta incluye piezas épicas o legendarias, la confirmación lo avisa.
- [Mejora] Inventario: botón «Proteger» en el detalle de cada pieza. Las protegidas llevan un candado, no se pueden tirar y el vendedor de minerales no las compra: no se marcan al pulsar una calidad ni una a una. «Quitar protección» lo deshace. Si la das en un trade, al otro le llega sin proteger.

### Interfaz y textos
- [Mejora] Portada: con la sesión de tu cuenta guardada ya no sale la pestaña «Entrar» (se juega desde la primera, la de tu cuenta). Debajo de «¡Jugar!» hay un botón «Salir» que cierra la sesión y vuelve a Invitado, Entrar y Crear cuenta.
- [Mejora] Inventario (en ordenador): al pasar el ratón por un objeto, una carta o un material sale su ficha con las estadísticas, sin tener que hacer clic.
- [Nuevo] Bibliotecario: dos secciones nuevas. «Deity por job», con lo que hace la Deity de cada skill de cada job (y un control para verla en cada rango) y las Deity de stats. «Equipo por pieza», con todo el equipo que cae en los stages por tipo de pieza: su ★ (lo propio de la pieza) según el tier y en qué stage y de qué monstruo cae.
- [Cambio] «Borrar progreso» ya no está en la selección de personaje, junto a «Borrar»: ahora va en Opciones › Juego › Cuenta (solo al abrir las Opciones desde la selección de personaje), y para confirmarlo hay que escribir el nombre de la cuenta. Para borrar un solo personaje sigue estando «Borrar».
- [Mejora] Las piezas que no se pueden comerciar llevan la etiqueta «No comerciable» en su ficha y al pasar el ratón (inventario, equipo, vendedor, intercambio e inspeccionar): el equipo inicial y lo ligado a tu cuenta, como lo conseguido jugando de invitado.
- [Arreglo] Si la carga de la portada se queda parada (por ejemplo, después de borrar los datos del sitio en el navegador), el juego quita su copia guardada y vuelve a cargar solo, como en una visita nueva. Si aun así no carga, el botón lo dice y deja reintentar, en vez de quedarse cargando.
- [Mejora] Novedades: en pantallas grandes las versiones van en una columna a la izquierda con su propio scroll y el texto al lado, así se pasa de una a otra sin perder de vista la lista. En el móvil sigue como antes.

### En grupo
- [Nuevo] Si el líder deja la partida en grupo o se le cae la conexión, otro del grupo pasa a llevarla y la partida sigue para los demás, con los monstruos donde estaban. Antes se acababa para todos.
- [Arreglo] Cuando la partida en grupo se acaba porque se ha ido el líder, ya no se queda unos segundos con los monstruos parados, y la pantalla final dice «Partida terminada» en vez de «Has muerto».

### Historias
- [Nuevo] Si otro personaje de tu cuenta ya ha superado una historia, puedes saltarla con «Saltar historia» en el capitán de expediciones: te llevas su recompensa como si la hubieras superado (en el Barco hundido eliges el arma; en el Castillo de Prontera, tu 2nd job y la insignia), pero sin EXP. Queda superada, así que también se abre el stage que la pedía.

### Clases
- [Cambio] Acolyte: Blessing se lanza en cuanto acaba su enfriamiento, aunque no haya monstruos cerca. Es una ayuda: ya no espera a que llegue la horda.
- [Arreglo] Acolyte: el árbol de luz de Epiclesis (Deity de Aqua Benedicta) dura lo mismo de más que el charco (antes 5 s siempre, y subir la duración solo lo retrasaba), dispara un rayo más por cada objetivo extra de los talentos y aplica los efectos al golpear de las mejoras.
- [Arreglo] Acolyte: Juicio divino (Signum Crucis) usa lo de tu Holy Light: tantas columnas como objetivos tenga, su radio con el área mejorada y sus efectos al golpear, además de su daño.
- [Arreglo] Mage: Fire Bolt, Cold Bolt y Lightning Bolt ya no caen sobre los mismos monstruos: un bolt guarda sus objetivos hasta que le llega el golpe (antes los soltaba al acabar el casteo, mientras la bola aún caía). Si todo lo que tiene a su alcance ya es objetivo de otro bolt, alcanza más lejos para ir a por otros; con objetivos libres a su alcance, sigue igual.

### Endless Tower
- [Cambio] Moonlight Flower en la torre: una sola campana, al 50% de vida y con 10 segundos para ponerte debajo, sin campana sellada ni Cat O' Nine Tails. Las dos campanas largas se comían el tiempo del piso y no daba tiempo a matarla. En los stages sigue igual.
- [Nuevo] Velocidad x2 y x4 en la torre: en los pisos que ese personaje ya tiene superados, el botón de velocidad del marcador (o la tecla V) acelera la partida. Mientras va acelerada, los gráficos bajan al mínimo; al llegar a un piso que aún no has superado vuelve sola a la velocidad normal y a tus gráficos. La partida cuenta igual. En equipos justos puede que no llegue a x4.
- [Arreglo] Cortes de conexión en la torre: el servidor espera ahora 10 minutos (antes 2) a que el juego se reenganche, y lo jugado durante el corte cuenta. Si el corte dura más, la partida se acaba en ese momento con lo que llegó al servidor, en vez de seguir jugándose sin contar. El tinte Blood Savage se da con la conexión puesta.

### Jefes
- [Arreglo] Moonlight Flower: mientras se esconde durante la campana, sus venenos, sangrados y quemaduras se quedan en pausa y siguen al volver, en vez de agotarse. Y ninguna skill la toma como objetivo mientras está escondida: Shadowstep ya no te saca de la campana saltando a su sitio invisible.

### Equipo y cartas
- [Cambio] Cofres de la partida: ya no salen cartas de stats que tu personaje no usa. La rapidez de casteo solo sale si alguna de tus skills tiene casteo (el Thief y el Rogue no la ven), el Plato de STR y la Deity de la fuerza solo con daño físico, y el Plato de INT y la Deity del pensamiento solo con magia o curas.
- [Mejora] El aviso de que una pieza se puede romper al refinar enseña su icono en la casilla del color de su calidad, para ver bien qué pieza es.
- [Mejora] En el herrero se ven los huecos de carta de cada pieza (en la lista, en su ficha y en el aviso de rotura), con rombos como en la equipación: ◆ con carta y ◇ vacío. Así no rompes sin darte cuenta una pieza con cartas.

### Rendimiento
- [Mejora] Apartar a los monstruos unos de otros cuesta bastante menos cálculo: con hordas grandes, sobre todo en grupo, el juego tiene menos trabajo en cada fotograma. Se mueven igual que antes.
- [Mejora] Zeny Rain, la lluvia de flechas del Archer, Sand Attack y las columnas de luz del Acolyte (Holy Light, Juicio divino…) siguen la calidad de efectos de Opciones: en media sueltan la mitad de monedas, flechas, granos y chispas, y en baja una cuarta parte, sin estelas; en el móvil, la mitad. Golpean igual.
- [Mejora] Volver a Prontera después de una partida necesita mucha menos memoria de golpe: el mapa de la plaza ya no se vuelve a cargar entero de golpe, sino que se prepara poco a poco tras la pantalla de carga, y los demás jugadores aparecen justo después. La descarga de los mapas de tus stages mientras estás en la plaza ya no ocupa memoria del juego.

## Beta 0.5.4 — 10 de noviembre de 2026

Puntuaciones de la Endless Tower arregladas y el chino tradicional repasado.

### Idioma

- [Mejora] Chino tradicional repasado por Syuan, de la comunidad: skills y jobs con sus nombres del servidor taiwanés de RO (Soul Linker 悟靈士, Gunslinger 神槍手, Bard 吟遊詩人...) y casi todos los textos del juego y del Bibliotecario más naturales.

### Endless Tower

- [Arreglo] En las partidas que llegaban a los pisos más altos, el ladder se quedaba con más o menos la mitad de la puntuación. Ahora cuenta entera, y las partidas que se habían quedado cortas ya tienen la suya.

## Beta 0.5.3 — 9 de noviembre de 2026

Un servidor nuevo y más potente, una plaza para muchos más jugadores con cola para entrar cuando está llena, y arreglos para cuando el servidor iba saturado.

### Servidor

- [Cambio] El juego pasa a un servidor dedicado nuevo y más potente, en Alemania. Tus cuentas, personajes, equipo y progreso se pasan tal cual.

### Prontera

- [Mejora] La plaza admite ahora hasta 2.000 jugadores a la vez: abre los canales que hagan falta, hasta 80.
- [Mejora] Con la plaza llena ya no te quedas «Sin conexión»: esperas en una cola que te dice tu puesto y entras solo en cuanto hay sitio.

### Equipo y cartas

- [Arreglo] Al coger una pieza, una carta o un huevo ya no suena como una subida de nivel: tiene su propio sonido.

### Arreglos

- [Arreglo] Con el servidor saturado, si al empezar una partida el juego no conseguía apuntarla en el servidor, al terminarla podía reclamar el botín con una partida anterior de otro stage, y no entraba nada (piezas, cartas ni huevos). Ahora sigue intentando apuntarla durante más tiempo y, si la partida acaba antes, espera a tenerla para subir el botín.
- [Arreglo] Con el servidor saturado, la pieza que acababas de ganar (sobre todo la recompensa de las historias del Barco y del Castillo) podía desaparecer si le encajabas cartas antes de que el servidor recibiera la partida, y las cartas se iban con ella. Ahora la pieza se queda con sus cartas. Las recompensas que se perdieron así el 9 de noviembre ya se han devuelto.
- [Arreglo] Las fichas largas de las skills de la barra (y de los objetos y buffs de la partida) podían salir por debajo de la pantalla con la interfaz grande o en pantallas bajas, y no se podían leer. Ahora siempre caben: si no hay sitio encima, se ensanchan, se ponen al lado o se hacen un poco más pequeñas.
- [Arreglo] Hablar con el Cronista de hazañas paraba el juego unos segundos con cuentas con mucho equipo. Ahora se abre al momento.
- [Arreglo] Herrero: si el servidor tardaba en contestar un refine y cerrabas y volvías a abrir la ventana, el botón «Refinar» podía refinar otra pieza que la que tenías elegida (la primera de la lista). Ahora siempre refina la pieza que ves, no deja pedir otro refine hasta que llega la respuesta del anterior, y el aviso de riesgo dice también la calidad de la pieza.
- [Arreglo] Con el servidor saturado, el juego podía decir «Tu cuenta se ha usado en otro dispositivo» sin ser verdad (sobre todo al entrar en la plaza) y recargar con un guardado anterior, perdiendo lo último que habías hecho. Ahora, si un guardado llega al servidor pero su respuesta se pierde, el siguiente sigue con normalidad.
- [Arreglo] Con la plaza llena, el grupo se quedaba sin conexión nada más entrar en la partida, y al volver se podía quedar fuera de la plaza y del grupo. Ahora el grupo entra en la partida y vuelve a la plaza aunque esté llena, y quien juega en grupo ya no ocupa sitio en la plaza.
- [Arreglo] En las partidas en grupo, recoger muchas gemas a la vez o jugar con muchísimos monstruos en pantalla podía cortar la conexión con el grupo («Se ha perdido la conexión»). Lo que se recoge sale ahora todo junto y el servidor ya no corta por eso.
- [Arreglo] Una partida de la Endless Tower que se cortaba justo al acabar (por la conexión o con el servidor saturado) podía quedarse sin contar: ni pisos ni puntos de la torre. Ahora el juego va avisando al servidor de cómo va la partida y sigue intentando mandar el final un rato más. Las partidas del 8 y 9 de noviembre que se quedaron así recuperan los pisos que caben en el tiempo que se jugaron y sus puntos de la torre.

## Beta 0.5.2 — 9 de noviembre de 2026

El juego en chino tradicional, el chat por pestañas, una plaza más grande y ajustes en la Endless Tower.

### Endless Tower

- [Cambio] Los puntos mínimos de cada piso van ahora con lo que da el piso: el 80% de los puntos de matar sin combo a todos los monstruos que salen en su minuto. Antes subían mucho más deprisa y desde el piso 21 o el 31 pedían más de lo que se podía hacer (el 31 pedía unos 67.000; ahora unos 35.000). Además, al empezar cada bloque ya no bajan ni los monstruos que salen ni los puntos mínimos: siguen como en el piso 9 del bloque anterior y suben desde ahí.
- [Cambio] Desde el piso 31 empieza el tier 2 y se nota: los monstruos tienen el triple de vida y hacen un 15% más de daño, salen un 30% más y cada muerte vale un 5% más por cada piso que subes. Los puntos mínimos no cuentan esos monstruos y puntos de más.
- [Nuevo] Superar el piso 50 desbloquea el tinte Blood Savage para todos tus personajes. Sale como un botín antes de las cartas, con tu personaje ya teñido, y se pone en el Estilista de la plaza.

### Prontera

- [Nuevo] El chat de la plaza va por pestañas: cada canal (Canal, General, Comercio, Grupo) tiene sus propios mensajes y se escribe en la pestaña abierta. Un punto rojo avisa de mensajes nuevos en las demás; los susurros salen en todas.
- [Nuevo] Opciones › Idioma › Canales de chat: elige qué canales del chat ves (Canal, General y Comercio). Quitando el Canal tampoco salen los bocadillos de la plaza.
- [Mejora] En la plaza caben el doble de jugadores: ahora hay hasta 32 canales (antes 16).

### Idiomas

- [Nuevo] El juego ya está en chino tradicional (繁體中文): elígelo en Opciones › Idioma o en el selector de idioma de la portada. Viene puesto si tu navegador está en chino.

### Arreglos

- [Arreglo] Una partida de la Endless Tower que te reenganchabas tras un corte de conexión o una actualización podía anularse sin motivo. Ahora sigue contando.

## Beta 0.5.1 — 8 de noviembre de 2026

La Perforación se vuelve más potente, la Endless Tower carga el equipo y las cartas de tu cuenta, y varios arreglos.

### Equilibrio

- [Cambio] Perforación: ahora cada enemigo atravesado es otra tirada, así que un disparo puede atravesar a varios seguidos (antes como mucho a uno más), con un tope del 75% sumándolo todo. Las cartas de perforación dan del 2% (común) al 10% (legendaria), el doble que antes.
- [Cambio] Archer (y sus 2nd jobs) con arco: un 20% de perforación de base en sus disparos.
- [Nuevo] Las armaduras y las armas a distancia (arcos, armas de fuego, shuriken, varas e instrumentos) pueden traer perforación entre sus bonus, en el mismo hueco que el crítico: +1% por tier del mapa donde caen.

### Arreglos

- [Arreglo] El Fan of Knives de Salida de las sombras (al salir de Hiding) lanzaba un solo pulso. Ahora lanza los mismos que la skill: los 2 de inicio más los de las cartas, el Deity y la torre.
- [Arreglo] El aviso de mantenimiento salía tapado por el marcador de puntos de la Endless Tower. Ahora se coloca debajo.
- [Arreglo] En la Endless Tower, el personaje entraba a veces sin parte de su equipo o con menos cartas de las que lleva puestas. Ahora la torre cuenta todas las cartas de tu cuenta y las piezas que llevas puestas, incluidas las de tu partida local de antes de crear la cuenta y las recompensas de historia.
- [Arreglo] Las partidas de la Endless Tower del 8 de noviembre que no habían contado por el cambio de versión del juego se han recuperado: suman a tus puntos de la torre y entran en el ladder.
- [Arreglo] Con el traductor automático del navegador activado, algunos textos salían mal traducidos (el Plato de VIT ponía «+1 years»). El juego ya trae español e inglés en las opciones, así que ahora el navegador no lo traduce.
- [Arreglo] Con el panel del personaje abierto en la plaza, lo que te llegaba por un comercio podía desaparecer al equipar, mover estadísticas o tocar cualquier otra cosa del panel. Ahora el panel se pone al día en cuanto termina el comercio.
- [Arreglo] Al salir de la Endless Tower había quien volvía a Prontera con la pantalla en negro y la torre congelada detrás. La salida de una partida se ha rehecho para que la torre se cierre del todo antes de entrar en la plaza, y las cartas de la Deity o del piso que estuvieran abiertas ya no pasan a la plaza.
- [Arreglo] Maximize Power (talento final de Herrería del Merchant) no hacía nada en la Endless Tower, porque allí no hay zeny que gastar. Ahora en la torre Mammonite lleva siempre su golpe potenciado, sin gastar zeny.
- [Arreglo] Main Gauche, Stiletto y Gladius de 2 huecos (los que sueltan Poporing, Soldier Skeleton y Skeleton General) solo los podían llevar Thief y Ninja. Ahora los pueden llevar los mismos jobs que sus versiones de 3 huecos: Swordsman, Mage, Archer, Merchant, Thief y Ninja.
- [Arreglo] Algunos golpes (como el rayo del arma cargada) podían volver a matar a un monstruo que ya estaba muriendo: un jefe soltaba dos piezas, la EXP contaba dos veces y en la Endless Tower el monstruo puntuaba doble. Ahora cada monstruo cuenta una sola vez al morir.
- [Arreglo] En navegadores con protección contra el rastreo (como Helium o Brave), los personajes de los jugadores podían verse con píxeles de colores sueltos, mientras que monstruos y NPC salían bien. Ahora los colores de los personajes se leen directamente de sus imágenes, sin pasar por el lienzo que esos navegadores alteran.

## Beta 0.5 — 8 de noviembre de 2026

Llega la Endless Tower, el Bibliotecario con la wiki del juego, mucho equilibrio del melee y más optimización para el móvil.

### Endless Tower

- [Nuevo] La Endless Tower: el Guardián de la Torre, al oeste de la plaza de Prontera, abre la puerta a los personajes con 2nd job (se consigue con la historia del Castillo de Prontera). Son pisos de un minuto con monstruos sin parar y unos puntos mínimos que hay que conseguir para seguir subiendo. Cada 10 pisos el escenario cambia al de otro stage, y los pisos 10, 20, 30… son de MVP. Al empezar eliges una Deity, que sube de rango cada 10 pisos, y antes de cada piso una carta de mejora entre las de tus skills equipadas y tu ataque básico (tras los pisos 5 y 10 de cada bloque, épicas). Dentro no cae nada: con los puntos de la torre de cada partida compras mejoras permanentes que solo cuentan allí. Puedes guardar la partida una vez y seguirla otro día. Hay clasificación mensual, general y por 2nd job. Necesita una cuenta registrada: el servidor comprueba cada partida y su resultado es el que cuenta. Está en pruebas, así que los números pueden cambiar.

### Cuentas

- [Mejora] Hasta 15 personajes por cuenta (antes 10): la selección de personaje tiene una fila más.

### Equilibrio

- [Cambio] Swordsman, Thief y Merchant: sus skills de área pegan un 40% más a los jefes.
- [Cambio] Magnum Break: +30% de daño y +25% de área.
- [Cambio] Menos vida en dos MVP: Golden Thief Bug 58.000 (antes 67.500) y Drake del Barco hundido 180.000 (antes
  200.000).
- [Cambio] Zeny Rain también marca a los jefes (antes no les hacía nada): sin aturdirlos, durante la marca reciben un
  30% más de daño de todo. Contra los demás monstruos sigue igual (+50% de Mammonite).
- [Cambio] Sword Dance crece desde ti y se abre en tres pulsos, cada uno más lejos: ya no tiene hueco en el centro y lo
  que tienes cerca recibe los tres. Los pulsos de más que dan las cartas se reparten en la misma apertura. Enfriamiento
  de 9 s (antes 13).
- [Mejora] Bash demoledor con objetivos de más: reparte los mazazos para alcanzar al máximo de monstruos distintos, en
  vez de pegar a varios pegados entre sí.
- [Cambio] Thief: Throw Stone, Fan of Knives y Caltrops escalan con STR (ATK cuerpo a cuerpo) como el resto de sus
  skills, en vez de con el ATK a distancia (DEX).
- [Cambio] Swordsman y Merchant hacen más daño con el ataque básico cuerpo a cuerpo: un 75% más con arma de una mano y
  un 125% más con una a dos manos. El Thief, un 35% y un 50% más.
- [Cambio] Bash hace mucho más daño desde el principio (300 a nivel 1, antes 120) y sube poco por nivel (+3%): a nivel 8 hace 363 (antes 170).
- [Cambio] Mammonite hace un 15% más de daño a nivel 1 (150) y cada nivel le sube algo menos (+15%).
- [Cambio] El veneno de Envenom hace un 150% más de daño.
- [Cambio] Sombra errante (Sombras del Thief): tras el último salto de Shadowstep, tus ataques básicos siguen haciendo el 2000% de su daño durante 3 s.
- [Cambio] Two-Hand Quicken (Furia del Swordsman) da +10 de Celeridad por rango a los ataques básicos (antes +6).
- [Cambio] Berserk (Furia del Swordsman) da además +20% de alcance cuerpo a cuerpo y +10 de Celeridad en los ataques básicos.
- [Cambio] Fan of Knives lanza dos abanicos seguidos desde el nivel 1 (antes uno).
- [Cambio] Los ataques básicos a distancia (arco, pistola, huuma, vara e instrumento) y Arrow Repel solo pueden sumar +3 proyectiles con las cartas de la partida, y esas cartas salen siempre blancas (+1 proyectil). El Deity, los talentos y el equipo suman aparte.
- [Cambio] El ataque infusionado del Mage ya no saca cartas de +proyectil. La Infusión de rayo da ahora +2 proyectiles (antes +1).
- [Cambio] La perforación pasa a ser una probabilidad y un proyectil atraviesa como mucho a 1 enemigo (2 en total). Los talentos de perforación dan un 20% entre todos sus puntos: la Infusión de hielo y Flecha penetrante, un 20%; los de 2 puntos, un 10% por punto. Las cartas dan del 1% (blanca) al 5% (naranja) y el Deity de proyectil, un 10%. True Sight da un 10% más mientras dura.
- [Cambio] Las skills que atraviesan a todos (Arrow Repel, Huuma, Shield Bash…) siguen igual. Las que ya perforan de serie (Throw Shuriken) atraviesan siempre a 1 enemigo, ya no a más.
- [Mejora] Los cofres ya no ofrecen mejoras que no le sirven a tu personaje: el alcance cuerpo a cuerpo solo sale si tu ataque básico o alguna de tus skills pega cuerpo a cuerpo, y el daño de venenos, quemaduras y sangrados (Elixir de daño en el tiempo y Deity del tormento) solo sale cuando en la partida ya has envenenado, quemado o hecho sangrar a algún enemigo.
- [Cambio] Deity de Sword Dance: el arma se queda cargada de rayo 5 s al acabar el baile (antes 2 s).
- [Cambio] Deity de Frost Diver: el Estallido helado hace un 35% de la vida máxima del congelado a los de alrededor
  (antes 15%), más un 1% por cada refinado.

### Interfaz y textos
- [Nuevo] El Bibliotecario, al suroeste de la plaza de Prontera, junto a la estilista, es la wiki del juego: explica por secciones las stats, cómo escalan el ATK y el MATK, los valores decrecientes y sus topes, la defensa y los estados, las skills de todos los jobs, la partida (élites, hordas, cofres, dificultad), el equipo y el refine, los stages, los pets y más. Tiene buscador, calculadoras de stats, de golpe y de daño recibido, y gráficas que usan las mismas fórmulas que el juego. Con el mando, la cruceta recorre las secciones, A entra en ellas y B vuelve.
- [Nuevo] En la portada, el botón «Talentos» abre una página con los árboles de talentos de todas las clases: los de los 1st jobs y los de los 2nd jobs, que aún están en desarrollo y pueden cambiar.
- [Mejora] Flecha ígnea tiene un impacto nuevo: el suelo se chamusca con grietas de brasa y un aro de fuego que se abre hasta el borde de la salpicadura, en vez del suelo en llamas que llenaba la pantalla con área y objetivos de más. Cuando caen muchas a la vez, el efecto se aligera solo.
- [Arreglo] En grupo, un personaje ya no puede ir a un stage que no tiene desbloqueado (le falta el MVP del anterior, el
  gearscore, el Job Lv o su historia) aunque el líder sí lo tenga: al proponer la salida contesta que no y el grupo ve
  en su chat qué le falta.
- [Nuevo] En grupo, al proponer la salida el líder puede subir el tiempo para elegir carta de 10 a 20 segundos (en la
  ventana de dificultad; los demás lo ven en la propuesta).

- [Cambio] La lluvia ya no suena: su siseo se oía todo el rato, también con la partida en pausa.
- [Cambio] Portada nueva: una torre bajo un cielo de tormenta, con las nubes girando en remolino sobre ella, y por el camino de delante pasan los monstruos de la Cueva de Payon y, de vez en cuando, algún MVP.
- [Cambio] La portada tiene música nueva, más oscura, a juego con el fondo; al pulsar Jugar vuelve la de Prontera.
- [Cambio] En el móvil ya no salen las barras de vida de los jefes arriba de la pantalla: con dos o tres jefes tapaban media pantalla. La vida de cada uno se ve en la barra que lleva encima de la cabeza.
- [Arreglo] Al cambiar el idioma a inglés sin recargar, los talentos que enseñan una skill de 2nd job (Spear Boomerang, Sonic Blow...) seguían con su nombre en castellano.
- [Nuevo] Los botones, pestañas y casillas de la interfaz suenan al pulsarlos, con un toc suave y corto que apenas se nota. Va con el volumen de «Interfaz» de las opciones. Los botones de skills y los controles táctiles no suenan.
- [Mejora] En el cofre, si una carta cambia lo que ya llevas en ese hueco (por ejemplo, otra Deity cuando ya tienes una), lo avisa en un recuadro naranja al pie con el icono y el nombre de la que perderías. Al pulsarla, la carta se da la vuelta y pregunta si quieres cambiarla, con «Sí, cambiar» y «No» (con el teclado, el mismo número o Enter para sí y Esc para no).
- [Arreglo] Al cambiar de idioma sin recargar, la calidad de las cartas («Común», «Épica»...) seguía en el idioma anterior.

### Rendimiento

- [Mejora] Infusiones del Mage más ligeras en el móvil: la mitad de partículas en la estela, sin el charco de luz en el suelo y con los arcos del rayo más simples. Además respetan la calidad de los efectos de las opciones: en media sale la mitad de estela y en baja, una cuarta parte. En el ordenador y en calidad alta se ven igual que antes.
- [Cambio] En grupo, los efectos de las infusiones del Mage solo los ve quien las lleva: los compañeros ven su ataque normal del arma. Con varios magos en el grupo la pantalla ya no se llena de proyectiles. El daño no cambia.
- [Cambio] Los canales de la plaza son ahora de 25 jugadores (antes 40), y hay más canales. Con la plaza tan llena, el móvil se quedaba sin memoria al cargar a todos.
- [Arreglo] La partida se guarda sola cada 10 segundos. Si el juego se cierra de golpe (por ejemplo, el iPhone al quedarse sin memoria), al volver se ofrece seguirla desde ahí. Antes solo se guardaba al salir o al mandar el juego al fondo, y un cierre así hacía perder la partida entera.
- [Mejora] Partidas más ligeras en el móvil: el HUD usa menos memoria durante toda la partida, y las cartas de subida de nivel salen sin chispas ni animaciones continuas y con un brillo más pequeño. Las alas de la subida de nivel se cargan al empezar la partida y no justo antes de las cartas.
- [Mejora] Tope de partículas para toda la partida, compartido por todos los efectos: al sumar proyectiles y objetivos (varios Shield Bash a la vez, infusiones…) ya no salen miles de partículas y piedras a la vez. Lleno el tope, las nuevas no salen hasta que se apagan otras. Es más bajo en el móvil y con calidad de efectos media o baja. El daño y los golpes no cambian.
- [Mejora] Shield Bash más ligero con muchos escudos a la vez: el halo y las estelas cuestan la mitad de dibujar y se ven igual, y las piedras y el polvo pesan mucho menos. En el móvil se dibujan como mucho 8 escudos a la vez (a partir del sexto, sin halo ni estelas); los demás golpean igual pero no se ven. Unos encima de otros ya se veían como un solo muro.
- [Mejora] En el móvil, con muchos proyectiles infusionados del Mage a la vez, a partir de 40 los nuevos salen como un brillo pequeño, sin llama, arcos ni estela. El daño no cambia.
- [Mejora] En las partidas en grupo, el líder manda muchos menos datos de los monstruos: en los demás jugadores los monstruos siguen andando solos entre mensajes y el líder solo los vuelve a mandar cuando hace falta corregirlos. Con muchos monstruos a la vez se mandan unas cuatro veces menos datos.
- [Arreglo] Al volver a la plaza y empezar otra partida, la plaza y las partidas anteriores se quedaban en memoria, y cada escena se sumaba a la anterior. Ahora se sueltan al salir de ellas. En el móvil, sobre todo en iPhone, la segunda partida de la sesión empezaba con mucha menos memoria libre que la primera.

## Beta 0.4.2 — 6 de noviembre de 2026

Jefes sin daño por contacto, ajustes al Thief, al Swordsman y al Merchant, y barras de jefes más pequeñas en el móvil.

### Jefes

- [Cambio] Los minijefes y los MVP ya no pegan al tocarte: solo hacen daño con sus skills. Puedes quedarte pegado a ellos mientras esquivas lo que lanzan.

### Equilibrio

- [Cambio] Envenom apuñala el doble de seguido (cada 2,5 s en vez de cada 5 s), pega 2,5 veces más y su veneno hace el doble de daño.
- [Cambio] Bash y Mammonite pegan más desde el principio: Bash el doble a nivel 1 y Mammonite un 25% más. Cada nivel les sube menos el daño que antes (Bash +6%, Mammonite +17%), así que a nivel 8 pegan lo mismo que antes.
- [Cambio] Barrido traicionero (Combate del Thief) solo funciona con daga o katar. Con otras armas sale apagado en el árbol, como las maestrías de arma; antes se podía coger con arco y no hacía nada.
- [Cambio] Maestría con la hoja (Combate del Thief), además del daño, hace que con daga o katar el ataque básico escale mejor con el ATK: hasta un 50% mejor al rango 5. En el late, la daga ya no se queda tan atrás del arco.

### Interfaz y textos

- [Mejora] Barras de jefes más compactas en el móvil: cada jefe en una línea, con el nombre al lado de la barra, y los del mismo tipo juntos en una fila con «×3» y la barra partida en un trozo por cada uno. Los Cramp ya no llenan media pantalla.
- [Cambio] En el móvil, el aviso de mantenimiento es solo un reloj pequeño con la cuenta atrás, para no tapar la partida. Al tocarlo enseña el mensaje entero.

### Rendimiento

- [Mejora] Al entrar en la plaza, los demás jugadores y sus pets se cargan poco a poco, empezando por los que tienes más cerca, en vez de todos a la vez. En el móvil se reparte la memoria que hace falta al entrar en una plaza llena; los más lejanos tardan un momento más en aparecer.

## Beta 0.4.1 — 6 de noviembre de 2026

Parche para el iPhone y las partidas en grupo.

### Rendimiento

- [Mejora] Panel del personaje más ligero: las cartas y los pets se cargan al entrar en su pestaña y no al abrir el panel, y solo se sacan los retratos de los pets que tienes. Ocupa menos memoria en el móvil, sobre todo con la plaza llena.
- [Mejora] Partidas en grupo: el líder solo manda los monstruos que han cambiado y repasa la lista poco a poco, en vez de enviarla entera cada 3 segundos. Con muchos monstruos, los mensajes entre jugadores pesan mucho menos.

## Beta 0.4 — 6 de noviembre de 2026

Mucha menos memoria en el móvil para acabar con los cierres en iPhone, /sit en la plaza y partidas justas para todos.

### Prontera

- [Nuevo] /sit en el chat de la plaza para sentarte, como en RO (o la tecla Insert; te levantas al andar). Los demás te ven sentado.

### En grupo

- [Cambio] Las historias (Barco hundido y Castillo de Prontera) se juegan en solitario: en grupo el capitán solo
  ofrece los stages normales.

### Cuentas

- [Cambio] Partidas justas para todos: con cuenta, el servidor solo acepta lo que se consigue jugando. El equipo, las cartas,
  los niveles, los talentos y los jobs que aparecen sin una partida que los dé ya no se quedan en la cuenta.
- [Cambio] Al crear una cuenta con la partida de invitado, los personajes entran con el nivel que permiten sus partidas.

### Rendimiento

- [Mejora] El juego usa bastante menos memoria en el móvil (unos 100 MB menos en el Bosque de Payon): menos cierres y recargas inesperadas, sobre todo en iPhone.
- [Mejora] La plaza de Prontera se cierra mucho menos en el móvil cuando hay mucha gente: los pets de los demás pesan unas 10 veces menos.
- [Mejora] Las imágenes de los monstruos y de los mapas ya no se guardan dos veces en el móvil: unos 100 MB menos en una partida en el Bosque de Payon.
- [Mejora] La plaza ya no acumula memoria con la gente que entra y sale: lo de los jugadores que se van se suelta al rato.
- [Mejora] Los efectos de las habilidades se cargan cuando se usan y no al abrir el juego: unos 65 MB menos en el móvil. La primera vez que sale un efecto en una partida puede tardar un instante en verse.
- [Mejora] Las animaciones de muerte de los monstruos grandes se guardan más pequeñas (casi no se nota): los monstruos ocupan una cuarta parte menos.
- [Mejora] Las infusiones del Mage pesan mucho menos al pintarse (se ven igual): con varios proyectiles a la vez, el juego ya no se arrastra en el móvil.
- [Arreglo] Las pets ya no se quedan corriendo en el sitio al pararte: llegan a tu lado y se quedan quietas.

## Beta 0.3 — 5 de noviembre de 2026

Lista de amigos, estilista en la plaza, juego con mando, preguntas de seguridad para la cuenta y un móvil mucho más fino, sobre todo en iPhone.

### Prontera
- [Nuevo] Estilista en la plaza, a la izquierda de la fuente: cambia el peinado, el color de pelo y el color de la
  ropa de tu personaje cuando quieras, gratis, viéndolo antes en la vista previa. Los tintes especiales salen con
  candado, pero se pueden probar en la vista previa: Blood Savage, Bronze Sentry y Black Guard se conseguirán en la
  Endless Tower y Shadow al superar Shadow Niff (próximamente). También se maneja con el mando.

### Amigos
- [Mejora] En la lista de amigos, el que está jugando sale «En partida» también si juega solo, con el stage y el tiempo
  que lleva (corre mientras miras la lista); al volver a la plaza sale otra vez su canal. Y si está en un grupo, lo
  dice.
- [Mejora] Al tocar el nombre de un amigo, su menú sale encima de la lista sin cerrarla.
- [Mejora] El botón «Amigos» de la plaza dice cuántos de tus amigos están ahora en la plaza, además de las peticiones
  sin contestar (con el número en rojo), con el mismo estilo que las teclas de los botones de al lado.
- [Nuevo] Lista de amigos, como en RO: botón «Amigos» en la plaza. Se añade a alguien por el nombre de su personaje o
  desde su menú en la plaza («Añadir amigo»); le llega una petición y, cuando la acepta, salís en la lista del otro
  (también si estaba desconectado: la ve al entrar). La lista dice dónde está cada uno (canal, en partida o
  desconectado); tocando el nombre de uno que está en la plaza sale su menú (susurrar, inspeccionar, comerciar,
  invitar al grupo, ir a su canal...). Hasta 40 amigos por personaje, solo con cuenta.

### En grupo
- [Nuevo] El medidor de daño, en grupo, tiene dos modos, que se cambian con el botón de su barra azul: Jugadores (el
  daño de cada uno, como hasta ahora) y Skills (las habilidades de todo el grupo juntas, cada persona con su color y
  una leyenda arriba). Se recuerda el último.
- [Nuevo] En la partida del grupo se sigue hablando por el canal Grupo: abajo a la izquierda salen los mensajes (se
  apagan solos) y la línea de escribir está siempre a la vista: con Enter (en el móvil, tocándola) se escribe. También
  llega lo que escriben los del grupo que siguen en la plaza, y al revés.

### Cuentas
- [Nuevo] Preguntas de seguridad opcionales: al crear la cuenta puedes elegir 5 respuestas sobre Ragnarok (tu ciudad,
  monstruo, MVP, job y pet favoritos). Si olvidas la contraseña, en Entrar → «¿Has olvidado la contraseña?» las
  contestas y pones una nueva, con 3 intentos a la semana. A las cuentas que ya existían se les ofrecen al entrar. Se
  eligen una sola vez, y si no las quieres es para siempre, y sin ellas una contraseña olvidada no se puede recuperar.
- [Arreglo] Al jugar en dos dispositivos (PC y móvil), uno que no había podido guardar entera la partida bajada del
  servidor podía subirla luego sin el inventario y dejar la cuenta sin equipo. Ahora no se sube: se avisa y se vuelve a
  cargar la del servidor.
- [Cambio] Los nombres de personaje de invitado también quedan reservados: nadie más puede usarlos y, al crear la
  cuenta, tus personajes conservan su nombre (antes podía tocarte cambiarlo si otro jugador lo había cogido entretanto).
  Si pasas 30 días sin jugar como invitado, sus nombres vuelven a quedar libres.

### Equilibrio
- [Cambio] El descubrimiento rinde cada vez menos al acumularse: con elixires, bendiciones y Deity sumados, una de
  cada tres o cuatro mejoras y piezas salía legendaria. Ahora con mucho descubrimiento salen en torno a un 7%.
  A cambio, las épicas salen un 20% más.

### Interfaz y textos
- [Arreglo] Ctrl+C para copiar un texto (del chat, por ejemplo) ya no abre la ventana del personaje; los atajos de una
  letra (C, X, M, K) no hacen nada si se pulsan con Ctrl, Alt o Cmd.
- [Nuevo] El equipo del juego (GM) se distingue en la plaza: su nombre sale en dorado y sus mensajes del chat,
  resaltados en dorado con la etiqueta GM.
- [Cambio] Sin el aviso con botón «Actualizar» dentro del juego: cuando hay versión nueva estando en la plaza, una ventana
  pide recargar la página, y la portada la descarga enseñando el progreso. En plena partida no se pregunta hasta que
  acaba; en la portada y en la selección de personaje se pone sola, como antes.
- [Mejora] Móvil: un toque rápido para ir andando ya no enseña el joystick un instante; sale al arrastrar el dedo o al
  dejarlo quieto un cuarto de segundo.
- [Cambio] Móvil, controles como los de Vampire life: el joystick se queda fijo donde aparece (antes la base seguía
  al dedo) y un toque corto, sin arrastrar, manda al personaje andando a ese punto, como el clic del ratón (en la plaza,
  tocando a un NPC vas a hablar con él).
- [Cambio] Móvil: fuera los botones de girar la cámara (estorbaban, en la plaza y en partida); se gira con dos dedos.
- [Arreglo] Portada con el móvil apaisado: Descargas, Novedades, el idioma y los enlaces van en la mitad izquierda, con el
  logo, y la ventana de entrar usa todo el alto de la derecha (arriba la tapaban esos botones y abajo los enlaces).
- [Mejora] En grupo, las ayudas del Acolyte llegan a los compañeros: Blessing bendice a los que están cerca (con el
  nivel y los talentos de quien la lanza), Heal también les cura y los charcos de Aqua Benedicta (y el árbol de
  Epiclesis) curan a todo el que los pisa.
- [Mejora] Móvil apaisado: el título y el pie de todas las ventanas son más finos, y las listas del Cronista y de la
  Cuidadora de pets aprovechan el alto que queda (en Mejoras del Cronista apenas cabía una fila).
- [Arreglo] Móvil: repaso de la interfaz. En el panel del personaje, Estado y Job ya se ven enteros con el móvil
  apaisado (la lista de estadísticas y los árboles de talentos se quedaban sin sitio), la cabecera ocupa una sola fila
  y en vertical las pestañas caben en dos filas. Al subir de nivel, el botón para volver a tirar todas las cartas ya no
  se queda fuera de la pantalla. Al acabar la partida, el botón de volver está siempre a la vista. En la plaza, el
  aviso para hablar con un NPC va abajo, encima de los botones, y los nombres de los NPC ya no se montan unos encima de
  otros. En la selección de personaje, la barra de la cuenta ya no queda debajo de los botones de arriba.
- [Arreglo] En grupo, al acabarse el tiempo para vencer al jefe final no caían los meteoritos: la cuenta atrás de cada
  uno se desfasaba con lo que hubiera estado parada su partida. Ahora todos llevan la del líder y la lluvia cae sobre
  todos a la vez.
- [Arreglo] En grupo, cuando caían varias piezas a la vez (un jefe), al elegir Need o Greed en la primera la partida
  seguía mientras decidías las demás y los monstruos te pegaban. Ahora sigue parada hasta elegir la última.
- [Mejora] En grupo, el resultado de cada tirada de Need / Greed sale a todos en la carta grande del botín: quién se
  la lleva y el dado de cada uno. La partida sigue parada hasta que todos la cierran (o a los 6 segundos).
- [Arreglo] En iPhone, al subir de nivel la pantalla se quedaba en blanco y el juego volvía a la pantalla de entrada.
- [Arreglo] Móvil, sobre todo iPhone: el juego gasta mucha menos memoria (los monstruos se cargan al entrar en su stage y no
  todos al abrir el juego, y al cambiar de mapa se suelta el anterior), así que ya no se recarga solo tras varias
  partidas; los sonidos tampoco se cargan todos de golpe al primer toque.
- [Nuevo] Se puede jugar con mando (Xbox, PlayStation y la mayoría de los genéricos): stick izquierdo para andar,
  stick derecho o LB/RB para girar la cámara (arriba/abajo, zoom) y Start para la pausa. Desde la portada (A
  ¡Jugar!, LB/RB entre invitado, entrar y crear cuenta) a la selección de personaje, donde la cruceta elige ranura y
  A juega. En Prontera, A habla con el NPC que tienes al lado, X abre tus amigos, Y tu personaje y Select vuelve a
  la selección de personaje; ←/→ eligen a los jugadores de alrededor (su nombre en rojo) y A abre su menú; ↑ abre
  el chat (con el teclado del sistema donde lo haya) y ↓ los emotes, que ahora traen frases rápidas para hablar sin
  teclado (también con el ratón); RT entra en el panel del grupo (miembros, hacer líder, expulsar, salir) y B sale de él. Las ventanas de la partida, el panel del personaje (equipo, inventario, cartas, pets,
  estado y talentos), las expediciones, la tienda, el herrero, el Cronista, la Cuidadora de pets, el estilista, los amigos y las
  opciones se recorren con la cruceta: lo elegido se marca en rojo y enseña su ficha como con el ratón, A lo pulsa,
  X hace de clic derecho (quitar un talento, +10 a una estadística) y B vuelve atrás (los botones de cerrar se
  esconden mientras usas el mando). Las pestañas solo con LB/RB y los filtros de dentro (tipos de objeto, ramas de
  talentos) con LT/RT; al abrir una ventana o cambiar de pestaña se empieza por lo primero. En las expediciones, A
  deja elegido Partir y B vuelve a la lista. En el personaje, la cruceta recorre las
  casillas de equipo (cada una se elige al pasar), A o → entra en su lista de piezas con la comparación al momento
  y A la equipa; X quita la pieza e Y abre sus huecos de cartas, donde ←/→ elige hueco (en rojo) y A encaja la
  carta. En Estado se va por filas y ←/→ bajan o suben la estadística; en Inventario, Cartas y Pets cada objeto
  enseña su detalle al pasar y A entra en sus botones. Mientras usas el mando, abajo a la derecha (el panel del grupo sube para dejarle sitio) se ve qué hace
  cada botón con lo que tienes elegido. La creación de personaje también: las estadísticas van por filas (←/→ bajan
  o suben) y el nombre se escribe con el teclado del sistema donde lo haya o, sin él, «Aleatorio» se inventa uno si
  está vacío (también con el ratón). El comercio todavía va con ratón o pantalla táctil. Los botones
  están en Opciones → Controles.
- [Mejora] La lluvia es más suave: menos gotas, más finas y translúcidas, en varios planos de profundidad, para que
  no cargue la pantalla.
- [Cambio] El icono del juego instalado como app es ahora el «RO» dorado del logo, en lugar del Poring. Si ya la
  tienes instalada, el móvil o el PC lo cambia solo al cabo de un tiempo (en iPhone, al volver a añadirla).

## Beta 0.2.1 — 4 de noviembre de 2026

Susurros, barra de vida bajo el personaje, números de daño como en RO y una creación de personaje más clara.

### Interfaz y textos
- [Cambio] Las trampas descaradas (equipo que el juego no da, Puntos Kafra inventados, niveles imposibles) bloquean
  la cuenta al momento, y la conexión desde la que se hicieron durante 30 días.
- [Cambio] Al crear personaje cada estadística dice lo que cuesta el siguiente punto, como en la ficha de estado, y ya
  no hace falta repartirlos todos: los que sobren se reparten luego en la ficha (Personaje, en la plaza).
- [Mejora] Tu personaje lleva su barra de vida debajo, como en RO: verde y roja por debajo del 25%, para no tener
  que mirar al retrato de la esquina en plena pelea.
- [Cambio] El botón Instalar ya no va suelto en la plaza (en el móvil se montaba con lo demás): ahora está al pie de
  Opciones (⚙), en la plaza y en la selección de personaje.
- [Mejora] Jugando como invitado, en el menú de otro jugador los botones de susurrar, comerciar e invitar al grupo
  salen apagados con una nota que explica que hace falta una cuenta (también si el invitado es el otro), y la línea
  del chat y su botón de canal se ven apagados.
- [Nuevo] Susurros en la plaza: mensajes que solo ve otro jugador, esté en el canal que esté. Desde su menú
  (Susurrar, al tocar su personaje o su nombre en el chat) o escribiendo `/w "nombre" mensaje`; `/r mensaje` contesta
  al último que te ha susurrado.
- [Mejora] Los números de daño se mueven como en RO: salen grandes de la cabeza del objetivo, suben, caen en arco
  hacia la derecha y se van haciendo pequeños hasta desaparecer. En Opciones → Juego, «Números en línea recta» vuelve
  a los de antes.
- [Mejora] Al crear personaje se marca con ★ la estadística de la que sale el daño del job (STR, DEX o INT); el
  Acolyte lleva dos: INT camino de Priest y STR camino de Monk.
- [Arreglo] El aviso de mantenimiento ya no tapa nada: en la plaza va debajo del nombre del sitio, en partida debajo
  del tiempo y en la selección y creación de personaje, en un lado.
- [Mejora] Al crear personaje, cada estadística explica qué hace: al pasar el ratón por encima o, en el móvil, al
  tocarla.

## Beta 0.2 — 3 de noviembre de 2026

Dos stages nuevos, Prontera renovada, nuevos jefes y un bonus propio en cada objeto.

### Stages
- [Nuevo] **Alcantarillas de Prontera (Nv 9–12):** entre los Campos de Prontera y el Barco hundido, en las Cloacas
  bajo la ciudad, a media luz entre faroles y niebla azul. Thief Bug, Familiar, Tarou, Plankton, Drainliar y Cramp;
  a los 3 minutos salen a la vez los tres **Tarou rabiosos** (uno embiste, otro envenena el suelo y el otro excava
  y llama a las ratas): solo suelta botín el último en caer y los que quedan se enfurecen. El MVP es el
  **Golden Thief Bug**, que vuelve a su sitio.
- [Nuevo] **Isla de Byalan (Nv 16–20):** el primer stage del tier 2, en el templo hundido del piso 5 de la mazmorra
  de Izlude, con su nave de columnas, su escalinata y sus claustros en penumbra azul. Vadon, Cornutus, Marse,
  Obeaune, Phen, Marine Sphere y Merman; de jefes, **Deviace**, **Strouf** y **King Dramoh**, y de MVP el **Kraken**.
- [Cambio] **Campos de Prontera renovados (Nv 1–8):** llegan Roda Frog, Creamy y Mandragora (no anda, como en RO:
  brota del suelo cerca de ti y te azota con sus raíces desde lejos); los jefes son Eclipse, **Toad** (escupe
  burbujas en abanico), **Dragon Fly**, Vocal y, de MVP, un **Mastering** mucho más fuerte, que se parte en Porings,
  salta sobre ti y hace temblar el suelo.
- [Cambio] **El Bosque de Payon pasa a Nv 21–25** y se abre al vencer al Kraken.
- [Cambio] Quien ya venció al Golden Thief Bug en Prontera, a Eddga o a Moonlight Flower conserva todo lo que tenía
  abierto.

### Jefes
- [Nuevo] **Kraken:** casi no se mueve y lo hace todo con sus tentáculos: hileras que avanzan por el suelo hacia ti,
  latigazos en aspa, un anillo que te rodea y luego se cierra, un vórtice que te arrastra hacia su boca, nubes de
  tinta y tentáculos que se quedan atacándote de lejos hasta que los rompes (a media vida le salen por todas partes).
- [Nuevo] **Penomena, jefe del Barco hundido:** sale al minuto 6 con tentáculos que brotan donde estás, se hunde para
  asomar bajo tus pies, lanza una marea venenosa a su alrededor y hace brotar Hydras.
- [Nuevo] **Marine Sphere:** si no la rompes a tiempo, a los 10 s revienta y te hace daño a 2 m. Antes parpadea en
  rojo, cada vez más deprisa.
- [Cambio] **Contra reloj ante el jefe final:** al salir el último jefe del stage, el reloj cuenta 2 minutos hacia
  atrás en rojo; si llega a 0 sin vencerlo empieza la lluvia de meteoritos (antes había 3 minutos y el reloj seguía
  subiendo).
- [Cambio] **Barco hundido más largo:** Ghostring a los 3 minutos, Penomena a los 6 y Drake a los 10 (antes, a los 7),
  con más del doble de vida.
- [Cambio] **Ghostring** tiene casi el triple de vida (28.000; antes, 10.500).
- [Cambio] **Drake:** Sablazo, Remolino y Oleaje llegan el doble de lejos y avisan algo menos: ya no se le puede
  pelear a distancia sin moverse.
- [Cambio] **Moonlight Flower, más dura:** 1.000.000 de vida, y la Cat O' Nine Tails que invoca en la campana sellada
  tiene 175.000 (hay que tumbarla en 20 segundos para abrir la campana).
- [Cambio] **Jefes de tier 1 (Campos de Prontera, Alcantarillas y Barco hundido) un 25% menos dañinos**, minis y MVPs.

### Equipo y cartas
- [Nuevo] **Cada objeto, algo suyo:** todo el equipo que cae trae un bonus propio sacado de lo que da en RO, marcado
  con ★ (Apple of Archer DEX, Brooch AGI, Golden Mace más daño a no-muertos, Fire Brand quemaduras, Mirror Shield
  menos daño recibido...). Es pequeño, va en todas las calidades y sube con el tier y el refine.
- [Nuevo] **Cartas nuevas:** Roda Frog, Creamy, Mandragora, Toad, Dragon Fly, Tarou, Drainliar, Cramp, Vadon,
  Cornutus, Marse, Phen, Obeaune, Marine Sphere, Merman, Deviace, Strouf, King Dramoh y Kraken.
- [Nuevo] Merman y Strouf sueltan el **Trident** (lanza a dos manos del Swordsman) y King Dramoh, su corona. Plankton
  suelta ahora un Safety Ring y Mastering puede soltar el Poring Hat.
- [Cambio] **Más equipo:** los monstruos normales sueltan equipo un 50% más a menudo, y las armas de los minis y MVPs
  caen con un 5% cada una (antes, del 1 al 9%).

### En grupo
- [Mejora] **La partida espera a todos:** no empieza hasta que han entrado todos (sale quién está cargando y quién ya
  está dentro); entonces cuenta 5 segundos y arranca. Si alguien no llega en 45 segundos, se empieza sin él.
- [Mejora] **Marco del grupo en la partida:** retrato, job y vida de cada compañero bajo tus buffs. Un compañero caído
  se marca en rojo y, si está fuera de la pantalla, una flecha en el borde te dice dónde está.
- [Mejora] **Need / Greed en grande:** las piezas, cartas y huevos salen en la carta grande del botín, con lo que dan,
  y desde ahí se elige; la partida espera a que elijan todos. El aviso de quién falta por elegir se ve mucho más.
- [Cambio] **Partidas más llenas:** con 2 salen ×2,5 monstruos y con 3, ×3,85, alrededor de cada jugador (antes todo
  salía junto al líder). Los normales tienen ×1,25 de vida con 2 y ×2,25 con 3; los jefes y MVP, ×1,75 y ×4.
- [Cambio] **EXP y zeny:** el 80% de lo que se gana jugando solo con 2 jugadores y el 60% con 3, aunque salgan más
  monstruos. Las élites y los cofres salen igual que jugando solo.

### Interfaz y textos
- [Mejora] **Skills y talentos en castellano:** los nombres de RO también salen traducidos (Golpe fuerte, Saeta de
  fuego, Lluvia de flechas...), y la ficha de cada skill y talento enseña el original entre paréntesis
  («Golpe fuerte (Bash)»).
- [Mejora] **Stages que cargan antes:** mientras estás en la plaza se van bajando los mapas de los stages que tienes
  abiertos, así que la primera partida de cada uno ya no espera a la descarga.
- [Mejora] **Actualizaciones más limpias:** cuando hay una versión nueva, la portada la pone antes de cargar (solo el
  logo con «Actualizando… X%») en vez de cargarlo todo con la vieja y recargarse a los pocos segundos.
- [Mejora] **Barco hundido (historia):** Lain se fija en las tres runas del portal de la barrera y comenta al llegar
  al primer mecanismo, al activarlo y al activar el último, para que se entienda qué hay que hacer.
- [Mejora] **Nombres de los mapas:** el minimapa y la pantalla de carga enseñan el nombre del sitio («Cubierta del
  barco hundido») en vez del nombre interno del mapa.
- [Mejora] **Denuncias que se revisan:** las denuncias y lo raro en las cuentas se revisan cada día. Quien se salte
  las normas puede quedar silenciado en el chat o con la cuenta bloqueada unos días o para siempre; el juego le dice
  hasta cuándo y por qué, y las sanciones pueden anunciarse en el chat de todos.
- [Mejora] Los botones de idioma de Opciones y del menú principal tienen el mismo tamaño que los demás.
- [Arreglo] En inglés, algunos talentos del Mage salían con el nombre en castellano.
- [Arreglo] La barra del perfil es más ancha: «Crear cuenta» ya no se parte en dos líneas con muchos Puntos Kafra.
- [Arreglo] El menú de un jugador que se abre desde el chat del lobby ya no se sale por abajo de la pantalla con la
  interfaz agrandada.
- [Arreglo] En la ventana de denunciar a un jugador, los círculos de cada motivo quedan alineados con su texto.
- [Arreglo] La barra de carga del botón Jugar va a la par del porcentaje (antes, al 9x% apenas pasaba de la mitad).

## Beta 0.1 — 3 de noviembre de 2026

La primera beta pública: un life en el mundo de Ragnarok Online que se juega gratis en el navegador.

### Jobs
- **6 jobs:** Swordsman, Mage, Archer, Acolyte, Thief y Merchant, cada uno con sus skills y efectos propios, una
  Deity por skill y tres árboles de talentos para hacerte tu build.
- Taekwon, Ninja y Gunslinger llegarán más adelante.
- Crea tu personaje con el aspecto de RO: peinado, color de pelo y tintes de ropa, y reparte sus stats.

### Stages
- **Campos de Prontera** (Nv 1–10), **Barco hundido** (11–15), **Bosque de Payon** (16–25) y **Cueva de Payon**
  (26–30), cada uno con sus monstruos, sus minis y un MVP final.
- **Modo historia** con Selene, Lain y Haru en el Barco hundido y en el **Castillo de Prontera** (31–35), que termina
  con tu subida a 2nd job.
- Aldea orca y Pirámides de Morroc, próximamente.

### La partida
- Cada nivel eliges una carta: skills nuevas, mejoras o Deity. Cofres, imán, carne, clima y ciclo de día y noche.
- Dificultad a tu gusto antes de salir (número de enemigos, su daño, su vida, su velocidad y los eventos): cuanto
  más difícil, más botín.
- Medidor de daño para ver qué aporta cada skill.

### Equipo y progreso
- Equipo de común a legendario, con tiers según el mapa, propiedades y huecos para cartas de monstruo.
- Herrero para refinar con Oridecon y Elunium, y tienda de Puntos Kafra.
- **24 pets:** huevos raros que caen de su monstruo, intimidad, accesorios y evoluciones con la Cuidadora de pets.
- Logros de la cuenta y mejoras del roll de cartas en el Cronista de hazañas.
- El Gearscore de tu equipo abre los stages más difíciles.

### Online
- **Cuentas** con usuario y contraseña: tu partida se guarda en el servidor y la sigues desde cualquier dispositivo.
  También se puede jugar como invitado, con la partida en el navegador, y pasarla luego a una cuenta.
- **Plaza de Prontera online:** chat, emotes, canales, comercio entre jugadores e inspección de otros personajes.
- **Grupos de hasta 3** que salen juntos al stage, con monstruos y botín compartidos y tiradas de Need / Greed.
- El chat, el comercio y los grupos son para jugadores con cuenta.
- **Denunciar** a un jugador desde su menú en la plaza (insultos, trampas, RMT, spam): lo revisamos a mano.

### Además
- En español e inglés, con controles táctiles en el móvil y se puede instalar como app.
- Gratis y sin anuncios.
