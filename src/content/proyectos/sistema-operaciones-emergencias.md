---
titulo: Sistema de operaciones para un centro de emergencias
cliente: Centro de comando y atención de emergencias (Venezuela)
categoria: Sistema web a medida
resumen: Aplicación web que reemplazó el control en papel de asistencia, visitantes y operaciones de emergencia, con trazabilidad completa y reportes automáticos.
seoDescription: Caso de VenusTech, un sistema web a medida para un centro de emergencias con asistencia, incidencias, reportes PDF y Excel, permisos y auditoría.
reto: El centro llevaba en papel tres áreas críticas, la asistencia del personal, el registro de visitantes y las operaciones de emergencia. No había trazabilidad de quién registraba, autorizaba o atendía cada caso, y los reportes se armaban a mano.
solucion: Diseñé y desarrollé una aplicación web en tres capas que centraliza las operaciones del centro, con el ciclo completo de cada incidencia, permisos por módulo y acción, auditoría de cada cambio y reportes oficiales generados de forma automática.
resultados:
  - Trazabilidad completa de cada registro, autorización y atención, con fecha y responsable
  - Planillas y actas oficiales en PDF generadas al instante
  - Estadísticas y productividad calculadas en tiempo real
  - Registros protegidos contra eliminación para preservar la integridad institucional
metricas:
  - valor: '58'
    etiqueta: tablas en la base de datos
  - valor: '27'
    etiqueta: módulos de interfaz
  - valor: '29'
    etiqueta: endpoints de API
  - valor: '100 %'
    etiqueta: de las pruebas aprobadas
stack: [PHP 8, MySQL 8, JavaScript ES6, Bootstrap 5, Chart.js, FPDF]
orden: 1
destacado: true
---

## El reto

El centro de emergencias controlaba en papel tres procesos críticos:

- **La asistencia del personal**, con planillas de firmas por departamento.
- **El registro de visitantes**, sin un historial consultable.
- **Las operaciones de emergencia**, desde la llamada hasta el cierre de cada caso.

Con el papel era imposible saber con certeza quién registró, autorizó o atendió cada caso, y los reportes para la dirección se armaban a mano.

## La solución

Desarrollé una **aplicación web a medida en tres capas**: una interfaz rápida en el navegador, un servidor con una API y las reglas del negocio, y una base de datos relacional robusta. No usé frameworks pesados, para que el sistema fuera portable y fácil de mantener.

### Control de asistencia

- Marcaje desde una tablet con la cédula, sin contraseñas.
- Registro de visitantes con motivos configurables.
- Planilla oficial de firmas por departamento en PDF.
- Registros que no se pueden eliminar, para preservar la integridad institucional.

### Operaciones de emergencia

- El ciclo completo de cada incidencia: **llamada → autorización → despacho → cierre**.
- Semáforo por prioridad con avisos sonoros.
- Bandeja por organismo: cada despachador ve solo sus casos.
- Libro de guardia digital con acta en PDF.
- Historial, estadísticas y productividad calculadas al momento.

### Administración y seguridad

- Permisos por módulo **y por acción**, no solo por rol.
- Bitácora de auditoría de cada alta, cambio y desactivación.
- Contraseñas cifradas, protección contra ataques comunes y límite de intentos.
- Un asistente con inteligencia artificial que consulta el sistema respetando los permisos de cada usuario.
- Un monitor del servidor (CPU, RAM, disco y servicios) con alertas.
- Documentación técnica integrada en el propio panel.

## El resultado

El centro pasó del papel a un sistema que registra **quién hizo qué y a qué hora** en cada proceso. Los reportes oficiales se generan en segundos, en PDF y en Excel. El proyecto se entregó con manual de usuario, plan del proyecto y pruebas documentadas.

> Por la naturaleza de la institución, este caso se presenta de forma anónima y sin datos reales.
