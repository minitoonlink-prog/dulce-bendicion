import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, ProductId } from "../types/shop";

interface CartState {
  items: CartItem[];
  agregarProducto: (producto: Product) => void;
  eliminarProducto: (productoId: ProductId) => void;
  cambiarCantidad: (productoId: ProductId, cantidad: number) => void;
  limpiarCarrito: () => void;
  calcularTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      agregarProducto: (producto) => {
        if (producto.stock < 1) return;

        set((state) => {
          const itemExistente = state.items.find(
            (item) => String(item.producto.id) === String(producto.id)
          );

          if (itemExistente) {
            return {
              items: state.items.map((item) =>
                String(item.producto.id) === String(producto.id)
                  ? {
                      ...item,
                      producto,
                      cantidad: Math.min(item.cantidad + 1, producto.stock),
                    }
                  : item
              ),
            };
          }

          return { items: [...state.items, { producto, cantidad: 1 }] };
        });
      },

      eliminarProducto: (productoId) =>
        set((state) => ({
          items: state.items.filter(
            (item) => String(item.producto.id) !== String(productoId)
          ),
        })),

      cambiarCantidad: (productoId, cantidad) =>
        set((state) => ({
          items: state.items.flatMap((item) => {
            if (String(item.producto.id) !== String(productoId)) return [item];
            if (cantidad <= 0 || item.producto.stock <= 0) return [];

            return [
              {
                ...item,
                cantidad: Math.min(Math.floor(cantidad), item.producto.stock),
              },
            ];
          }),
        })),

      limpiarCarrito: () => set({ items: [] }),

      calcularTotal: () =>
        get().items.reduce(
          (total, item) => total + item.producto.precio * item.cantidad,
          0
        ),
    }),
    { name: "dulce-bendicion-carrito" }
  )
);
