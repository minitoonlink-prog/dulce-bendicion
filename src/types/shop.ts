export type ProductId = string | number;

export interface Product {
  id: ProductId;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  imagen_url: string | null;
  activo: boolean;
  id_categoria?: ProductId | null;
}

export interface CartItem {
  producto: Product;
  cantidad: number;
}
