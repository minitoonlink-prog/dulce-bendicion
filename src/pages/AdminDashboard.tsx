import { useEffect, useState } from "react";
import { BarChart3, CakeSlice, ShoppingBag, TrendingUp } from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabaseClient";

interface PedidoVenta {
  id: number;
  fecha: string;
  total: number | string;
}

interface DetalleVenta {
  id: number;
  id_pedido: number;
  nombre_producto: string;
  cantidad: number;
}

interface ProductoPopular {
  nombre: string;
  cantidad: number;
}

interface VentaDiaria {
  fecha: string;
  etiqueta: string;
  total: number;
}

interface DashboardData {
  ganancias: number;
  pedidos: number;
  productosPopulares: ProductoPopular[];
  ventasSieteDias: VentaDiaria[];
}

const estadosConGanancia = ["tomado", "enviado", "entregado"];
const TAMANO_PAGINA = 1000;
const coloresGrafico = ["#C2966B", "#884C35", "#B52636", "#4B1F11", "#D8B58D"];

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function claveFecha(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function crearFechasSieteDias(): VentaDiaria[] {
  const hoy = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const fecha = new Date(hoy);
    fecha.setHours(0, 0, 0, 0);
    fecha.setDate(fecha.getDate() - (6 - index));
    return {
      fecha: claveFecha(fecha),
      etiqueta: fecha.toLocaleDateString("es-CO", {
        weekday: "short",
        day: "numeric",
      }),
      total: 0,
    };
  });
}

async function cargarPedidosDeVenta(): Promise<PedidoVenta[]> {
  const pedidos: PedidoVenta[] = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, fecha, total")
      .in("estado", estadosConGanancia)
      .order("id", { ascending: true })
      .range(inicio, inicio + TAMANO_PAGINA - 1);

    if (error) {
      throw new Error(`No se pudieron consultar las ventas: ${error.message}`);
    }

    const pagina = (data ?? []) as PedidoVenta[];
    pedidos.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) return pedidos;
    inicio += TAMANO_PAGINA;
  }
}

async function cargarDetallesDeVenta(
  pedidos: PedidoVenta[]
): Promise<DetalleVenta[]> {
  const detalles: DetalleVenta[] = [];
  const tamanoGrupoPedidos = 100;

  for (let inicioPedidos = 0; inicioPedidos < pedidos.length; inicioPedidos += tamanoGrupoPedidos) {
    const idsPedidos = pedidos
      .slice(inicioPedidos, inicioPedidos + tamanoGrupoPedidos)
      .map((pedido) => pedido.id);
    let inicioDetalles = 0;

    while (true) {
      const { data, error } = await supabase
        .from("detalle_pedido")
        .select("id, id_pedido, nombre_producto, cantidad")
        .in("id_pedido", idsPedidos)
        .order("id_pedido", { ascending: true })
        .order("id", { ascending: true })
        .range(inicioDetalles, inicioDetalles + TAMANO_PAGINA - 1);

      if (error) {
        throw new Error(
          `No se pudieron consultar los postres vendidos: ${error.message}`
        );
      }

      const pagina = (data ?? []) as DetalleVenta[];
      detalles.push(...pagina);
      if (pagina.length < TAMANO_PAGINA) break;
      inicioDetalles += TAMANO_PAGINA;
    }
  }

  return detalles;
}

function calcularVentasSieteDias(pedidos: PedidoVenta[]): VentaDiaria[] {
  const fechas = crearFechasSieteDias();
  const porFecha = new Map(fechas.map((dia) => [dia.fecha, dia]));

  for (const pedido of pedidos) {
    const fechaPedido = new Date(pedido.fecha);
    if (Number.isNaN(fechaPedido.getTime())) continue;
    const dia = porFecha.get(claveFecha(fechaPedido));
    if (dia) dia.total += Number(pedido.total) || 0;
  }

  return fechas;
}

function calcularProductosPopulares(detalles: DetalleVenta[]): ProductoPopular[] {
  const cantidades = new Map<string, number>();
  for (const detalle of detalles) {
    cantidades.set(
      detalle.nombre_producto,
      (cantidades.get(detalle.nombre_producto) ?? 0) + Number(detalle.cantidad)
    );
  }

  return [...cantidades.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre))
    .slice(0, 5);
}

