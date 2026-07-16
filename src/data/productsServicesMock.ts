import { Produto, Servico } from "../types";

export const MOCK_PRODUTOS: Produto[] = [
  { id: 1, created_at: "2026-06-01T10:00:00Z", cod_produto: 1001, nome_produto: "Filtro de Óleo Lubrificante PSL962", valor_unitario: 185.90, categora_item: 10, CFOP: 5405, inativo: false },
  { id: 2, created_at: "2026-06-02T11:00:00Z", cod_produto: 1002, nome_produto: "Filtro de Ar Primário AP-8853", valor_unitario: 240.00, categora_item: 10, CFOP: 5405, inativo: false },
  { id: 3, created_at: "2026-06-03T09:30:00Z", cod_produto: 1003, nome_produto: "Filtro de Combustível Separador PSD460", valor_unitario: 125.50, categora_item: 10, CFOP: 5102, inativo: false },
  { id: 4, created_at: "2026-06-04T15:45:00Z", cod_produto: 1004, nome_produto: "Aditivo Radiador Concentrado Orgânico", valor_unitario: 45.00, categora_item: 11, CFOP: 5405, inativo: false },
  { id: 5, created_at: "2026-06-05T08:20:00Z", cod_produto: 1005, nome_produto: "Óleo Lubrificante 15W40 Mineral (Litro)", valor_unitario: 38.90, categora_item: 11, CFOP: 5102, inativo: false },
  { id: 6, created_at: "2026-06-06T14:10:00Z", cod_produto: 1006, nome_produto: "Bateria Selada Moura 150Ah 12V", valor_unitario: 1150.00, categora_item: 12, CFOP: 5401, inativo: false },
  { id: 7, created_at: "2026-06-07T10:05:00Z", cod_produto: 1007, nome_produto: "Bateria Selada Heliar 100Ah 12V", valor_unitario: 890.00, categora_item: 12, CFOP: null, inativo: false },
  { id: 8, created_at: "2026-06-08T16:30:00Z", cod_produto: 1008, nome_produto: "Correia Alternador de Perfil V Dentada", valor_unitario: 75.00, categora_item: 13, CFOP: 5102, inativo: false },
  { id: 9, created_at: "2026-06-09T11:15:00Z", cod_produto: 1009, nome_produto: "Mangueira de Intercooler Silicone", valor_unitario: 195.00, categora_item: 13, CFOP: 5102, inativo: false },
  { id: 10, created_at: "2026-06-10T12:00:00Z", cod_produto: 1010, nome_produto: "Bico Injetor Motor MWM X12", valor_unitario: 450.00, categora_item: null, CFOP: 5405, inativo: false },
  { id: 11, created_at: "2026-06-11T13:40:00Z", cod_produto: 1011, nome_produto: "Junta de Cabeçote Scania DS11", valor_unitario: 310.00, categora_item: 14, CFOP: 5102, inativo: false },
  { id: 12, created_at: "2026-06-12T09:50:00Z", cod_produto: 1012, nome_produto: "Solenoide de Parada 12V Woodward", valor_unitario: 620.00, categora_item: 15, CFOP: 5405, inativo: false },
  { id: 13, created_at: "2026-06-13T10:30:00Z", cod_produto: 1013, nome_produto: "Sensor de Pressão de Óleo (Cebolinha)", valor_unitario: 115.00, categora_item: 15, CFOP: 5102, inativo: false },
  { id: 14, created_at: "2026-06-14T11:00:00Z", cod_produto: 1014, nome_produto: "Sensor de Temperatura de Água NPT 1/2", valor_unitario: 98.00, categora_item: 15, CFOP: 5102, inativo: false },
  { id: 15, created_at: "2026-06-15T15:20:00Z", cod_produto: 1015, nome_produto: "Controlador de Grupo Gerador DSE 7310", valor_unitario: 3850.00, categora_item: 16, CFOP: 5401, inativo: false },
  { id: 16, created_at: "2026-06-16T16:00:00Z", cod_produto: 1016, nome_produto: "Carregador de Bateria Inteligente 5A 12V/24V", valor_unitario: 420.00, categora_item: 16, CFOP: 5405, inativo: false },
  { id: 17, created_at: "2026-06-17T09:15:00Z", cod_produto: 1017, nome_produto: "Abraçadeira de Aço Inox Super 54-62mm", valor_unitario: 12.50, categora_item: 13, CFOP: 5102, inativo: false },
  { id: 18, created_at: "2026-06-18T10:45:00Z", cod_produto: 1018, nome_produto: "Resistência de Pré-aquecimento 2000W 220V", valor_unitario: 350.00, categora_item: 17, CFOP: 5405, inativo: false },
  { id: 19, created_at: "2026-06-19T14:30:00Z", cod_produto: 1019, nome_produto: "Termostato de Pré-aquecimento KSD301", valor_unitario: 85.00, categora_item: 17, CFOP: null, inativo: false },
  { id: 20, created_at: "2026-06-20T11:20:00Z", cod_produto: 1020, nome_produto: "Tampa do Radiador Pressurizada 14 PSI", valor_unitario: 0.00, categora_item: 13, CFOP: 5102, inativo: false }, // R$ 0.00 to show "Sob consulta"
  { id: 21, created_at: "2026-06-21T08:55:00Z", cod_produto: 1021, nome_produto: "Palheta do Ventilador Scania 6 Pás", valor_unitario: 520.00, categora_item: 13, CFOP: 5102, inativo: false },
  { id: 22, created_at: "2026-06-22T13:05:00Z", cod_produto: 1022, nome_produto: "Amortecedor de Vibração (Coxim) Motor/Alternador", valor_unitario: 165.00, categora_item: null, CFOP: 5102, inativo: false },
  { id: 23, created_at: "2026-06-23T15:50:00Z", cod_produto: 1023, nome_produto: "Flange de Acoplamento SAE 3", valor_unitario: 0.00, categora_item: 18, CFOP: 5405, inativo: false }, // R$ 0.00 to show "Sob consulta"
  { id: 24, created_at: "2026-06-24T10:25:00Z", cod_produto: 1024, nome_produto: "Disjuntor Caixa Moldada 3P 250A Tripolar", valor_unitario: 1450.00, categora_item: 16, CFOP: 5401, inativo: false },
  { id: 25, created_at: "2026-06-25T11:40:00Z", cod_produto: 1025, nome_produto: "Filtro de Ar Secundário AS-8854", valor_unitario: 190.00, categora_item: 10, CFOP: 5405, inativo: false },
  { id: 26, created_at: "2026-06-26T14:55:00Z", cod_produto: 1026, nome_produto: "Graxa Alta Temperatura Azul (Pote 1kg)", valor_unitario: 65.00, categora_item: 11, CFOP: 5102, inativo: false },
  { id: 27, created_at: "2026-06-27T09:10:00Z", cod_produto: 1027, nome_produto: "Sensor Magnético MPU (Pick-up) UNF 5/8", valor_unitario: 280.00, categora_item: 15, CFOP: 5102, inativo: false }
];

