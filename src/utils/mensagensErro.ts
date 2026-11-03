// Traduz mensagens de erro em inglês que vêm cruas da API do Supabase Auth
// (GoTrue) — a função `manage-users` já repassa o texto original dela, mas
// pra quem não é técnico ("email rate limit exceeded") isso não ajuda.
//
// Regra de segurança: cada padrão é checado por trecho (case-insensitive),
// não por igualdade exata — a fiação exata do GoTrue muda entre versões do
// Supabase. Se NADA bater, devolve a mensagem original sem alteração — nunca
// esconde um erro que ainda não previmos, só deixa mais claro o que já
// conhecemos. As mensagens que a própria `manage-users` já escreve em
// português ("Perfil inválido.", "Este vendedor já está vinculado...") não
// batem em nenhum padrão abaixo e passam direto, sem risco de tradução errada.

interface PadraoErro {
  contem: string[]; // todos os termos precisam aparecer na mensagem original
  traduzido: string;
}

// Ordem importa: padrões mais específicos primeiro, genéricos por último.
const PADROES: PadraoErro[] = [
  {
    contem: ["email rate limit"],
    traduzido:
      "O sistema atingiu o limite de envio de e-mails por agora. Aguarde um pouco (geralmente menos de 1 hora) e tente novamente — evite tentar várias vezes seguidas, isso só prolonga a espera."
  },
  {
    contem: ["already been registered"],
    traduzido: "Este e-mail já está cadastrado no sistema. Em vez de convidar de novo, edite o usuário existente na lista."
  },
  {
    contem: ["already registered"],
    traduzido: "Este e-mail já está cadastrado no sistema. Em vez de convidar de novo, edite o usuário existente na lista."
  },
  {
    contem: ["unable to validate email"],
    traduzido: "O e-mail informado não parece válido. Confira se foi digitado corretamente."
  },
  {
    contem: ["password", "character"],
    traduzido: "A senha não atende ao mínimo exigido. Use pelo menos 8 caracteres."
  },
  {
    contem: ["user not found"],
    traduzido: "Este usuário não foi encontrado — pode já ter sido removido. Atualize a página e tente novamente."
  },
  {
    // Fica por último de propósito: pega qualquer outra mensagem de limite
    // (ex: SMS) que não bateu no padrão mais específico de e-mail acima.
    contem: ["rate limit"],
    traduzido: "O sistema atingiu um limite temporário de tentativas. Aguarde alguns minutos e tente novamente."
  }
];

export function mensagemAmigavel(mensagemOriginal: string): string {
  const texto = mensagemOriginal.toLowerCase();
  const padrao = PADROES.find((p) => p.contem.every((termo) => texto.includes(termo)));
  return padrao ? padrao.traduzido : mensagemOriginal;
}
