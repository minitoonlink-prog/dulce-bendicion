# Dulce Bendición DB

Tienda construida con React, TypeScript, Vite, Tailwind CSS, Zustand y Supabase.

## Requisitos

- Node.js 18 o superior.
- Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`.
- Usuario de administrador creado en Supabase Authentication.

## Desarrollo

```powershell
npm install
npm run dev
```

## Compilación

```powershell
npm run build
```

La aplicación utiliza `HashRouter` para ser compatible con GitHub Pages. La
tienda permite consultar productos, conservar el carrito en el navegador y
enviar pedidos mediante el checkout. El panel de administración está en
`/#/login`; tras iniciar sesión, administra pedidos y stock en `/#/admin`.

Las rutas protegidas del frontend requieren una sesión, pero la seguridad real
de los datos debe imponerse también con políticas RLS de Supabase para limitar
lecturas y modificaciones a los administradores.
