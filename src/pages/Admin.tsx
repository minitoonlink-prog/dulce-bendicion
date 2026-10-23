import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";
import {
  ProductEditor,
  type ProductCategory,
} from "../components/admin/ProductEditor";
import { supabase } from "../lib/supabaseClient";
import type { Product } from "../types/shop";

const AdminDashboard = lazy(() => import("./AdminDashboard"));

type EstadoPedido = "pendiente" | "tomado" | "enviado" | "entregado";

interface PedidoAdmin {
  id: number;
  fecha: string;
  nombre_cliente: string;
  telefono_cliente: string;
  direccion_entrega: string;
  total: number;
  metodo_pago: string;
  estado: string;
}

interface DetallePedidoAdmin {
  id: number;
  id_pedido: number;
  nombre_producto: string;
  cantidad: number;
  subtotal: number;
}

interface ProductDraft {
  precio: string;
  stock: string;
}

const estadosPedido: { value: EstadoPedido; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "tomado", label: "Tomado" },
  { value: "enviado", label: "Enviado" },
  { value: "entregado", label: "Entregado" },
];

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function mensajeDeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado.";
}

export default function Admin() {
  const navigate = useNavigate();
  const [pestana, setPestana] = useState<
    "dashboard" | "pedidos" | "productos"
  >("dashboard");
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [detallesPedidos, setDetallesPedidos] = useState<
    Record<number, DetallePedidoAdmin[]>
  >({});
  const [productos, setProductos] = useState<Product[]>([]);
  const [borradoresProductos, setBorradoresProductos] = useState<
    Record<string, ProductDraft>
  >({});
  const [categorias, setCategorias] = useState<ProductCategory[]>([]);
  const [productoEditando, setProductoEditando] = useState<
    Product | null | undefined
  >(undefined);
  const [cargando, setCargando] = useState(true);
  const [pedidoActualizando, setPedidoActualizando] = useState<number | null>(
    null
  );
  const [pedidoEliminando, setPedidoEliminando] = useState<number | null>(null);
  const [productoGuardando, setProductoGuardando] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");
    const haceTresDias = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      resultadoPedidos,
      resultadoProductos,
      resultadoCategorias,
    ] = await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "id, fecha, nombre_cliente, telefono_cliente, direccion_entrega, total, metodo_pago, estado"
        )
        .gte("fecha", haceTresDias)
        .order("fecha", { ascending: false }),
      supabase
        .from("productos")
        .select(
          "id, nombre, descripcion, precio, stock, imagen_url, activo, id_categoria"
        )
        .order("nombre"),
      supabase
        .from("categorias")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
    ]);

    if (
      resultadoPedidos.error ||
      resultadoProductos.error ||
      resultadoCategorias.error
    ) {
      const errores = [
        resultadoPedidos.error &&
          `pedidos: ${resultadoPedidos.error.message}`,
        resultadoProductos.error &&
          `productos: ${resultadoProductos.error.message}`,
        resultadoCategorias.error &&
          `categorias: ${resultadoCategorias.error.message}`,
      ].filter(Boolean);
      setError(`No fue posible cargar los datos (${errores.join("; ")}).`);
      setCargando(false);
      return;
    }

    const listaProductos = (resultadoProductos.data ?? []) as Product[];
    const listaPedidos = (resultadoPedidos.data ?? []) as PedidoAdmin[];
    const resultadoDetalles =
      listaPedidos.length > 0
        ? await supabase
            .from("detalle_pedido")
            .select("id, id_pedido, nombre_producto, cantidad, subtotal")
            .in(
              "id_pedido",
              listaPedidos.map((pedido) => pedido.id)
            )
        : { data: [], error: null };

    if (resultadoDetalles.error) {
      setError(
        `No fue posible cargar los detalles de los pedidos: ${resultadoDetalles.error.message}`
      );
      setCargando(false);
      return;
    }

    setCategorias((resultadoCategorias.data ?? []) as ProductCategory[]);
    setPedidos(listaPedidos);
    setDetallesPedidos(
      ((resultadoDetalles.data ?? []) as DetallePedidoAdmin[]).reduce<
        Record<number, DetallePedidoAdmin[]>
      >((grupos, detalle) => {
        grupos[detalle.id_pedido] ??= [];
        grupos[detalle.id_pedido].push(detalle);
        return grupos;
      }, {})
    );
    setProductos(listaProductos);
    setBorradoresProductos(
      Object.fromEntries(
        listaProductos.map((producto) => [
          String(producto.id),
          { precio: String(producto.precio), stock: String(producto.stock) },
        ])
      )
    );
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  async function cambiarEstado(pedidoId: number, estado: EstadoPedido) {
    setPedidoActualizando(pedidoId);
    setError("");
    setMensaje("");

    const { error: errorActualizacion } = await supabase
      .from("pedidos")
      .update({ estado })
      .eq("id", pedidoId);

    if (errorActualizacion) {
      setError(
        `No se pudo actualizar el pedido #${pedidoId}: ${errorActualizacion.message}`
      );
    } else {
      setPedidos((actuales) =>
        actuales.map((pedido) =>
          pedido.id === pedidoId ? { ...pedido, estado } : pedido
        )
      );
      setMensaje(`Estado del pedido #${pedidoId} actualizado.`);
    }
    setPedidoActualizando(null);
  }

  async function eliminarPedido(pedido: PedidoAdmin) {
    const confirmado = window.confirm(
      `¿Estás seguro de que quieres eliminar el pedido #${pedido.id} de ${pedido.nombre_cliente}? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setPedidoEliminando(pedido.id);
    setError("");
    setMensaje("");
    try {
      const { error: errorEliminacion } = await supabase
        .from("pedidos")
        .delete()
        .eq("id", pedido.id);

      if (errorEliminacion) {
        throw new Error(errorEliminacion.message);
      }

      setPedidos((actuales) =>
        actuales.filter((actual) => actual.id !== pedido.id)
      );
      setDetallesPedidos((actuales) => {
        const siguientes = { ...actuales };
        delete siguientes[pedido.id];
        return siguientes;
      });
      setMensaje(`El pedido #${pedido.id} fue eliminado.`);
    } catch (errorEliminacion) {
      setError(
        `No se pudo eliminar el pedido #${pedido.id}: ${mensajeDeError(errorEliminacion)}`
      );
    } finally {
      setPedidoEliminando(null);
    }
  }

  function notificarPedidoWhatsApp(pedido: PedidoAdmin) {
    const telefono = pedido.telefono_cliente.replace(/\D/g, "");
    if (!telefono) {
      setError(`El pedido #${pedido.id} no tiene un teléfono válido.`);
      return;
    }

    const texto = `Hola ${pedido.nombre_cliente}, tu pedido #${pedido.id} en Dulce Bendición ha sido tomado con éxito y ya está en preparación. ¡Gracias por tu compra!`;
    const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(texto)}`;
    const ventana = window.open(url, "_blank", "noopener,noreferrer");
    if (!ventana) {
      setError(
        "El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes e inténtalo de nuevo."
      );
      return;
    }

    setError("");
    setMensaje(`Se abrió WhatsApp para notificar el pedido #${pedido.id}.`);
  }

  function guardarProducto(productoGuardado: Product) {
    setProductos((actuales) => {
      const yaExiste = actuales.some(
        (producto) => String(producto.id) === String(productoGuardado.id)
      );
      return yaExiste
        ? actuales.map((producto) =>
            String(producto.id) === String(productoGuardado.id)
              ? productoGuardado
              : producto
          )
        : [...actuales, productoGuardado].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, "es")
          );
    });
    setBorradoresProductos((actuales) => ({
      ...actuales,
      [String(productoGuardado.id)]: {
        precio: String(productoGuardado.precio),
        stock: String(productoGuardado.stock),
      },
    }));
    setProductoEditando(undefined);
    setError("");
    setMensaje(
      `Producto "${productoGuardado.nombre}" guardado correctamente.`
    );
  }

  function cambiarBorradorProducto(
    producto: Product,
    cambio: Partial<ProductDraft>
  ) {
    setBorradoresProductos((actuales) => ({
      ...actuales,
      [String(producto.id)]: {
        ...actuales[String(producto.id)],
        ...cambio,
      },
    }));
  }

  async function guardarPrecioYStock(producto: Product) {
    const borrador = borradoresProductos[String(producto.id)];
    const precio = Number(borrador?.precio);
    const stock = Number(borrador?.stock);
    if (!Number.isFinite(precio) || precio < 0) {
      setError(`Ingresa un precio válido para ${producto.nombre}.`);
      return;
    }
    if (!Number.isSafeInteger(stock) || stock < 0) {
      setError(`El stock de ${producto.nombre} debe ser un entero igual o mayor que cero.`);
      return;
    }

    const id = String(producto.id);
    setProductoGuardando(id);
    setError("");
    setMensaje("");
    const { error: errorActualizacion } = await supabase
      .from("productos")
      .update({ precio, stock })
      .eq("id", producto.id);

    if (errorActualizacion) {
      setError(
        `No se pudo guardar ${producto.nombre}: ${errorActualizacion.message}`
      );
    } else {
      setProductos((actuales) =>
        actuales.map((actual) =>
          String(actual.id) === id ? { ...actual, precio, stock } : actual
        )
      );
      setMensaje(`${producto.nombre}: precio y stock guardados.`);
    }
    setProductoGuardando(null);
  }

  async function cerrarSesion() {
    setCerrandoSesion(true);
    setError("");
    try {
      const { error: errorAuth } = await supabase.auth.signOut();
      if (errorAuth) {
        setError(`No fue posible cerrar la sesión: ${errorAuth.message}`);
        return;
      }
      navigate("/login", { replace: true });
    } catch (errorAuth) {
      setError(
        errorAuth instanceof Error
          ? `No fue posible cerrar la sesión: ${errorAuth.message}`
          : "Ocurrió un error inesperado al cerrar sesión."
      );
    } finally {
      setCerrandoSesion(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Panel de administrador</h1>
          <p className="mt-1 text-muted-foreground">
            Administra pedidos, precios e inventario.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          onClick={cerrarSesion}
          disabled={cerrandoSesion}
        >
          {cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión"}
        </Button>
      </header>

      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Secciones del administrador">
        <button
          id="tab-dashboard"
          type="button"
          role="tab"
          aria-selected={pestana === "dashboard"}
          aria-controls="panel-dashboard"
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            pestana === "dashboard"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setPestana("dashboard")}
        >
          <BarChart3 aria-hidden="true" size={17} />
          Dashboard
        </button>
        <button
          id="tab-pedidos"
          type="button"
          role="tab"
          aria-selected={pestana === "pedidos"}
          aria-controls="panel-pedidos"
          className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            pestana === "pedidos"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setPestana("pedidos")}
        >
          Pedidos
        </button>
        <button
          id="tab-productos"
          type="button"
          role="tab"
          aria-selected={pestana === "productos"}
          aria-controls="panel-productos"
          className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            pestana === "productos"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setPestana("productos")}
        >
          Productos (Stock)
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="rounded-lg border border-border bg-secondary p-4 text-sm">
          {mensaje}
        </p>
      )}
      {pestana === "dashboard" ? (
        <div
          id="panel-dashboard"
          role="tabpanel"
          aria-labelledby="tab-dashboard"
          className="min-h-64"
        >
          <Suspense fallback={<p role="status">Cargando Dashboard...</p>}>
            <AdminDashboard />
          </Suspense>
        </div>
      ) : cargando ? (
        <p role="status">Cargando información del administrador...</p>
      ) : pestana === "pedidos" ? (
        <Card
          id="panel-pedidos"
          role="tabpanel"
          aria-labelledby="tab-pedidos"
          className="p-4 sm:p-6"
        >
          <h2 className="mb-4 text-xl font-bold">Pedidos recientes</h2>
          {pedidos.length === 0 ? (
            <p className="text-muted-foreground">Todavía no hay pedidos.</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidos.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell className="font-semibold">#{pedido.id}</TableCell>
                        <TableCell>
                          {pedido.fecha
                            ? new Date(pedido.fecha).toLocaleString("es-CO")
                            : "—"}
                        </TableCell>
                        <TableCell>{pedido.nombre_cliente}</TableCell>
                        <TableCell>{pedido.telefono_cliente}</TableCell>
                        <TableCell>{formatoCOP.format(Number(pedido.total))}</TableCell>
                        <TableCell className="capitalize">{pedido.metodo_pago}</TableCell>
                        <TableCell>
                          <Select
                            aria-label={`Estado del pedido ${pedido.id}`}
                            className="min-w-36"
                            value={
                              estadosPedido.some(
                                (estado) => estado.value === pedido.estado
                              )
                                ? pedido.estado
                                : "pendiente"
                            }
                            disabled={pedidoActualizando === pedido.id}
                            onChange={(event) =>
                              void cambiarEstado(
                                pedido.id,
                                event.target.value as EstadoPedido
                              )
                            }
                          >
                            {estadosPedido.map((estado) => (
                              <option key={estado.value} value={estado.value}>
                                {estado.label}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="whitespace-nowrap"
                              onClick={() => notificarPedidoWhatsApp(pedido)}
                            >
                              <MessageCircle aria-hidden="true" size={16} />
                              Notificar
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              aria-label={`Eliminar pedido ${pedido.id}`}
                              title={`Eliminar pedido ${pedido.id}`}
                              disabled={pedidoEliminando === pedido.id}
                              onClick={() => void eliminarPedido(pedido)}
                            >
                              <Trash2 aria-hidden="true" size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4 md:hidden">
                {pedidos.map((pedido) => (
                  <Card key={pedido.id} className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-muted-foreground">
                          Pedido #{pedido.id}
                        </p>
                        <h3 className="break-words text-lg font-extrabold">
                          {pedido.nombre_cliente}
                        </h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-bold capitalize">
                        {pedido.metodo_pago}
                      </span>
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt className="font-semibold text-muted-foreground">Teléfono</dt>
                        <dd>
                          <a
                            className="font-semibold text-primary underline"
                            href={`tel:${pedido.telefono_cliente}`}
                          >
                            {pedido.telefono_cliente}
                          </a>
                        </dd>
                      </div>
                      <div className="space-y-1">
                        <dt className="font-semibold text-muted-foreground">
                          Dirección de entrega
                        </dt>
                        <dd className="break-words">
                          {pedido.direccion_entrega || "No especificada"}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt className="font-semibold text-muted-foreground">Total</dt>
                        <dd className="text-lg font-extrabold">
                          {formatoCOP.format(Number(pedido.total))}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt className="font-semibold text-muted-foreground">Fecha</dt>
                        <dd>
                          {pedido.fecha
                            ? new Date(pedido.fecha).toLocaleString("es-CO")
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <details className="rounded-lg border border-border p-3">
                      <summary className="cursor-pointer py-1 font-bold">
                        Ver postres ({detallesPedidos[pedido.id]?.length ?? 0})
                      </summary>
                      <ul className="mt-3 space-y-2 text-sm">
                        {(detallesPedidos[pedido.id] ?? []).map((detalle) => (
                          <li
                            key={detalle.id}
                            className="flex justify-between gap-3"
                          >
                            <span className="break-words">
                              {detalle.nombre_producto} × {detalle.cantidad}
                            </span>
                            <span className="shrink-0 font-semibold">
                              {formatoCOP.format(Number(detalle.subtotal))}
                            </span>
                          </li>
                        ))}
                        {!detallesPedidos[pedido.id]?.length && (
                          <li className="text-muted-foreground">
                            No hay detalles disponibles para este pedido.
                          </li>
                        )}
                      </ul>
                    </details>
                    <label className="block space-y-2 text-sm font-bold">
                      Estado del pedido
                      <Select
                        aria-label={`Estado del pedido ${pedido.id}`}
                        className="min-h-12 text-base"
                        value={
                          estadosPedido.some(
                            (estado) => estado.value === pedido.estado
                          )
                            ? pedido.estado
                            : "pendiente"
                        }
                        disabled={pedidoActualizando === pedido.id}
                        onChange={(event) =>
                          void cambiarEstado(
                            pedido.id,
                            event.target.value as EstadoPedido
                          )
                        }
                      >
                        {estadosPedido.map((estado) => (
                          <option key={estado.value} value={estado.value}>
                            {estado.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-12 w-full"
                        onClick={() => notificarPedidoWhatsApp(pedido)}
                      >
                        <MessageCircle aria-hidden="true" size={19} />
                        Notificar por WhatsApp
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="min-h-12 w-full"
                        disabled={pedidoEliminando === pedido.id}
                        onClick={() => void eliminarPedido(pedido)}
                      >
                        <Trash2 aria-hidden="true" size={19} />
                        {pedidoEliminando === pedido.id
                          ? "Eliminando..."
                          : "Eliminar pedido"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card
          id="panel-productos"
          role="tabpanel"
          aria-labelledby="tab-productos"
          className="p-4 sm:p-6"
        >
          <h2 className="mb-4 text-xl font-bold">Precios e inventario</h2>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {productos.length} producto{productos.length === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              className="min-h-12 w-full sm:w-auto"
              onClick={() => {
                setError("");
                setMensaje("");
                setProductoEditando(null);
              }}
            >
              Agregar Nuevo Postre
            </Button>
          </div>
          {productos.length === 0 ? (
            <p className="text-muted-foreground">
              No hay productos registrados. Puedes agregar el primero.
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell className="min-w-52">
                          <div className="flex items-center gap-3">
                            {producto.imagen_url ? (
                              <img
                                src={producto.imagen_url}
                                alt=""
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-secondary" />
                            )}
                            <span className="font-semibold">{producto.nombre}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {categorias.find(
                            (categoria) =>
                              String(categoria.id) ===
                              String(producto.id_categoria)
                          )?.nombre ?? "Sin categoría"}
                        </TableCell>
                        <TableCell>
                          {formatoCOP.format(Number(producto.precio))}
                        </TableCell>
                        <TableCell>{producto.stock}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setError("");
                              setMensaje("");
                              setProductoEditando(producto);
                            }}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4 md:hidden">
                {productos.map((producto) => {
                  const id = String(producto.id);
                  const guardandoProducto = productoGuardando === id;
                  return (
                    <Card key={producto.id} className="space-y-4 p-4">
                      <div className="flex items-center gap-3">
                        {producto.imagen_url ? (
                          <img
                            src={producto.imagen_url}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="h-20 w-20 shrink-0 rounded-xl bg-secondary" />
                        )}
                        <div className="min-w-0">
                          <h3 className="break-words text-lg font-extrabold">
                            {producto.nombre}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {categorias.find(
                              (categoria) =>
                                String(categoria.id) ===
                                String(producto.id_categoria)
                            )?.nombre ?? "Sin categoría"}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <label className="space-y-1 text-sm font-bold">
                          Precio (COP)
                          <Input
                            aria-label={`Precio de ${producto.nombre}`}
                            className="min-h-12 text-base"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={borradoresProductos[id]?.precio ?? ""}
                            onChange={(event) =>
                              cambiarBorradorProducto(producto, {
                                precio: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="space-y-1 text-sm font-bold">
                          Stock disponible
                          <Input
                            aria-label={`Stock de ${producto.nombre}`}
                            className="min-h-12 text-base"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            value={borradoresProductos[id]?.stock ?? ""}
                            onChange={(event) =>
                              cambiarBorradorProducto(producto, {
                                stock: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          className="min-h-12 w-full"
                          disabled={guardandoProducto}
                          onClick={() => void guardarPrecioYStock(producto)}
                        >
                          {guardandoProducto ? "Guardando..." : "Guardar precio y stock"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-12 w-full"
                          onClick={() => {
                            setError("");
                            setMensaje("");
                            setProductoEditando(producto);
                          }}
                        >
                          Editar foto y datos
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      )}
      {productoEditando !== undefined && (
        <ProductEditor
          key={productoEditando ? String(productoEditando.id) : "nuevo"}
          product={productoEditando}
          categories={categorias}
          onClose={() => setProductoEditando(undefined)}
          onSaved={guardarProducto}
        />
      )}
    </section>
  );
}
