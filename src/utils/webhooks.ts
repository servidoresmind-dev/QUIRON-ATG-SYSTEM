export const WEBHOOK_URLS = {
  atualizarProdutos: "https://main-n8n.1smjgn.easypanel.host/webhook/atualiza-produto",
  atualizarServicos: "https://main-n8n.1smjgn.easypanel.host/webhook/atualiza-serv"
} as const;

export async function triggerWebhook(url: string): Promise<void> {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Webhook respondeu com status ${response.status}`);
  }
}
