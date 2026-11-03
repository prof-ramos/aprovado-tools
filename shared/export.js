/**
 * Export Utility for Aprovado Tools
 * Generates CSV (with UTF-8 BOM for Excel), structured JSON backups, and Markdown reports.
 */

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const AprovadoExport = {
  /**
   * Exporta todas as atividades para CSV com suporte a acentuação no Excel
   */
  exportActivitiesCSV(activities, filename = 'aprovado_atividades.csv') {
    const headers = [
      'ID Atividade',
      'Data',
      'Hora Início',
      'Matéria',
      'Conteúdo',
      'Tipo de Estudo',
      'Duração (minutos)',
      'Duração (horas)',
      'Exercícios Feitos',
      'Exercícios Acertos',
      'Taxa de Acerto (%)',
      'Anotações'
    ];

    const rows = activities.map(atv => {
      const ms = atv.Duracao || 0;
      const minutes = (ms / (1000 * 60)).toFixed(1);
      const hours = (ms / (1000 * 60 * 60)).toFixed(2);
      const questions = atv.ExercicioQuantidade || 0;
      const correct = atv.ExercicioAcerto || 0;
      const accuracy = questions > 0 ? ((correct / questions) * 100).toFixed(1) : '';

      return [
        atv.Id || '',
        atv.DataInicio || '',
        atv.HoraInicio || '',
        atv.Materia?.Nome || '',
        atv.Conteudo?.Nome || '',
        atv.TipoEstudo || '',
        minutes,
        hours,
        questions,
        correct,
        accuracy,
        atv.Anotacoes || ''
      ].map(escapeCsvField).join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserDownload(blob, filename);
  },

  /**
   * Exporta resumo consolidado por matérias para CSV
   */
  exportSubjectsSummaryCSV(subjects, filename = 'aprovado_resumo_materias.csv') {
    const headers = [
      'Matéria',
      'Tempo Total Formatado',
      'Tempo Total (Horas)',
      'Total de Sessões',
      '% do Tempo Total',
      'Exercícios Feitos',
      'Exercícios Acertos',
      'Taxa de Acerto (%)',
      'Quantidade de Conteúdos'
    ];

    const rows = subjects.map(s => [
      s.name,
      s.formattedDuration,
      (s.durationMs / 3600000).toFixed(2),
      s.sessionsCount,
      s.percentage.toFixed(1) + '%',
      s.questions,
      s.correct,
      s.accuracy.toFixed(1) + '%',
      s.contents ? s.contents.length : 0
    ].map(escapeCsvField).join(';'));
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserDownload(blob, filename);
  },

  /**
   * Exporta backup completo estruturado em JSON (compatível com prof-ramos/aprovado)
   */
  exportFullBackupJSON(snapshot, filename = null) {
    const today = new Date().toISOString().slice(0, 10);
    const resolvedName = filename || `aprovado_backup_completo_${today}.json`;

    const payload = {
      gerado_em: new Date().toISOString(),
      versao_extensao: '1.0.0',
      origem: 'Aprovado Tools Chrome Extension',
      usuario: snapshot.user || null,
      materias: snapshot.materias || [],
      atividades: snapshot.atividades || [],
      ciclo: snapshot.ciclo || null,
      revisoes_pendentes: snapshot.revisoesPendentes || [],
      revisoes_concluidas: snapshot.revisoesConcluidas || []
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    triggerBrowserDownload(blob, resolvedName);
  },

  /**
   * Gera relatório formatado em Markdown para copiar
   */
  generateMarkdownReport(metrics, user) {
    const today = new Date().toLocaleDateString('pt-BR');
    const userName = user ? `${user.Nome || ''} ${user.Sobrenome || ''}`.trim() : 'Estudante';

    let md = `# 📊 Relatório de Estudos — AprovadoApp\n`;
    md += `*Gerado em: ${today} | Estudante: ${userName}*\n\n`;

    md += `## 🚀 Métricas Gerais\n`;
    md += `- **Tempo Total de Estudo**: ${metrics.formattedTotalDuration} (${metrics.formattedTotalHours})\n`;
    md += `- **Total de Sessões**: ${metrics.totalSessions} sessões em ${metrics.distinctDaysCount} dias distintos\n`;
    md += `- **Média Diária**: ${metrics.avgDailyDuration} / dia ativo\n`;
    md += `- **Sequência Atual**: ${metrics.streak.current} dias consecutivos (Recorde: ${metrics.streak.longest} dias)\n`;
    if (metrics.totalQuestions > 0) {
      md += `- **Exercícios Resolvidos**: ${metrics.totalQuestions} questões (${metrics.totalCorrect} acertos — ${metrics.overallAccuracy}% de aproveitamento)\n`;
    }
    md += `\n`;

    if (metrics.subjects && metrics.subjects.length > 0) {
      md += `## 📚 Desempenho por Matéria\n`;
      md += `| Matéria | Tempo | % Tempo | Sessões | Questões | Acertos (%) |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      metrics.subjects.forEach(s => {
        md += `| **${s.name}** | ${s.formattedDuration} | ${s.percentage.toFixed(1)}% | ${s.sessionsCount} | ${s.questions} | ${s.accuracy.toFixed(1)}% |\n`;
      });
      md += `\n`;
    }

    if (metrics.types && metrics.types.length > 0) {
      md += `## 🎯 Modalidades de Estudo\n`;
      metrics.types.forEach(t => {
        md += `- **${t.name}**: ${t.formattedDuration} (${t.percentage.toFixed(1)}% do tempo)\n`;
      });
      md += `\n`;
    }

    if (metrics.ciclo) {
      md += `## 🔄 Ciclo de Estudos\n`;
      md += `- **Progresso da Rodada**: ${metrics.ciclo.porcentagem}%\n`;
      md += `\n`;
    }

    md += `---\n*Gerado automaticamente via Aprovado Tools Extension*\n`;
    return md;
  },

  /**
   * Copia o relatório Markdown para a área de transferência
   */
  async copyReportToClipboard(metrics, user) {
    const text = this.generateMarkdownReport(metrics, user);
    await navigator.clipboard.writeText(text);
  }
};