export const MOCK_SERVICOS: Servico[] = [
  { id: 1, created_at: "2026-06-01T09:00:00Z", nCodServ: 101, cDescricao: "Manutenção Preventiva de Grupo Gerador até 150kVA", nValorDesc: 450.00, inativo: false },
  { id: 2, created_at: "2026-06-02T10:30:00Z", nCodServ: 102, cDescricao: "Manutenção Preventiva de Grupo Gerador 151 a 350kVA", nValorDesc: 650.00, inativo: false },
  { id: 3, created_at: "2026-06-03T11:15:00Z", nCodServ: 103, cDescricao: "Manutenção Preventiva de Grupo Gerador 351 a 600kVA", nValorDesc: 950.00, inativo: false },
  { id: 4, created_at: "2026-06-04T14:00:00Z", nCodServ: 104, cDescricao: "Manutenção Corretiva Emergencial (Taxa de Deslocamento)", nValorDesc: 250.00, inativo: false },
  { id: 5, created_at: "2026-06-05T15:30:00Z", nCodServ: 105, cDescricao: "Atendimento Técnico Noturno / Finais de Semana (Hora Adicional)", nValorDesc: 120.00, inativo: false },
  { id: 6, created_at: "2026-06-06T09:45:00Z", nCodServ: 106, cDescricao: "Análise de Qualidade do Óleo Lubrificante (Laudo Laboratorial)", nValorDesc: 180.00, inativo: false },
  { id: 7, created_at: "2026-06-07T10:10:00Z", nCodServ: 107, cDescricao: "Teste de Carga com Banco de Resistências (Megômetro)", nValorDesc: 1200.00, inativo: false },
  { id: 8, created_at: "2026-06-08T11:20:00Z", nCodServ: 108, cDescricao: "Limpeza Química de Radiador e Sistema de Arrefecimento", nValorDesc: 380.00, inativo: false },
  { id: 9, created_at: "2026-06-09T13:10:00Z", nCodServ: 109, cDescricao: "Reprogramação e Configuração de Controlador Digital (USCA)", nValorDesc: 320.00, inativo: false },
  { id: 10, created_at: "2026-06-10T14:30:00Z", nCodServ: 110, cDescricao: "Parametrização de Governador de Velocidade Eletrônico", nValorDesc: 450.00, inativo: false },
  { id: 11, created_at: "2026-06-11T16:00:00Z", nCodServ: 111, cDescricao: "Revisão Geral de Motor de Partida (Arranque)", nValorDesc: 280.00, inativo: false },
  { id: 12, created_at: "2026-06-12T09:20:00Z", nCodServ: 112, cDescricao: "Revisão Geral do Alternador de Carga de Bateria", nValorDesc: 220.00, inativo: false },
  { id: 13, created_at: "2026-06-13T10:40:00Z", nCodServ: 113, cDescricao: "Medição de Resistência de Aterramento (SPDA)", nValorDesc: 350.00, inativo: false },
  { id: 14, created_at: "2026-06-14T11:50:00Z", nCodServ: 114, cDescricao: "Substituição de Fita Térmica de Proteção de Coletor de Escape", nValorDesc: 150.00, inativo: false },
  { id: 15, created_at: "2026-06-15T14:15:00Z", nCodServ: 115, cDescricao: "Estudo de Seletividade e Proteção de Cabine Primária", nValorDesc: 2800.00, inativo: false },
  { id: 16, created_at: "2026-06-16T15:40:00Z", nCodServ: 116, cDescricao: "Troca de Óleo, Filtros e Check-list de 50 Itens", nValorDesc: 0.00, inativo: false }, // R$ 0.00 to show "Sob consulta"
  { id: 17, created_at: "2026-06-17T09:30:00Z", nCodServ: 117, cDescricao: "Alinhamento e Nivelamento de Conjunto Motor-Alternador", nValorDesc: 580.00, inativo: false },
  { id: 18, created_at: "2026-06-18T10:15:00Z", nCodServ: 118, cDescricao: "Higienização Interna de Tanque de Combustível Diário", nValorDesc: 450.00, inativo: false },
  { id: 19, created_at: "2026-06-19T11:00:00Z", nCodServ: 119, cDescricao: "Filtragem e Tratamento de Óleo Diesel (Diálise)", nValorDesc: 850.00, inativo: false },
  { id: 20, created_at: "2026-06-20T13:45:00Z", nCodServ: 120, cDescricao: "Treinamento Operacional de Operadores Locais (In-Company)", nValorDesc: 600.00, inativo: false },
  { id: 21, created_at: "2026-06-21T15:00:00Z", nCodServ: 121, cDescricao: "Inspeção Termográfica de Painéis Elétricos (QTA / QTM)", nValorDesc: 350.00, inativo: false },
  { id: 22, created_at: "2026-06-22T08:30:00Z", nCodServ: 122, cDescricao: "Consultoria Técnica de Eficiência Energética para Geradores", nValorDesc: 0.00, inativo: false }, // R$ 0.00 to show "Sob consulta"
  { id: 23, created_at: "2026-06-23T10:10:00Z", nCodServ: 123, cDescricao: "Substituição de Mangueiras e Abraçadeiras Gerais do Motor", nValorDesc: 320.00, inativo: false },
  { id: 24, created_at: "2026-06-24T14:50:00Z", nCodServ: 124, cDescricao: "Reforma Geral de Painel de Transferência Automática (QTA)", nValorDesc: 2100.00, inativo: false },
  { id: 25, created_at: "2026-06-25T16:15:00Z", nCodServ: 125, cDescricao: "Pintura Externa Cabinada Completa Contra Corrosão", nValorDesc: 1750.00, inativo: false }
];
