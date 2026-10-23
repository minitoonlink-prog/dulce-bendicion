import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { from?: string } | null)?.from ?? "/admin";

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setError("");

    try {
      const { error: errorAuth } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (errorAuth) {
        setError(`No fue posible iniciar sesión: ${errorAuth.message}`);
        return;
      }

      navigate(destino, { replace: true });
    } catch (errorAuth) {
      setError(
        errorAuth instanceof Error
          ? `No fue posible iniciar sesión: ${errorAuth.message}`
          : "Ocurrió un error inesperado al iniciar sesión."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <Card className="space-y-5 p-6 sm:p-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-extrabold">Acceso de administrador</h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesión para administrar pedidos y productos.
          </p>
        </header>

        <form className="space-y-4" onSubmit={iniciarSesion}>
          <label className="block space-y-1 text-sm font-semibold">
            Correo electrónico
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block space-y-1 text-sm font-semibold">
            Contraseña
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Iniciando sesión..." : "Iniciar sesión"}
          </Button>
        </form>
      </Card>
    </section>
  );
}