export default function AdminDashboard() {
  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    async function cargarDashboard() {
      setCargando(true);
      setError("");
      try {
        const [
          { count: cantidadPedidos, error: errorConteo },
          pedidosVenta,
        ] = await Promise.all([
          supabase.from("pedidos").select("id", { count: "exact", head: true }),
          cargarPedidosDeVenta(),
        ]);

        if (errorConteo) {
          throw new Error(
            `No se pudo contar los pedidos: ${errorConteo.message}`
          );
        }

        const detalles = await cargarDetallesDeVenta(pedidosVenta);
        if (!activo) return;

        setDatos({
          ganancias: pedidosVenta.reduce(
            (suma, pedido) => suma + (Number(pedido.total) || 0),
            0
          ),
          pedidos: cantidadPedidos ?? 0,
          productosPopulares: calcularProductosPopulares(detalles),
          ventasSieteDias: calcularVentasSieteDias(pedidosVenta),
        });
      } catch (errorCarga) {
        if (activo) {
          setError(
            errorCarga instanceof Error
              ? errorCarga.message
              : "No fue posible cargar el Dashboard."
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    void cargarDashboard();
    return () => {
      activo = false;
    };
  }, []);

  if (cargando) {
    return <p role="status">Calculando ganancias y ventas...</p>;
  }
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive p-4 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }
  if (!datos) return null;

  const postreEstrella = datos.productosPopulares[0];

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="rounded-xl bg-primary/15 p-3 text-canela">
          <BarChart3 aria-hidden="true" size={24} />
        </span>
        <div>
          <h2 className="text-2xl font-bold">Resumen de ventas</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores basados en pedidos activos y completados.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="flex items-center gap-4 border-caramelo/25 p-5 shadow-sm">
          <span className="rounded-xl bg-primary/15 p-3 text-canela">
            <TrendingUp aria-hidden="true" size={24} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted-foreground">
              Ganancias confirmadas
            </p>
            <p className="mt-1 break-words text-2xl font-bold text-chocolate">
              {formatoCOP.format(datos.ganancias)}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-caramelo/25 p-5 shadow-sm">
          <span className="rounded-xl bg-primary/15 p-3 text-canela">
            <ShoppingBag aria-hidden="true" size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              Pedidos realizados
            </p>
            <p className="mt-1 text-3xl font-bold text-chocolate">
              {datos.pedidos.toLocaleString("es-CO")}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-caramelo/25 p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <span className="rounded-xl bg-primary/15 p-3 text-canela">
            <CakeSlice aria-hidden="true" size={24} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted-foreground">
              Postre estrella
            </p>
            <p className="mt-1 truncate text-xl font-bold text-chocolate">
              {postreEstrella?.nombre ?? "Aún sin ventas"}
            </p>
            {postreEstrella && (
              <p className="text-sm text-muted-foreground">
                {postreEstrella.cantidad} vendidos
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="min-w-0 p-4 sm:p-6 xl:col-span-3">
          <h3 className="mb-1 text-lg font-bold">Ventas de los últimos 7 días</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Pedidos tomados, enviados y entregados
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={datos.ventasSieteDias}
                margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
              >
                <XAxis
                  dataKey="etiqueta"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6F5548", fontSize: 12 }}
                />
                <YAxis
                  width={68}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6F5548", fontSize: 11 }}
                  tickFormatter={(valor: number) =>
                    new Intl.NumberFormat("es-CO", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(valor)
                  }
                />
                <Tooltip
                  formatter={(valor) => [
                    formatoCOP.format(Number(valor)),
                    "Ventas",
                  ]}
                  labelFormatter={(_label, payload) =>
                    payload[0]?.payload?.fecha ?? ""
                  }
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#C2966B",
                    backgroundColor: "#FBF3E1",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Ventas"
                  stroke="#884C35"
                  strokeWidth={3}
                  dot={{ fill: "#C2966B", stroke: "#884C35", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 7, fill: "#B52636" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6 xl:col-span-2">
          <h3 className="mb-1 text-lg font-bold">Postres más vendidos</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Unidades en pedidos confirmados
          </p>
          {datos.productosPopulares.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
              Aún no hay productos vendidos en pedidos confirmados.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={datos.productosPopulares}
                    dataKey="cantidad"
                    nameKey="nombre"
                    cx="50%"
                    cy="48%"
                    outerRadius="72%"
                    paddingAngle={3}
                    labelLine={false}
                  >
                    {datos.productosPopulares.map((producto, index) => (
                      <Cell
                        key={producto.nombre}
                        fill={coloresGrafico[index % coloresGrafico.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(valor, _name, item) => [
                      `${Number(valor)} unidades`,
                      item.payload.nombre,
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#C2966B",
                      backgroundColor: "#FBF3E1",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {datos.productosPopulares.map((producto, index) => (
              <li
                key={producto.nombre}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      coloresGrafico[index % coloresGrafico.length],
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{producto.nombre}</span>
                <span className="shrink-0 font-bold">{producto.cantidad}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
