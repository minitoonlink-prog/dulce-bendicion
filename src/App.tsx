import { lazy, Suspense, useEffect, useState } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Layout } from "./components/Layout";
import { supabase } from "./lib/supabaseClient";
import Home from "./pages/Home";
import Login from "./pages/Login";

const Admin = lazy(() => import("./pages/Admin"));
const Checkout = lazy(() => import("./pages/Checkout"));

function RutaProtegidaAdmin() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();

  useEffect(() => {
    let activa = true;
    let cambioDeAuthRecibido = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      cambioDeAuthRecibido = true;
      if (!activa) return;
      setUsuario(session?.user ?? null);
      setVerificando(false);
      setError("");
    });

    void supabase.auth
      .getSession()
      .then(({ data, error: errorSesion }) => {
        if (!activa || cambioDeAuthRecibido) return;
        if (errorSesion) {
          setError(`No fue posible verificar la sesión: ${errorSesion.message}`);
        } else {
          setUsuario(data.session?.user ?? null);
        }
        setVerificando(false);
      })
      .catch((errorSesion: unknown) => {
        if (!activa || cambioDeAuthRecibido) return;
        setError(
          errorSesion instanceof Error
            ? `No fue posible verificar la sesión: ${errorSesion.message}`
            : "No fue posible verificar la sesión."
        );
        setVerificando(false);
      });

    return () => {
      activa = false;
      subscription.unsubscribe();
    };
  }, []);

  if (verificando) {
    return <p role="status">Verificando sesión...</p>;
  }
  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
        {error}
      </p>
    );
  }
  if (!usuario) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Admin />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<p role="status">Cargando administrador...</p>}>
                <RutaProtegidaAdmin />
              </Suspense>
            }
          />
          <Route
            path="/checkout"
            element={
              <Suspense fallback={<p role="status">Cargando carrito...</p>}>
                <Checkout />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}
