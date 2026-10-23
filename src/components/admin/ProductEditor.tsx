import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import imageCompression from "browser-image-compression";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { supabase } from "../../lib/supabaseClient";
import type { Product, ProductId } from "../../types/shop";

export interface ProductCategory {
  id: ProductId;
  nombre: string;
}

interface ProductFormValues {
  nombre: string;
  descripcion: string;
  precio: string;
  stock: string;
  id_categoria: string;
}

interface ProductEditorProps {
  product: Product | null;
  categories: ProductCategory[];
  onClose: () => void;
  onSaved: (product: Product) => void;
}

const esquemaComun = {
  nombre: z.string().trim().min(2, "Escribe un nombre de al menos 2 caracteres."),
  descripcion: z.string().max(1000, "Máximo 1000 caracteres."),
  precio: z
    .string()
    .trim()
    .min(1, "Ingresa el precio.")
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
      message: "Ingresa un precio válido igual o mayor que cero.",
    }),
  stock: z
    .string()
    .trim()
    .min(1, "Ingresa el stock.")
    .refine(
      (value) =>
        Number.isSafeInteger(Number(value)) && Number(value) >= 0,
      "El stock debe ser un entero igual o mayor que cero."
    ),
    id_categoria: z.string().min(1, "Selecciona una categoría."),
};

const esquemaProducto = z.object(esquemaComun);

function mensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado al guardar el producto.";
}

function extensionDeImagen(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  throw new Error("Formato de imagen no permitido.");
}

