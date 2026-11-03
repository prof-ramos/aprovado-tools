/**
 * AprovadoApp API Client for Chrome Extension (Manifest V3)
 * Reverse-engineered and documented in prof-ramos/aprovado.
 */

const BASE_URL = 'https://aprovadoapp.com/service';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest'
};

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}/${endpoint}`;
  const fetchOptions = {
    method: options.method || 'GET',
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    credentials: 'include', // Sends session cookie 'aprovado'
    ...options
  };

  if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkErr) {
    throw new Error(`Falha de conexão com AprovadoApp: ${networkErr.message}`);
  }

  // If redirect to login page or 401/403
  if (response.status === 401 || response.status === 403 || response.redirected) {
    const error = new Error('Usuário não autenticado no AprovadoApp');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error(`Erro na API (${response.status}): ${errorText.slice(0, 200)}`);
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (parseErr) {
    // If response is HTML, it means session expired and redirected to login HTML
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      const error = new Error('Sessão expirada no AprovadoApp');
      error.status = 401;
      throw error;
    }
    throw new Error('Resposta inválida do servidor AprovadoApp');
  }
}

export const AprovadoApi = {
  /**
   * Verifica se o usuário está autenticado
   */
  async checkAuth() {
    try {
      const user = await this.getUser();
      return { isAuthenticated: Boolean(user && user.Id), user };
    } catch (err) {
      return { isAuthenticated: false, error: err.message, user: null };
    }
  },

  /**
   * Obtém os dados do perfil autenticado
   */
  async getUser() {
    return await request('Usuario/Obter', { method: 'GET' });
  },

  /**
   * Lista todas as matérias cadastradas
   */
  async listSubjects() {
    return (await request('Materia/Listar', { method: 'POST', body: {} })) || [];
  },

  /**
   * Lista matérias com métricas de duração
   */
  async listSubjectsWithDuration() {
    return (await request('Materia/ListarComDuracao', { method: 'POST', body: {} })) || [];
  },

  /**
   * Lista todo o histórico de atividades de estudo
   */
  async listActivities() {
    return (await request('Atividade/Listar', { method: 'POST', body: {} })) || [];
  },

  /**
   * Obtém resumo das atividades da página principal
   */
  async getHomeActivities() {
    return await request('Atividade/ObterHome', { method: 'POST', body: {} });
  },

  /**
   * Obtém o progresso atual do Ciclo de Estudos
   */
  async getCycleProgress() {
    try {
      return await request('Acompanhamento/CicloEstudos', { method: 'POST', body: {} });
    } catch (err) {
      console.warn('Ciclo de estudos não configurado ou indisponível:', err);
      return null;
    }
  },

  /**
   * Obtém a lista de revisões pendentes
   */
  async listPendingReviews() {
    try {
      return (await request('Revisao/ListarPendentes', { method: 'POST', body: {} })) || [];
    } catch (err) {
      console.warn('Erro ao listar revisões pendentes:', err);
      return [];
    }
  },

  /**
   * Obtém a lista de revisões concluídas
   */
  async listCompletedReviews() {
    try {
      return (await request('Revisao/ListarConcluidas', { method: 'POST', body: {} })) || [];
    } catch (err) {
      console.warn('Erro ao listar revisões concluídas:', err);
      return [];
    }
  },

  /**
   * Relatório de tempo de estudo acumulado
   */
  async getTimeReport(dataInicio = '2020-01-01', dataFim = null) {
    const today = new Date().toISOString().slice(0, 10);
    return (await request('Acompanhamento/TempoEstudo', {
      method: 'POST',
      body: { DataInicio: dataInicio, DataFim: dataFim || today }
    })) || [];
  },

  /**
   * Relatório por tipo de estudo (Doutrina, Leitura, Questões, etc.)
   */
  async getStudyTypeReport(dataInicio = '2020-01-01', dataFim = null) {
    const today = new Date().toISOString().slice(0, 10);
    return (await request('Acompanhamento/TipoEstudo', {
      method: 'POST',
      body: { DataInicio: dataInicio, DataFim: dataFim || today }
    })) || [];
  },

  /**
   * Carrega um snapshot completo dos dados da conta com cache local
   */
  async fetchCompleteSnapshot(forceRefresh = false) {
    // A validade temporal não comprova que o cache pertence à sessão atual.
    const user = await this.getUser();
    if (!user || !user.Id) {
      throw new Error('Sessão expirada ou não autenticado.');
    }

    if (!forceRefresh) {
      const cached = await chrome.storage.local.get(['aprovado_data_snapshot', 'aprovado_last_sync']);
      const isFresh = cached.aprovado_last_sync && (Date.now() - cached.aprovado_last_sync < 1000 * 60 * 5); // 5 min
      const snapshot = cached.aprovado_data_snapshot;
      const belongsToUser = snapshot?.user?.Id && String(snapshot.user.Id) === String(user.Id);
      if (isFresh && belongsToUser) {
        return { ...snapshot, user };
      }
    }

    // Matérias e atividades são essenciais: falhas propagam sem sobrescrever
    // o cache com snapshot vazio. Ciclo e revisões são opcionais.
    const [materias, atividades, ciclo, revisoesPendentes, revisoesConcluidas] = await Promise.all([
      this.listSubjects(),
      this.listActivities(),
      this.getCycleProgress().catch(() => null),
      this.listPendingReviews().catch(() => []),
      this.listCompletedReviews().catch(() => [])
    ]);

    // A sessão pode mudar enquanto as listas são carregadas. Nesse caso,
    // descarte esta leitura, sem sobrescrever o snapshot anterior.
    const currentUser = await this.getUser();
    if (!currentUser?.Id || String(currentUser.Id) !== String(user.Id)) {
      throw new Error('A conta mudou durante a sincronização. Sincronize novamente.');
    }

    const snapshot = {
      user: currentUser,
      materias,
      atividades,
      ciclo,
      revisoesPendentes,
      revisoesConcluidas,
      syncedAt: new Date().toISOString()
    };

    await chrome.storage.local.set({
      aprovado_data_snapshot: snapshot,
      aprovado_last_sync: Date.now(),
      aprovado_user: currentUser
    });

    return snapshot;
  }
};
