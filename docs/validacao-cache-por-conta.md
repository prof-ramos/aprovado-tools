# Cache por conta e preparação da release — 03/11/2026

Produto validado: `a060315`, branch `fix/account-scoped-cache`.
Baseline: `a4138f5`. Fuso: America/Sao_Paulo.

## Alterações e revisão

- O cache exige confirmação online da identidade e comparação com o ID de seu
  proprietário, aceitando IDs numéricos ou textuais equivalentes.
- Identidade indisponível, sessão encerrada ou cache sem dono não autorizam leitura
  dos dados anteriores. Uma troca de conta detectada ao terminar as listas rejeita
  a operação sem escrever. O cache anterior é preservado nas falhas.
- A leitura em cache devolve os metadados atuais do perfil; sincronização forçada
  continua atualizando as listas.
- Os testes de dashboard exercitam os listeners de período, datas, agrupamento,
  matéria e modalidade. A arquitetura e o README descrevem as visões e a síntese
  atuais. O índice de planos registra a correção do vínculo do cache.
- Revisões independentes de padrões e requisitos não encontraram achados
  acionáveis. Não foram acrescentadas dependências ou permissões.

## Testes

- RED da API: 8 falhas nos 15 testes iniciais, incluindo troca de conta, sessão
  encerrada, falta de verificação de identidade e mudança durante sincronização.
- GREEN da API: 17 testes aprovados após a correção e os casos adicionais de 401
  e atualização dos metadados do perfil.
- Navegação: 16 testes de dashboard aprovados. Em cópias temporárias, remover o
  listener de períodos gerou 2 falhas; remover o listener de agrupamento gerou
  1 falha. Cópias removidas ao terminar.
- `TZ=UTC npm test`: exit 0, 197 testes, 32 suítes, nenhuma falha.
- `TZ=America/Sao_Paulo npm test`: exit 0, 197 testes, 32 suítes, nenhuma falha.
- `npm run build:zip` e `unzip -t`: exit 0, arquivo íntegro. O teste de pacote
  incluído na suíte confere o empacotamento real em diretório isolado.

## Navegador e dados reais

O navegador integrado retornou `browser access host is unavailable`; medições
autenticadas feitas no Ego Lite, em espaço separado das abas pessoais. Detalhes
da extensão confirmaram origem `~/Developer/personal/aprovado-tools`; recarga
executada. SHA-256 de `shared/api.js` servido pela extensão coincidiu com o checkout.

- Dashboard real: Sincronizar concluiu em Sincronizado via AprovadoApp,
  com 4.814 registros. A captura foi aberta para inspeção visual.
- Após a sincronização, uma chamada real a `fetchCompleteSnapshot()` consultou
  somente `Usuario/Obter`, retornou 4.814 registros do mesmo proprietário e manteve
  `aprovado_last_sync` inalterado. O wrapper temporário que contou endpoints foi
  restaurado no `finally`, sem registrar cookies, cabeçalhos ou dados pessoais.
- Cliques reais abriram a análise histórica, ocultaram filtros, agruparam em
  12 anos e voltaram à visão geral pelo período de 30 dias; Tudo foi restaurado.
- Páginas de popup e painel lateral na extensão autenticada exibiram os dados
  reais; a sincronização do painel foi acionada. Abertura como página comprova
  essa superfície, sem equivaler ao encaixe nativo.
- No Chrome nativo, a extensão foi recarregada e o popup mostrou Desconectado,
  recusando exibir métricas. O login exigia senha e não estava preenchido; nenhum
  valor foi extraído ou digitado. A validação autenticada foi concluída no perfil
  já conectado do Ego, sem solicitar outra credencial.

## Limites e limpeza

- Troca de conta, 401 e troca durante uma sincronização foram verificadas com
  respostas HTTP controladas nos testes da API real. Não se trocou a conta pessoal
  do navegador para fabricar esses casos.
- Não foram revalidados downloads de exportação, CLI, console completo, popup
  nativo autenticado ou painel nativo nesta rodada. Os limites são distintos das
  verificações nativas do recibo anterior.
- Abas criadas no Chrome e espaço Ego encerrados; captura e diretórios de mutação
  removidos. Nenhuma alteração no histórico de estudos ou em credenciais.
