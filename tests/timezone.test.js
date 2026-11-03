process.env.TZ = 'America/Sao_Paulo';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { computeStudyMetrics, computeActivityHeatmap, parseDateString, filterActivitiesByPeriod } from '../shared/analytics.js';
const activity = (day, hour = 22) => ({ Inicio: new Date(2025, 2, day, hour, 30).toISOString(), Duracao: 3600000, Materia: { Id: 1, Nome: 'X' } });
it('roda no fuso de São Paulo', () => assert.equal(new Date(2025, 2, 10).getTimezoneOffset(), 180));
it('agrupa no dia local', () => assert.equal(computeStudyMetrics([activity(10)]).dailyHistory[0].date, '2025-03-10'));
it('conta um único dia local', () => assert.equal(computeStudyMetrics([activity(10, 10), activity(10)]).distinctDaysCount, 1));
it('concorda com o heatmap', () => {
 const acts = [activity(10)];
 assert.equal(computeActivityHeatmap(acts, 2025).weeks.flatMap(w => w.days).find(d => d.date === '2025-03-10').sessionsCount, 1);
 assert.equal(computeStudyMetrics(acts).dailyHistory[0].date, '2025-03-10');
});
it('interpreta data ISO curta localmente', () => assert.equal(parseDateString('2025-03-10').getDate(), 10));
it('preserva datas inválidas e brasileiras', () => { assert.ok(isNaN(parseDateString('not-a-date'))); assert.equal(parseDateString('10/03/2025').getDate(), 10); });
it('inclui o último dia do intervalo personalizado', () => assert.deepEqual(filterActivitiesByPeriod([activity(9, 10), activity(15, 10)], 'custom', '2025-03-10', '2025-03-15'), [activity(15, 10)]));
it('calcula recorde em dias locais', () => assert.equal(computeStudyMetrics([activity(10), activity(11), activity(12), activity(20)]).streak.longest, 3));
it('calcula sequência atual local', () => {
 const today = new Date(); today.setHours(8, 0, 0, 0);
 const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(22);
 assert.equal(computeStudyMetrics([today, yesterday].map(d => ({ Inicio: d.toISOString(), Duracao: 3600000 }))).streak.current, 2);
});
it('mantém a sequência de ontem quando já é noite (UTC no dia seguinte)', () => {
 const RealDate = Date; const fixedNow = new RealDate(2025, 2, 12, 23, 30).getTime();
 globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixedNow])); } static now() { return fixedNow; } };
 try { assert.equal(computeStudyMetrics([activity(11)]).streak.current, 1); } finally { globalThis.Date = RealDate; }
});
