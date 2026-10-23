import { useEffect, useState } from "react";
import { ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabaseClient";
import { useCartStore } from "../store/cartStore";
import type { Product } from "../types/shop";

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function Home() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const agregarProducto = useCartStore((state) => state.agregarProducto);
  const espaciosSkeleton = Array.from({ length: 6 }, (_, index) => index);

  useEffect(() => {
    let activo = true;

    async function cargarProductos() {
      setCargando(true);
      setError("");

      const { data, error: errorConsulta } = await supabase
        .from("productos")
        .select("id, nombre, descripcion, precio, stock, imagen_url, activo")
        .eq("activo", true)
        .order("nombre");

      if (!activo) return;
      if (errorConsulta) {
        setError(`No fue posible cargar los productos: ${errorConsulta.message}`);
      } else {
        setProductos((data ?? []) as Product[]);
      }
      setCargando(false);
    }

    void cargarProductos();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <Card className="relative isolate overflow-hidden border-caramelo/35 bg-gradient-to-br from-crema via-card to-secondary/70 px-6 py-12 shadow-md sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[32px] border-caramelo/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 right-24 h-56 w-56 rounded-full bg-caramelo/10 blur-2xl"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-caramelo/40 bg-card/80 px-4 py-2 text-sm font-bold tracking-wide text-canela shadow-sm">
            <Sparkles aria-hidden="true" size={16} />
            REPOSTERÍA ARTESANAL
          </p>
          <h1 className="text-4xl font-bold leading-tight text-chocolate sm:text-5xl lg:text-6xl">
            Endulza tu día con Dulce Bendición
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base font-medium leading-relaxed text-chocolate/75 sm:text-lg">
            Postres artesanales hechos con amor en San Antonio
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-8 min-h-12 rounded-full px-8 shadow-md shadow-caramelo/20 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() =>
              document
                .getElementById("catalogo")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Ver Catálogo
          </Button>
        </div>
      </Card>

      <div id="catalogo" className="scroll-mt-8 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-caramelo">
              Recién horneados para ti
            </p>
            <h2 className="mt-1 text-3xl font-bold text-chocolate">
              Nuestros postres
            </h2>
          </div>
          {!cargando && !error && productos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {productos.length} delicias para elegir
            </p>
          )}
        </header>

      {cargando && (
        <>
          <p role="status" className="sr-only">
            Cargando productos...
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {espaciosSkeleton.map((item) => (
              <Card
                key={item}
                aria-hidden="true"
                className="overflow-hidden border-caramelo/15"
              >
                <div className="animate-pulse space-y-0">
                  <div className="h-52 bg-chocolate/10" />
                  <div className="space-y-4 p-5">
                    <div className="h-5 w-3/4 rounded-full bg-chocolate/10" />
                    <div className="h-4 w-full rounded-full bg-chocolate/10" />
                    <div className="h-4 w-1/2 rounded-full bg-chocolate/10" />
                    <div className="h-11 w-full rounded-xl bg-caramelo/20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
          {error}
        </p>
      )}
      {!cargando && !error && productos.length === 0 && (
        <Card className="border-dashed border-caramelo/40 p-8 text-center text-muted-foreground">
          Pronto tendremos postres disponibles.
        </Card>
      )}

      {!cargando && !error && productos.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {productos.map((producto) => (
            <Card
              key={producto.id}
              className="group flex flex-col overflow-hidden border-caramelo/20 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl motion-reduce:transform-none"
            >
              <div className="relative h-56 overflow-hidden bg-secondary/50">
                {producto.imagen_url ? (
                  <img
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 motion-reduce:transform-none ${
                      producto.stock <= 0 ? "grayscale" : ""
                    }`}
                    loading="lazy"
                  />
                ) : (
                  <div
                    aria-label="Imagen no disponible"
                    className={`flex h-full items-center justify-center text-muted-foreground ${
                      producto.stock <= 0 ? "grayscale" : ""
                    }`}
                  >
                    Imagen próximamente
                  </div>
                )}
                {producto.stock <= 0 && (
                  <span className="absolute right-0 top-5 -rotate-6 rounded-l-full bg-cereza px-5 py-2 text-sm font-bold tracking-wide text-white shadow-lg">
                    Agotado
                  </span>
                )}
                {producto.stock > 0 && producto.stock <= 5 && (
                  <span className="absolute left-3 top-3 rounded-full border border-caramelo/30 bg-crema/95 px-3 py-1 text-xs font-bold text-chocolate shadow-sm">
                    ¡Últimas unidades!
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="text-xl font-bold text-chocolate">
                    {producto.nombre}
                  </h3>
                  {producto.descripcion && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {producto.descripcion}
                    </p>
                  )}
                </div>
                <div className="mt-auto flex items-end justify-between gap-3 border-t border-caramelo/15 pt-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Precio
                    </p>
                    <p className="mt-1 text-2xl font-bold text-chocolate">
                      {formatoCOP.format(producto.precio)}
                    </p>
                  </div>
                  <p className="text-right text-xs font-medium text-muted-foreground">
                    {producto.stock > 0
                      ? `${producto.stock} disponibles`
                      : "Sin unidades"}
                  </p>
                </div>
                <Button
                  type="button"
                  className="min-h-11 w-full"
                  disabled={producto.stock <= 0}
                  onClick={() => agregarProducto(producto)}
                >
                  <ShoppingCart aria-hidden="true" size={18} />
                  Agregar al Carrito
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
