import { Link, Outlet } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "../store/cartStore";

export function Layout() {
  const cantidadEnCarrito = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.cantidad, 0)
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/"
            className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-foreground"
          >
            <img
              src="/dulce_bendicion.jpg"
              alt="Logo de Dulce Bendición"
              className="h-16 w-16 rounded-full object-contain sm:h-20 sm:w-20"
            />
            <span>Dulce Bendición DB</span>
          </Link>
          <nav
            aria-label="Navegación principal"
            className="flex items-center gap-5 text-sm font-medium"
          >
            <Link to="/" className="transition-colors hover:text-primary">
              Inicio
            </Link>
            <Link
              to="/checkout"
              className="inline-flex items-center gap-2 transition-colors hover:text-primary"
            >
              <ShoppingCart aria-hidden="true" size={18} />
              Carrito
              {cantidadEnCarrito > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {cantidadEnCarrito}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="mt-8 border-t border-border bg-card py-6 text-sm text-muted-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-2 px-4 md:flex-row">
          <span>© {new Date().getFullYear()} Dulce Bendición DB</span>
          <span>Gracias por visitarnos.</span>
        </div>
      </footer>
    </div>
  );
}
