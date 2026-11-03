# Validação das capturas da Chrome Web Store

- Fonte: branch `chore/capturas-loja`, criada de `fix/ux-etapa-2-3`, em 03/11/2026, America/Sao_Paulo.
- Escopo: `store-assets/screenshot-1-dashboard.png` a `screenshot-4-exportacao.png`, descrições em
  `CHROMEWEBSTORE.md`, e remoção da pendência de pesquisa de marca registrada dos documentos da marca
  (o projeto é pessoal e sem fins comerciais).
- Navegador: ego-browser no Chrome do mantenedor, extensão carregada deste checkout e recarregada antes
  da captura; dashboard com `?mock=true`, janela de 1280×800 e escala 1.
- Resultado: quatro PNGs de 1280×800. Visão geral com abas e gráfico por mês; Histórico com conclusões e
  ranking; Matriz de rendimento e mix; menu Exportar aberto com os quatro nomes atuais. Todas mostram o ícone
  novo e a faixa "Dados de exemplo". Nenhum dado real, nome de conta ou e-mail aparece.
- Visual: as quatro imagens foram abertas e inspecionadas. Duas capturas iniciais saíram quebradas por recorte
  em coordenadas de página (uma em branco, outra deslocada) e foram refeitas sem recorte.
- Automatizado: `npm run check:docs` e `git diff --check`, código 0. Sem alteração de comportamento.
- Não executado: envio à loja; conferência no painel de desenvolvedores da Chrome Web Store.
- Limpeza: espaços de tarefa do ego-browser encerrados sem abas mantidas.
