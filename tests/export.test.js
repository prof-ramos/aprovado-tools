import { it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvField, buildActivitiesCSV, buildSubjectsSummaryCSV } from '../shared/export.js';

function parseRow(row) {
  const fields = []; let value = ''; let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') { if (quoted && row[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ';' && !quoted) { fields.push(value); value = ''; }
    else value += c;
  }
  fields.push(value); return fields;
}
it('quotes semicolon fields', () => assert.equal(escapeCsvField('a;b'), '"a;b"'));
it('doubles embedded quotes', () => assert.equal(escapeCsvField('diz "oi"'), '"diz ""oi"""'));
it('quotes newlines', () => assert.equal(escapeCsvField('linha1\nlinha2'), '"linha1\nlinha2"'));
it('preserves empty and numeric fields', () => { assert.equal(escapeCsvField(null), ''); assert.equal(escapeCsvField(undefined), ''); assert.equal(escapeCsvField(0), '0'); });
it('exports twelve activity columns with intact notes', () => {
  const csv = buildActivitiesCSV([{ Id: 1, DataInicio: '10/03/2025', HoraInicio: '22:30', Duracao: 3600000, Materia: { Nome: 'Direito Penal' }, Conteudo: { Nome: 'Crimes' }, TipoEstudo: 'Teoria', Anotacoes: 'Lei 8.112; art. 5º' }]);
  assert.ok(csv.startsWith('\uFEFF')); const rows = csv.split('\r\n'); assert.equal(rows.length, 2); const fields = parseRow(rows[1]); assert.equal(fields.length, 12); assert.equal(fields[11], 'Lei 8.112; art. 5º');
});
it('exports empty activities as header only', () => { const csv = buildActivitiesCSV([]); assert.ok(csv.startsWith('\uFEFFID Atividade;')); assert.equal(csv.split('\r\n').length, 1); });
it('exports nine subject columns with intact name', () => { const csv = buildSubjectsSummaryCSV([{ name: 'Penal; Geral', formattedDuration: '1h 0m', durationMs: 3600000, sessionsCount: 1, percentage: 100, questions: 10, correct: 8, accuracy: 80, contents: [] }]); const fields = parseRow(csv.split('\r\n')[1]); assert.equal(fields.length, 9); assert.equal(fields[0], 'Penal; Geral'); });
