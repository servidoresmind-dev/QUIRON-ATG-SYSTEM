import { PerfilUsuario } from "../types";

// Páginas que podem ser marcadas individualmente para um Usuário Comum.
// "usuarios" fica de fora de propósito — gestão de usuários continua
// exclusiva de Administrador, não é delegável via checklist.
export const APP_PAGES: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "ordens-servico", label: "Ordens de Serviço" },
  { key: "orcamentos", label: "Orçamentos" },
  { key: "clientes", label: "Clientes & Geradores" },
  { key: "produtos", label: "Produtos" },
  { key: "servicos", label: "Serviços" },
  { key: "geradores", label: "Geradores" },
  { key: "historico", label: "Histórico" },
  { key: "configuracoes", label: "Configurações" }
];

const ALL_PAGE_KEYS = APP_PAGES.map((p) => p.key);

// Rotas como "ordens-servico-detail" pertencem à mesma página-base
// "ordens-servico" para fins de permissão.
export function basePageKey(routePath: string): string {
  return routePath.replace(/-detail$|-novo$|-editar$/, "");
}

// paginasPermitidas === null/undefined significa "usuário comum criado antes
// desta funcionalidade existir" — mantém o comportamento antigo (acesso a
// tudo, menos Usuários) para não travar ninguém que já tinha acesso.
export function allowedPagesFor(
  perfil: PerfilUsuario,
  paginasPermitidas: string[] | null | undefined
): string[] {
  if (perfil === PerfilUsuario.ADMIN) {
    return [...ALL_PAGE_KEYS, "usuarios"];
  }
  if (paginasPermitidas == null) {
    return ALL_PAGE_KEYS;
  }
  return paginasPermitidas.filter((p) => ALL_PAGE_KEYS.includes(p));
}

export function canAccessPage(
  perfil: PerfilUsuario,
  paginasPermitidas: string[] | null | undefined,
  routePath: string
): boolean {
  const pageKey = basePageKey(routePath);
  if (pageKey === "usuarios") {
    return perfil === PerfilUsuario.ADMIN;
  }
  return allowedPagesFor(perfil, paginasPermitidas).includes(pageKey);
}
