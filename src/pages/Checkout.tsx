import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { supabase } from "../lib/supabaseClient";
import { useCartStore } from "../store/cartStore";

const esquemaPedido = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre completo."),
  telefono: z.string().trim().min(7, "Ingresa un teléfono válido."),
  direccion: z.string().trim().min(5, "Ingresa la dirección de entrega."),
  observaciones: z.string().trim().max(500, "Máximo 500 caracteres."),
  metodoPago: z.enum(["efectivo", "nequi"]),
});

type DatosPedido = z.infer<typeof esquemaPedido>;
type Configuracion = { clave: string; valor: string };

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function encontrarConfiguracion(
  configuraciones: Configuracion[],
  claves: string[]
): string | null {
  const permitidas = new Set(claves.map((clave) => clave.toLowerCase()));
  const entrada = configuraciones.find((item) =>
    permitidas.has(item.clave.trim().toLowerCase())
  );
  return entrada?.valor.trim() || null;
}

async function cargarConfiguraciones(): Promise<Configuracion[]> {
  const { data, error } = await supabase
    .from("configuracion")
    .select("clave, valor");

  if (error) {
    throw new Error(`No fue posible consultar la configuración: ${error.message}`);
  }
  return (data ?? []) as Configuracion[];
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

export default function Checkout() {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.calcularTotal());
  const cambiarCantidad = useCartStore((state) => state.cambiarCantidad);
  const eliminarProducto = useCartStore((state) => state.eliminarProducto);
  const limpiarCarrito = useCartStore((state) => state.limpiarCarrito);
  const [numeroNequi, setNumeroNequi] = useState("");
  const [cargandoNequi, setCargandoNequi] = useState(false);
  const [errorNequi, setErrorNequi] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorPedido, setErrorPedido] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<DatosPedido>({
    resolver: zodResolver(esquemaPedido),
    defaultValues: {
      nombre: "",
      telefono: "",
      direccion: "",
      observaciones: "",
      metodoPago: "efectivo",
    },
  });

  const metodoPago = watch("metodoPago");

  useEffect(() => {
    let activo = true;

    async function cargarNumeroNequi() {
      setCargandoNequi(true);
      setErrorNequi("");
      try {
        const configuraciones = await cargarConfiguraciones();
        const numero = encontrarConfiguracion(configuraciones, ["nequi_numero"]);
        if (!activo) return;
        if (numero) {
          setNumeroNequi(numero);
        } else {
          setNumeroNequi("");
          setErrorNequi("No se encontró la clave nequi_numero en configuracion.");
        }
      } catch (error) {
        if (activo) setErrorNequi(mensajeDeError(error));
      } finally {
        if (activo) setCargandoNequi(false);
      }
    }

    if (metodoPago === "nequi") void cargarNumeroNequi();
    return () => {
      activo = false;
    };
  }, [metodoPago]);

  async function confirmarPedido(datos: DatosPedido) {
    if (items.length === 0) {
      setErrorPedido("Tu carrito está vacío.");
      return;
    }

    setEnviando(true);
    setErrorPedido("");

    try {
      const configuraciones = await cargarConfiguraciones();
      const numeroWhatsApp = encontrarConfiguracion(configuraciones, [
        "whatsapp_numero",
      ]);
      if (!numeroWhatsApp) {
        throw new Error(
          "No se encontró la clave whatsapp_numero en la tabla configuracion."
        );
      }

      const telefonoWhatsApp = numeroWhatsApp.replace(/\D/g, "");
      if (!telefonoWhatsApp) {
        throw new Error(
          "El número de WhatsApp configurado no es válido. Revisa la tabla configuracion."
        );
      }

      if (datos.metodoPago === "nequi" && !numeroNequi) {
        throw new Error(
          errorNequi || "No se pudo obtener el número de Nequi configurado."
        );
      }

      const { data: pedidoId, error: errorPedido } = await supabase.rpc(
        "crear_pedido_seguro",
        {
          p_nombre: datos.nombre,
          p_telefono: datos.telefono,
          p_direccion: datos.direccion,
          p_total: total,
          p_metodo: datos.metodoPago,
          p_observaciones: datos.observaciones || null,
        }
      );

      if (errorPedido) {
        throw new Error(`No fue posible crear el pedido: ${errorPedido.message}`);
      }
      if (
        typeof pedidoId !== "number" ||
        !Number.isSafeInteger(pedidoId) ||
        pedidoId <= 0
      ) {
        throw new Error(
          "Supabase no devolvió un identificador válido para el pedido."
        );
      }

      const detalles = items.map((item) => ({
        id_pedido: pedidoId,
        id_producto: item.producto.id,
        nombre_producto: item.producto.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
        subtotal: item.producto.precio * item.cantidad,
      }));

      const { error: errorDetalles } = await supabase
        .from("detalle_pedido")
        .insert(detalles);

      if (errorDetalles) {
        throw new Error(
          `El pedido #${pedidoId} se creó, pero no se pudieron guardar sus productos: ${errorDetalles.message}. Contacta a la tienda antes de volver a intentarlo.`
        );
      }

      const textoPedido = [
        "Hola, quiero confirmar mi pedido en Dulce Bendición DB.",
        `Pedido: #${pedidoId}`,
        `Nombre: ${datos.nombre}`,
        `Total: ${formatoCOP.format(total)}`,
        `Dirección: ${datos.direccion}`,
      ].join("\n");

      limpiarCarrito();
      window.location.href = `https://wa.me/${telefonoWhatsApp}?text=${encodeURIComponent(textoPedido)}`;
    } catch (error) {
      setErrorPedido(mensajeDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">Tu carrito</h1>
        <p className="mt-2 text-muted-foreground">
          Revisa tu pedido y completa tus datos de entrega.
        </p>
      </header>

      {items.length === 0 ? (
        <Card className="space-y-4 p-6">
          <p>Tu carrito está vacío.</p>
          <Link to="/" className="font-semibold text-primary underline">
            Ver postres
          </Link>
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-border px-4">
            {items.map((item) => (
              <div
                key={item.producto.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {item.producto.imagen_url && (
                    <img
                      src={item.producto.imagen_url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h2 className="font-bold">{item.producto.nombre}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatoCOP.format(item.producto.precio)} c/u
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Restar ${item.producto.nombre}`}
                    onClick={() =>
                      cambiarCantidad(item.producto.id, item.cantidad - 1)
                    }
                  >
                    −
                  </Button>
                  <span className="min-w-6 text-center" aria-live="polite">
                    {item.cantidad}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Sumar ${item.producto.nombre}`}
                    disabled={item.cantidad >= item.producto.stock}
                    onClick={() =>
                      cambiarCantidad(item.producto.id, item.cantidad + 1)
                    }
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => eliminarProducto(item.producto.id)}
                  >
                    Quitar
                  </Button>
                </div>
                <p className="w-full text-right font-bold sm:w-auto">
                  {formatoCOP.format(item.producto.precio * item.cantidad)}
                </p>
              </div>
            ))}
            <div className="flex justify-between py-4 text-lg font-extrabold">
              <span>Total</span>
              <span>{formatoCOP.format(total)}</span>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <form
              className="space-y-5"
              onSubmit={handleSubmit(confirmarPedido)}
              noValidate
            >
              <h2 className="text-xl font-bold">Datos del pedido</h2>
              <label className="block space-y-1 text-sm font-semibold">
                Nombre completo
                <Input autoComplete="name" {...register("nombre")} />
                {errors.nombre && (
                  <span role="alert" className="text-destructive">
                    {errors.nombre.message}
                  </span>
                )}
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Teléfono
                <Input type="tel" autoComplete="tel" {...register("telefono")} />
                {errors.telefono && (
                  <span role="alert" className="text-destructive">
                    {errors.telefono.message}
                  </span>
                )}
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Dirección de entrega
                <Input
                  autoComplete="street-address"
                  {...register("direccion")}
                />
                {errors.direccion && (
                  <span role="alert" className="text-destructive">
                    {errors.direccion.message}
                  </span>
                )}
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Observaciones
                <textarea
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
                  {...register("observaciones")}
                />
                {errors.observaciones && (
                  <span role="alert" className="text-destructive">
                    {errors.observaciones.message}
                  </span>
                )}
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Método de pago</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" value="efectivo" {...register("metodoPago")} />
                  Efectivo
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="nequi" {...register("metodoPago")} />
                  Transferencia Nequi
                </label>
                {errors.metodoPago && (
                  <span role="alert" className="text-destructive">
                    {errors.metodoPago.message}
                  </span>
                )}
              </fieldset>

              {metodoPago === "nequi" && (
                <div className="rounded-lg bg-secondary p-4 text-sm">
                  {cargandoNequi ? (
                    <p role="status">Consultando número de Nequi...</p>
                  ) : errorNequi ? (
                    <p role="alert" className="text-destructive">
                      {errorNequi}
                    </p>
                  ) : (
                    <p>
                      Envía el pago al número de Nequi:{" "}
                      <strong>{numeroNequi}</strong>
                    </p>
                  )}
                </div>
              )}

              {errorPedido && (
                <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
                  {errorPedido}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={enviando || (metodoPago === "nequi" && cargandoNequi)}
              >
                {enviando ? "Registrando pedido..." : "Confirmar Pedido"}
              </Button>
            </form>
          </Card>
        </>
      )}
    </section>
  );
}
