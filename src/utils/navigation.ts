/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";

export interface ParsedRoute {
  path: string;
  id?: string;
  isEdit?: boolean;
}

export function parseHash(hash: string): ParsedRoute {
  // e.g. "#/ordens-servico/OS-2026-001?status=erro" -> strip query first
  const hashWithoutQuery = hash.split("?")[0];
  const cleanHash = hashWithoutQuery.replace(/^#\/?/, "");
  if (!cleanHash) {
    return { path: "dashboard" };
  }

  const parts = cleanHash.split("/");
  const base = parts[0];

  if (base === "ordens-servico") {
    if (parts[1]) {
      return { path: "ordens-servico-detail", id: parts[1] };
    }
    return { path: "ordens-servico" };
  }

  if (base === "orcamentos") {
    if (parts[1]) {
      return { path: "orcamentos-detail", id: parts[1] };
    }
    return { path: "orcamentos" };
  }

  if (base === "clientes") {
    return { path: "clientes" };
  }

  if (base === "usuarios") {
    return { path: "usuarios" };
  }

  if (base === "configuracoes") {
    return { path: "configuracoes" };
  }

  if (base === "login") {
    return { path: "login" };
  }

  if (base === "produtos") {
    return { path: "produtos" };
  }

  if (base === "servicos") {
    return { path: "servicos" };
  }

  if (base === "geradores") {
    return { path: "geradores" };
  }

  if (base === "historico") {
    return { path: "historico" };
  }

  return { path: "dashboard" };
}

export function navigateTo(hash: string) {
  window.location.hash = hash.startsWith("#") ? hash : `#/${hash}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState<ParsedRoute>(parseHash(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    // Initial check
    if (!window.location.hash) {
      window.location.hash = "#/dashboard";
    }

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return route;
}
