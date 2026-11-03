# Workflow de validação para agentes

Execute este fluxo ao alterar comportamento ou revisar um PR. Na revisão, reporte
os defeitos encontrados; na implementação, corrija-os e repita as verificações
afetadas. Conclua com o recibo abaixo, distinguindo execução e bloqueios.

## 1. Fixar o que será validado

1. Confira `git status --short`, branch e `git rev-parse HEAD`. Preserve alterações
   preexistentes. Identifique o PR e os arquivos alterados quando houver.
2. Leia os requisitos e selecione as superfícies afetadas na tabela abaixo.
3. Para cada correção, acrescente uma regressão com entradas pequenas e resultado
   esperado calculado independentemente. Execute-a antes da correção e confirme a
   falha pelo defeito; depois confirme que passa com a correção.

## 2. Verificação automatizada e pacote

Na raiz do checkout, execute em sequência e confira o código de saída de cada comando:

```sh
TZ=UTC npm test
TZ=America/Sao_Paulo npm test
git diff --check
npm run build:zip
unzip -t dist/aprovado-tools-v$(node -p "require('./manifest.json').version").zip
```

`npm test` gera sua fixture pelo `pretest`; não exige instalação de dependências.
Registre a contagem real e as falhas pelo nome. Confira também a lista de entradas
do ZIP com `unzip -Z1`: ela deve conter os arquivos de execução e excluir testes,
documentação, segredos, fixtures e `shared/backup.js` experimental.
Confira a matriz atual em `.github/workflows/test.yml` e, depois do push, aguarde os
checks do novo SHA (`gh pr checks <numero> --watch`). CI verde complementa a
verificação funcional; dados e APIs reais não estão presentes na CI.

## 3. Navegador: preparar uma execução real

1. Use o navegador integrado quando disponível; caso não atenda à tarefa, registre
   a limitação e use o navegador alternativo disponível. Abra abas da tarefa
   separadas das pessoais e preserve as abas existentes.
2. Abra `chrome://extensions`, localize a extensão pelo nome do `manifest.json` e
   confira em **Saiba mais/Detalhes** o caminho da origem sem compactação. Ele deve
   corresponder ao checkout validado. Descubra o ID nessa tela; não reutilize um ID
   de recibos antigos como se fosse universal.
3. Recarregue a extensão e as páginas afetadas. Leia o estado após a ação e confirme
   que a nova interface está presente. Para scripts injetados, recarregue também
   a página do AprovadoApp. Instruções de recarga:
   [documentação do Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#reload).
4. Abra `chrome-extension://<ID>/dashboard/dashboard.html` sem `?mock=true`.
   Confirme **Sincronizado** depois de **Sincronizar** e a presença de dados reais.
   Se a sessão estiver desconectada, abra `https://aprovadoapp.com` no mesmo
   navegador e use a sessão ou o preenchimento seguro existente. Se depender de
   entrada do usuário, conclua as verificações independentes e registre esse
   bloqueio. Preserve credenciais, cookies e backups fora de comandos, logs e Git.
5. Para comparação sintética, abra o dashboard com `?mock=true`. Fora da extensão,
   use a prévia HTTP descrita em [DEVELOPER.md](../DEVELOPER.md); ela não comprova
   permissões, autenticação, popup ou painel nativo.

## 4. Executar as verificações afetadas

| Alteração | Ações e critérios observáveis |
|---|---|
| Dashboard / filtros | Clique em Tudo, 30 dias, 7 dias e Personalizado; aplique datas, matéria e modalidade; confira retorno à visão geral, tabela e indicadores. Restaure os filtros ao terminar. |
| Análise histórica | Abra pelo botão no seletor de período. Confirme que matéria, modalidade e datas personalizadas ficam ocultas; o histórico usa todos os registros. Troque Semestres/Anos e confira linhas e destaques. Teste o seletor do heatmap anual e a grade dia × hora; inspecione barras de sessões, medianas e síntese. Volte por um período e reabra a análise. Sincronize e confirme a atualização. |
| Ranking / eficiência | Nos testes sintéticos, prove que empates compartilham posição em semestres e anos e que a assertividade decide quando os outros critérios empatam. Prove que um turno com 50 questões aparece na UI e na síntese mesmo sem hora com 50. No navegador real, confira as seções renderizadas; não altere o histórico do usuário para fabricar casos de borda. |
| Popup / painel lateral | Use o ícone da extensão ou seu menu de contexto. Confirme o painel encaixado ao lado do site e a alça de redimensionamento. Abrir `sidepanel.html` em aba comprova só a página. `popup.html` em aba pode fechar a aba/espaço ao chamar `window.close()`; use o popup nativo para seus botões. Veja [DEVELOPER.md §1.6](../DEVELOPER.md#16-verificação-do-popup-e-do-painel-nativo). |
| Controles injetados | Recarregue o site; confirme um botão no topo e um flutuante. Nos testes, execute `content.js` real com mutações e reinjeção antes do próximo animation frame. |
| Exportações / CLI | Acione os formatos afetados e inspecione o arquivo baixado: formato, totais, codificação e intervalo. Use diretório privado temporário para dados reais e remova apenas os arquivos da tarefa. Para compatibilidade CLI, execute o método/comando real: leitura do código ou comparação de chaves é apenas evidência estrutural. |

Observe ao menos uma captura visual das seções alteradas e confira legibilidade,
cores e transbordamento. Verifique erros de execução quando a ferramenta permitir;
registre explicitamente quando o console não foi observado. Registre apenas
agregados públicos, sem nome, email, matérias pessoais ou linhas do histórico.
Feche as abas criadas pela tarefa ao terminar.

## 5. Recibo e conclusão

Salve um recibo sanitizado em `docs/validacao-<pr-ou-tarefa>.md`, usando:

```text
Fonte: branch, SHA do produto e data/fuso.
Automatizado: comandos, códigos de saída, contagens; regressões RED/GREEN.
Pacote: comando e resultado.
Navegador: produto, origem da extensão, modo real/mock e superfície.
Cenários: ação → resultado observado, incluindo totais agregados relevantes.
Visual/console: o que foi inspecionado e eventuais erros.
CI: SHA e checks após o push, ou ainda em execução.
Bloqueios/não executado: etapa, tentativa, resultado e recurso indispensável.
Limpeza: abas e arquivos temporários da tarefa.
```

Execute as etapas acessíveis antes de encerrar. Se faltou autenticação, permissão
ou capacidade concreta da ferramenta, mantenha essa limitação explícita; não
marque validação real como concluída com evidência de mock, DOM simulado ou teste
unitário. Uma mudança apenas documental exige conferir links e diff; não precisa
reexecutar a suíte sem alteração de comportamento. Para mudanças de produto,
revalide se o código mudar depois do recibo. Commit/push seguem o escopo autorizado;
merge e publicação seguem a autorização da tarefa.