export function ProductEditor({
  product,
  categories,
  onClose,
  onSaved,
}: ProductEditorProps) {
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [errorImagen, setErrorImagen] = useState("");
  const [vistaPrevia, setVistaPrevia] = useState("");
  const esNuevo = product === null;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(esquemaProducto),
    defaultValues: {
      nombre: product?.nombre ?? "",
      descripcion: product?.descripcion ?? "",
      precio: product ? String(product.precio) : "",
      stock: product ? String(product.stock) : "0",
      id_categoria:
        product?.id_categoria === null || product?.id_categoria === undefined
          ? ""
          : String(product.id_categoria),
    },
  });

  useEffect(() => {
    if (!imagen) {
      setVistaPrevia("");
      return;
    }

    const url = URL.createObjectURL(imagen);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [imagen]);

  async function guardar(values: ProductFormValues, archivo: File | null) {
    if (esNuevo && !archivo) {
      setErrorImagen("Selecciona una foto para el nuevo postre.");
      return;
    }
    if (
      archivo &&
      !["image/jpeg", "image/png", "image/webp"].includes(archivo.type)
    ) {
      setErrorImagen("La imagen debe estar en formato JPG, PNG o WebP.");
      return;
    }
    if (archivo && archivo.size === 0) {
      setErrorImagen("El archivo seleccionado está vacío.");
      return;
    }
    if (archivo && archivo.size > 20 * 1024 * 1024) {
      setErrorImagen("La imagen original no debe superar 20 MB.");
      return;
    }

    setGuardando(true);
    setErrorGuardado("");
    let rutaSubida: string | null = null;

    try {
      let imagenUrl = product?.imagen_url ?? null;
      if (archivo) {
        const archivoComprimido = await imageCompression(archivo, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1000,
          useWebWorker: true,
          fileType: archivo.type,
        });
        if (archivoComprimido.size > 500 * 1024) {
          throw new Error(
            "No fue posible comprimir la imagen por debajo de 500 KB. Selecciona una imagen más pequeña."
          );
        }
        const extension = extensionDeImagen(archivoComprimido);
        const nombreSinExtension = archivo.name.replace(/\.[^.]+$/, "");
        const archivoParaSubir = new File(
          [archivoComprimido],
          `${nombreSinExtension}.${extension}`,
          {
            type: archivoComprimido.type,
            lastModified: Date.now(),
          }
        );
        rutaSubida = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

        const {
          data: { session },
          error: errorSesion,
        } = await supabase.auth.getSession();
        if (errorSesion) {
          throw new Error(
            `No fue posible verificar la sesión antes de subir la imagen: ${errorSesion.message}`
          );
        }
        console.log("Sesión activa:", Boolean(session));
        console.log("Archivo comprimido:", {
          name: archivoParaSubir.name,
          type: archivoParaSubir.type,
          size: archivoParaSubir.size,
        });

        if (!session) {
          throw new Error(
            "La sesión expiró. Vuelve a iniciar sesión antes de subir imágenes."
          );
        }

        const { error: errorSubida } = await supabase.storage
          .from("productos")
          .upload(rutaSubida, archivoParaSubir, {
            contentType: archivoParaSubir.type,
            upsert: false,
          });

        if (errorSubida) {
          throw new Error(
            `No fue posible subir la imagen: ${errorSubida.message}`
          );
        }

        const { data: imagenPublica } = supabase.storage
          .from("productos")
          .getPublicUrl(rutaSubida);
        if (!imagenPublica.publicUrl) {
          throw new Error(
            "La imagen se subió, pero Supabase no devolvió una URL pública."
          );
        }
        imagenUrl = imagenPublica.publicUrl;
      }

      const valoresProducto = {
        nombre: values.nombre.trim(),
        descripcion: values.descripcion.trim() || null,
        precio: Number(values.precio),
        stock: Number(values.stock),
        id_categoria: values.id_categoria,
        imagen_url: imagenUrl,
      };

      const query = product
        ? supabase
            .from("productos")
            .update(valoresProducto)
            .eq("id", product.id)
        : supabase.from("productos").insert({
            ...valoresProducto,
            activo: true,
          });

      const { data, error } = await query
        .select(
          "id, nombre, descripcion, precio, stock, imagen_url, activo, id_categoria"
        )
        .single();

      if (error) {
        throw new Error(
          `No fue posible guardar el producto: ${error.message}`
        );
      }
      if (!data) {
        throw new Error("Supabase no devolvió el producto guardado.");
      }

      onSaved(data as Product);
    } catch (error) {
      let errorFinal = mensajeError(error);
      if (rutaSubida) {
        try {
          const { error: errorLimpieza } = await supabase.storage
            .from("productos")
            .remove([rutaSubida]);
          if (errorLimpieza) {
            errorFinal += ` Además, no se pudo limpiar la imagen recién subida: ${errorLimpieza.message}.`;
          }
        } catch (errorLimpieza) {
          errorFinal += ` Además, falló la limpieza de la imagen temporal: ${mensajeError(errorLimpieza)}.`;
        }
      }
      console.error("Error al guardar producto o subir imagen:", errorFinal);
      setErrorGuardado(errorFinal);
      window.alert(errorFinal);
    } finally {
      setGuardando(false);
    }
  }

  function cerrarConEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !guardando) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !guardando) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-editor-title"
        className="my-auto max-h-[100dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-xl sm:p-7"
        onKeyDown={cerrarConEscape}
      >
        <h2 id="product-editor-title" className="text-2xl font-extrabold">
          {esNuevo ? "Agregar nuevo postre" : `Editar ${product.nombre}`}
        </h2>
        <form
          className="mt-5 space-y-5"
          onSubmit={handleSubmit((values) => guardar(values, imagen))}
          noValidate
        >
          <label className="block space-y-1 text-sm font-semibold">
            Nombre
            <Input className="min-h-12" {...register("nombre")} />
            {errors.nombre && (
              <span role="alert" className="block text-destructive">
                {errors.nombre.message}
              </span>
            )}
          </label>

          <label className="block space-y-1 text-sm font-semibold">
            Descripción
            <textarea
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
              {...register("descripcion")}
            />
            {errors.descripcion && (
              <span role="alert" className="block text-destructive">
                {errors.descripcion.message}
              </span>
            )}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-semibold">
              Precio (COP)
              <Input
                className="min-h-12 text-base"
                type="number"
                min="0"
                step="any"
                {...register("precio")}
              />
              {errors.precio && (
                <span role="alert" className="block text-destructive">
                  {errors.precio.message}
                </span>
              )}
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              Stock
              <Input
                className="min-h-12 text-base"
                type="number"
                min="0"
                step="1"
                {...register("stock")}
              />
              {errors.stock && (
                <span role="alert" className="block text-destructive">
                  {errors.stock.message}
                </span>
              )}
            </label>
          </div>

          <label className="block space-y-1 text-sm font-semibold">
            Categoría
            <Select className="min-h-12 text-base" {...register("id_categoria")}>
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.nombre}
                </option>
              ))}
            </Select>
            {errors.id_categoria && (
              <span role="alert" className="block text-destructive">
                {errors.id_categoria.message}
              </span>
            )}
          </label>

          <div className="space-y-2">
            <label
              htmlFor="product-image"
              className="block text-sm font-semibold"
            >
              Foto {esNuevo ? "" : "(opcional para conservar la actual)"}
            </label>
            <input
              id="product-image"
              type="file"
              accept="image/*"
              disabled={guardando}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  setImagen(file);
                  setErrorImagen("");
                  console.log("Archivo seleccionado:", file);
                }
              }}
              className="block min-h-14 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-semibold"
            />
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {imagen
                ? `Archivo listo: ${imagen.name} (${(imagen.size / 1024).toFixed(1)} KB)`
                : "Ningún archivo seleccionado"}
            </p>
            {!imagen && product?.imagen_url && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <img
                  src={product.imagen_url}
                  alt={`Foto actual de ${product.nombre}`}
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
                <span>Imagen actual</span>
              </div>
            )}
            {vistaPrevia && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <img
                  src={vistaPrevia}
                  alt={`Vista previa de ${imagen?.name ?? "la imagen seleccionada"}`}
                  className="h-20 w-20 rounded-lg border border-border object-cover"
                />
                <span>Vista previa</span>
              </div>
            )}
            {errorImagen && (
              <p role="alert" className="text-sm text-destructive">
                {errorImagen}
              </p>
            )}
          </div>

          {categories.length === 0 && (
            <p role="alert" className="text-sm text-destructive">
              No hay categorías activas. Agrega una categoría en Supabase antes
              de guardar un producto.
            </p>
          )}
          {errorGuardado && (
            <p
              role="alert"
              className="rounded-lg border border-destructive p-3 text-sm text-destructive"
            >
              {errorGuardado}
            </p>
          )}

          <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-3 border-t border-border bg-card px-5 pb-1 pt-4 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 sm:pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full sm:w-auto"
              onClick={onClose}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="min-h-12 w-full sm:w-auto"
              disabled={
                guardando || categories.length === 0 || (esNuevo && !imagen)
              }
            >
              {guardando
                ? "Comprimiendo y guardando..."
                : esNuevo
                  ? "Crear postre"
                  : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
