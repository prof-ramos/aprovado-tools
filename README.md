# Aprovado Tools

Extensão não oficial para analisar e exportar o histórico da sua conta no [AprovadoApp](https://aprovadoapp.com). Reúne horas de estudo, sessões, questões, ciclo e revisões em um popup, um painel lateral e um dashboard com análise histórica.

Os cálculos e gráficos são executados no navegador, sem dependências npm, telemetria ou serviços de IA. A sincronização consulta diretamente o AprovadoApp usando a sessão aberta no mesmo perfil do navegador.

## Instalar

A [versão v1.0.0](https://github.com/prof-ramos/aprovado-tools/releases/tag/v1.0.0) está publicada no GitHub desde 3 de novembro de 2026. A extensão ainda não foi publicada na Chrome Web Store.

1. Baixe **aprovado-tools-v1.0.0.zip** nos arquivos da release e extraia para uma pasta permanente. Use o ZIP da extensão, em vez de **Source code**.
2. No Google Chrome, abra `chrome://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.
4. Fixe **Aprovado Tools** no menu de extensões da barra do navegador.
5. Faça login em [aprovadoapp.com](https://aprovadoapp.com) no mesmo perfil e abra o popup da extensão.

O pacote pronto dispensa Node.js, Git e instalação de dependências. O painel lateral usa uma API disponível a partir do Chrome 116; use uma versão atualizada. Outros navegadores Chromium dependem do suporte às APIs da extensão e precisam de validação própria.

Para atualizar uma instalação manual, extraia a nova release na mesma pasta, clique em **Recarregar** na extensão e recarregue as abas do AprovadoApp. Preserve a pasta enquanto a extensão estiver instalada. Veja o [guia de uso](docs/uso.md) para conferir o checksum e resolver problemas de instalação.

## Usar

Abra o popup pelo ícone da extensão para consultar os indicadores e exportar dados. Use **Abrir dashboard completo** para explorar gráficos, filtros e tabelas, ou **Abrir painel lateral** para acompanhar os estudos junto às outras abas. No AprovadoApp, os atalhos no topo e no canto da página também abrem o dashboard.

| Superfície | O que oferece |
|---|---|
| Popup | Resumo de tempo, sessões, questões, sequência e ciclo; filtros de período e exportações rápidas. |
| Painel lateral | Indicadores, ciclo, revisões pendentes e distribuição por matéria durante a navegação. |
| Dashboard — visão geral | Filtros por data, matéria e modalidade; busca de atividades, paginação, evolução diária e resumo por matéria. |
| Dashboard — análise histórica | Histórico completo: ranking de semestres/anos, mapa anual, grade dia × hora, duração das sessões, eficiência por horário/turno e síntese por regras. |

O botão **Sincronizar** força uma nova leitura. As listas podem ser reutilizadas por até cinco minutos, sempre após confirmar a identidade da sessão e o dono do cache. O modo normal exige acesso ao serviço, inclusive ao abrir dados em cache.

## Exportar

| Formato | Conteúdo |
|---|---|
| CSV de atividades | Sessões do recorte selecionado, com duração, questões e anotações. |
| CSV de matérias | Resumo por disciplina calculado sobre o recorte; disponível no popup e no dashboard. |
| Backup JSON | Snapshot completo carregado: perfil, matérias, atividades, ciclo e revisões, independentemente dos filtros. |
| Markdown | Relatório do recorte copiado para a área de transferência. |

Os CSVs usam separador `;`, UTF-8 com BOM e aspas para campos especiais. Consulte [filtros, exportações e interpretação das métricas](docs/uso.md). A extensão não oferece importação ou restauração de backups pela interface.

## Desenvolver e validar

```sh
git clone https://github.com/prof-ramos/aprovado-tools.git
cd aprovado-tools
npm test
```

Use Node.js compatível com `engines` em [package.json](package.json), preferindo uma versão com suporte ativo. Não é necessário executar `npm install`.

```sh
npm run generate:mock  # cria o histórico sintético para a prévia sem conta
npm run build:zip      # gera dist/aprovado-tools-v<versão>.zip
```

Carregue a raiz do checkout como extensão sem compactação. Para a prévia sintética e os comandos de validação, siga o [guia do desenvolvedor](DEVELOPER.md) e o [workflow de validação](docs/workflow-validacao.md). O ZIP de produção não inclui testes, fixtures ou o conversor experimental de backups.

## Documentação e privacidade

Comece pelo [índice de documentação](docs/README.md): [uso](docs/uso.md), [desenvolvimento](DEVELOPER.md), [arquitetura](ARCHITECTURE.md), [privacidade](PRIVACY.md) e [preparação para a Chrome Web Store](CHROMEWEBSTORE.md).

Os dados ficam no armazenamento local do perfil do navegador; a extensão não mantém servidor próprio nem envia histórico a terceiros. Exportações e relatórios copiados passam a existir também em arquivos e na área de transferência. O logout no site não apaga automaticamente o cache ou dados já abertos. Consulte a [política de privacidade](PRIVACY.md) para retenção, exclusão e permissões.

Dúvidas ou defeitos podem ser registrados nas [issues](https://github.com/prof-ramos/aprovado-tools/issues). Inclua versão, navegador e passos para reproduzir, usando dados sintéticos e capturas sem informações pessoais.
