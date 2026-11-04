# Validação integrada: busca, isolamento e privacidade

## Fonte e escopo

- Data: 4 de novembro de 2026, UTC.
- Repositório: `prof-ramos/aprovado-tools`.
- Base: `f8162ed47b1e209a1f2831bf4fe423117c268d92`, branch local
  `integration/recovered-fixes-20261104`, alterações não commitadas.
- A base foi confirmada via GitHub e clonada novamente após a interrupção da
  primeira rodada. Os resultados abaixo foram executados no conjunto reconstruído,
  sem depender de logs ou arquivos perdidos na interrupção.
- Preservados da main: versão `1.0.1`, ícones Lucide e licença ISC nos três HTML,
  política de privacidade atual, identificação do publicador e classificação do
  histórico de estudos como conteúdo do site, sem telemetria de uso.
- Nenhum commit, push, PR, merge, release, alteração na loja ou uso de conta real.

Foram integradas a [busca local da tabela](validacao-busca-atividades.md), o
[isolamento do popup e painel](validacao-isolamento-carga-progressiva.md), a
[ordem das cargas do dashboard](validacao-dashboard-ordem-20261104.md) e o
complemento factual da ficha da loja. A API, os HTML e o manifesto não foram
alterados nesta integração. Não foram instaladas dependências.

## Automatizado

Ambiente: Linux, Node.js `v24.22.1`, npm `11.9.0`.

- Baseline `f8162ed`, antes das correções de produto: `TZ=UTC npm test`, saída 0,
  293 testes em 43 suítes, sem falhas.
- RED combinado: os dois arquivos finais de testes foram copiados para uma
  árvore isolada da base, sem correções de produto. Executado
  `TZ=UTC node --test tests/dashboard.test.js tests/popup-panel-ux.test.js`:
  saída 1, 99 testes, 47 passaram e 52 falharam. Nenhum cancelado ou ignorado.
- GREEN do dashboard integrado: 49/49, saída 0, incluindo a regressão cruzada
  adicional de busca, falha, conclusão obsoleta e recuperação.
- `TZ=UTC npm test`: saída 0; 343/343 testes, 49 suítes; nenhuma falha,
  cancelamento, teste ignorado ou pendente.
- `TZ=America/Sao_Paulo npm test`: saída 0; os mesmos 343/343 e 49 suítes.
- `node --check` nos três scripts de interface alterados: saída 0.
- `npm run check:docs`: saída 0, 47 Markdown, 110 links locais, nenhum erro.
- `git diff --check`: saída 0.
- A matriz de CI declarada permanece Node 18, 22, 24 e 26 nos dois fusos e um
  job documental. Localmente foi executado somente Node 24. Não há checks de
  um novo SHA porque nenhuma alteração foi publicada.

## Comportamento cruzado

A regressão adicional executa o dashboard real com fronteiras sintéticas:

1. A conta A aparece do cache e a busca restringe apenas a tabela de Atividades.
2. Ao voltar à Visão geral, a busca oculta não restringe indicadores nem CSV.
3. A sincronização atual falha: memória, nome, tabela e busca são limpos, e os
   quatro manipuladores de exportação ficam sem dados para produzir arquivos.
4. Um callback e a conclusão antigos chegam depois da falha; não restauram A.
5. Uma nova sincronização da conta B recupera CSV de atividades, CSV de matérias,
   JSON e Markdown. IDs das atividades e perfil exportado pertencem somente a B.
6. Uma nova busca em Atividades funciona; voltar à Visão geral continua usando
   somente os filtros globais. O JSON permanece um backup completo.

O verificador suplementar `check-cross-surface-storage.mjs`, incluído no pacote
separado de evidências, usa os scripts do popup/painel e a API reais, com rede,
DOM, armazenamento compartilhado e destinos de exportação simulados. Executado
nas ordens popup → painel e painel → popup, em ambos os fusos: quatro cenários
aprovados. Depois de ambas as telas carregarem B, uma escrita antiga de A termina;
as duas interfaces e seus backups permanecem B. A leitura seguinte autenticada
como B rejeita o cache de A, recarrega as listas e volta a armazenar B.

Não há cancelamento de requisições nem coordenação global de gravações: o cache
persistido pode ficar temporariamente na conta anterior. Tampouco há observador
contínuo de logout ou revogação automática entre superfícies já abertas. Esses
limites não são cobertos pelas guardas locais de geração. Uma nova leitura
continua exigindo confirmação online da identidade e do dono do cache.

## Revisão independente

Uma segunda revisão somente leitura não encontrou defeitos novos ou bloqueadores
na combinação. Reexecutou 99/99 testes focados em UTC e São Paulo e confirmou
as guardas nas três telas, busca/exportações, declarações de privacidade e
preservação das alterações upstream. Não substitui validação nativa.

## Pacote

- `npm run build:zip`: saída 0, `dist/aprovado-tools-v1.0.1.zip`.
- `unzip -t`: saída 0, sem erros.
- `unzip -Z1`: 22 arquivos de execução. Sem testes, documentação, fixtures,
  dados reais, credenciais ou `shared/backup.js`.
- Cada entrada foi comparada byte a byte com o checkout integrado.
- SHA-256 do ZIP: `02586edc13f03852eda8e96de8a53635aa89911836865df288d7ba242ca0b9cb`.
- A versão permanece 1.0.1, conforme a base. A geração local não substitui o
  pacote já enviado à loja, nem realiza nova submissão.

## Navegador, visual e limites

A restrição anterior de acesso a `chrome://extensions/` nesta tarefa foi
respeitada, sem nova tentativa do protocolo nem uso de outra via para contornar
a negativa. Não houve instalação/reload da extensão nem acesso a conta real.

Na retomada, um servidor Python foi iniciado para a prévia sintética na porta
8767. Uma consulta feita junto ao servidor respondeu HTTP 200; em uma chamada
separada, a conexão foi recusada. A navegação do Chrome cloud/CDP para
`http://127.0.0.1:8767/dashboard/dashboard.html?mock=true` retornou
`net::ERR_CONNECTION_REFUSED`. O servidor foi interrompido. A aba de erro não foi
marcada para retenção e fica sujeita à limpeza automática da ferramenta.

Não executados nesta versão integrada: inspeção visual/screenshot, console da
interface carregada, downloads pela UI, popup/painel nativos e troca de contas
reais. Os testes DOM e de API sintética não substituem essas etapas. Para
completá-las é necessário um navegador autorizado que alcance o checkout; o
modo real exige extensão carregada e sessão autenticada no mesmo perfil.

A main contém [validação nativa anterior](validacao-issues-22-24.md), que fechou a
issue #23. Esse recibo é válido para o código que examinou, não para as mudanças
posteriores desta integração. Não se afirma que a issue continua aberta nem que
estes novos scripts foram validados nativamente.

## Limpeza e entrega

Somente dados sintéticos foram usados. Nenhuma aba pessoal foi alterada. Fixture
e ZIP permanecem nos diretórios locais ignorados pelo Git. O diff consolidado,
o ZIP de execução e o pacote de evidências são artefatos separados para revisão;
a publicação depende de autorização própria e validação do SHA publicado.
