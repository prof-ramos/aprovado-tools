/**
 * tests/circadian.test.js
 *
 * Test suite for Circadian & Temporal Patterns Engine.
 * Verifies Tier 1 (24-hour distribution, 4 shifts summing to 100%, weekday rankings)
 * and Tier 2 (Shift boundaries 05:59 vs 06:00, 23:59 vs 00:00, empty activity handling).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeCircadianDistribution } from '../shared/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json');
const mockSnapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const activities = mockSnapshot.atividades;

describe('Circadian & Temporal Distribution Test Suite', () => {
  describe('Tier 1: 24-Hour Histogram & Shift Breakdown (F5/F7)', () => {
    it('generates exactly 24 hourly buckets from 00h to 23h', () => {
      const result = computeCircadianDistribution(activities);

      assert.equal(result.hourly.length, 24);
      for (let h = 0; h < 24; h++) {
        assert.equal(result.hourly[h].hour, h);
        assert.equal(result.hourly[h].label, `${String(h).padStart(2, '0')}h`);
        assert.ok(typeof result.hourly[h].hours === 'number');
        assert.ok(typeof result.hourly[h].percentage === 'number');
        assert.ok(typeof result.hourly[h].sessions === 'number');
        assert.ok(result.hourly[h].hours >= 0);
      }
    });

    it('identifies peak study hour with highest duration and percentage', () => {
      const result = computeCircadianDistribution(activities);

      assert.ok(result.peakHour !== null);
      assert.ok(result.peakHour.hour >= 0 && result.peakHour.hour <= 23);
      assert.ok(result.peakHour.hours > 0);
      assert.ok(result.peakHour.percentage > 0);

      const maxHourlyHours = Math.max(...result.hourly.map(h => h.hours));
      assert.equal(result.peakHour.hours, maxHourlyHours);
    });

    it('partitions daytime into 4 shifts whose percentages strictly sum to 100%', () => {
      const result = computeCircadianDistribution(activities);
      const { shifts } = result;

      assert.ok(shifts.madrugada, 'Madrugada shift must exist');
      assert.ok(shifts.manha, 'Manhã shift must exist');
      assert.ok(shifts.tarde, 'Tarde shift must exist');
      assert.ok(shifts.noite, 'Noite shift must exist');

      // Check sum of shift percentages
      const shiftPercentSum =
        shifts.madrugada.percentage +
        shifts.manha.percentage +
        shifts.tarde.percentage +
        shifts.noite.percentage;

      assert.ok(
        Math.abs(shiftPercentSum - 100.0) < 0.1,
        `Shift percentages must sum to 100% (got ${shiftPercentSum}%)`
      );

      // Check shift hour sum equals hourly sum
      const shiftHoursSum =
        shifts.madrugada.hours +
        shifts.manha.hours +
        shifts.tarde.hours +
        shifts.noite.hours;

      const hourlyHoursSum = result.hourly.reduce((sum, h) => sum + h.hours, 0);
      assert.ok(
        Math.abs(shiftHoursSum - hourlyHoursSum) < 0.2,
        `Shift hours (${shiftHoursSum}) must match hourly sum (${hourlyHoursSum})`
      );

      // Dominant shift must be the one with maximum hours
      const shiftKeys = ['madrugada', 'manha', 'tarde', 'noite'];
      const maxShiftKey = shiftKeys.reduce((a, b) => (shifts[a].hours >= shifts[b].hours ? a : b));
      assert.equal(result.dominantShift, maxShiftKey);
    });

    it('generates 7 weekday rankings with volumeRank and consistencyRank', () => {
      const result = computeCircadianDistribution(activities);

      assert.equal(result.weekdayRanking.length, 7);
      const expectedDayNames = [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado'
      ];

      for (let i = 0; i < 7; i++) {
        const item = result.weekdayRanking.find(d => d.dayIndex === i);
        assert.ok(item, `Weekday ${i} must exist`);
        assert.equal(item.dayName, expectedDayNames[i]);
        assert.ok(item.volumeRank >= 1 && item.volumeRank <= 7);
        assert.ok(item.consistencyRank >= 1 && item.consistencyRank <= 7);
        assert.ok(item.activeDaysCount > 0);
      }

      // Check volume ranking order
      const sortedByVolumeRank = [...result.weekdayRanking].sort((a, b) => a.volumeRank - b.volumeRank);
      for (let i = 0; i < sortedByVolumeRank.length - 1; i++) {
        assert.ok(
          sortedByVolumeRank[i].hours >= sortedByVolumeRank[i + 1].hours,
          'Volume ranks must be ordered by hours descending'
        );
      }

      // Check consistency ranking order
      const sortedByConsistencyRank = [...result.weekdayRanking].sort((a, b) => a.consistencyRank - b.consistencyRank);
      for (let i = 0; i < sortedByConsistencyRank.length - 1; i++) {
        assert.ok(
          sortedByConsistencyRank[i].consistencyScore >= sortedByConsistencyRank[i + 1].consistencyScore,
          'Consistency ranks must be ordered by consistency score descending'
        );
      }
    });
  });

  describe('Tier 2: Boundaries & Corner Cases', () => {
    it('handles empty activities array gracefully without NaN or errors', () => {
      const emptyResult = computeCircadianDistribution([]);

      assert.equal(emptyResult.hourly.length, 24);
      for (const h of emptyResult.hourly) {
        assert.equal(h.hours, 0);
        assert.equal(h.ms, 0);
        assert.equal(h.percentage, 0);
        assert.equal(h.sessions, 0);
        assert.equal(h.accuracy, null);
      }

      assert.equal(emptyResult.peakHour.hours, 0);
      assert.equal(emptyResult.peakHour.percentage, 0);

      assert.equal(emptyResult.shifts.madrugada.percentage, 0);
      assert.equal(emptyResult.shifts.manha.percentage, 0);
      assert.equal(emptyResult.shifts.tarde.percentage, 0);
      assert.equal(emptyResult.shifts.noite.percentage, 0);

      assert.equal(emptyResult.weekdayRanking.length, 7);
      for (const w of emptyResult.weekdayRanking) {
        assert.equal(w.hours, 0);
        assert.equal(w.percentage, 0);
        assert.equal(w.sessions, 0);
        assert.equal(w.activeDaysCount, 0);
      }
    });

    it('strictly classifies exact shift boundary timestamps', () => {
      // Madrugada: [0..5] (00:00:00 - 05:59:59)
      // Manhã: [6..11] (06:00:00 - 11:59:59)
      // Tarde: [12..17] (12:00:00 - 17:59:59)
      // Noite: [18..23] (18:00:00 - 23:59:59)

      const boundaryActivities = [
        { Id: 1, HoraInicio: '00:00', Duracao: 3600000 }, // Hour 0 -> Madrugada
        { Id: 2, HoraInicio: '05:59', Duracao: 3600000 }, // Hour 5 -> Madrugada
        { Id: 3, HoraInicio: '06:00', Duracao: 3600000 }, // Hour 6 -> Manhã
        { Id: 4, HoraInicio: '11:59', Duracao: 3600000 }, // Hour 11 -> Manhã
        { Id: 5, HoraInicio: '12:00', Duracao: 3600000 }, // Hour 12 -> Tarde
        { Id: 6, HoraInicio: '17:59', Duracao: 3600000 }, // Hour 17 -> Tarde
        { Id: 7, HoraInicio: '18:00', Duracao: 3600000 }, // Hour 18 -> Noite
        { Id: 8, HoraInicio: '23:59', Duracao: 3600000 }  // Hour 23 -> Noite
      ];

      const res = computeCircadianDistribution(boundaryActivities);

      // Hourly counts
      assert.equal(res.hourly[0].sessions, 1);
      assert.equal(res.hourly[5].sessions, 1);
      assert.equal(res.hourly[6].sessions, 1);
      assert.equal(res.hourly[11].sessions, 1);
      assert.equal(res.hourly[12].sessions, 1);
      assert.equal(res.hourly[17].sessions, 1);
      assert.equal(res.hourly[18].sessions, 1);
      assert.equal(res.hourly[23].sessions, 1);

      // Shift counts: exactly 2 sessions per shift
      assert.equal(res.shifts.madrugada.sessions, 2);
      assert.equal(res.shifts.manha.sessions, 2);
      assert.equal(res.shifts.tarde.sessions, 2);
      assert.equal(res.shifts.noite.sessions, 2);

      // Each shift is exactly 25.0%
      assert.equal(res.shifts.madrugada.percentage, 25.0);
      assert.equal(res.shifts.manha.percentage, 25.0);
      assert.equal(res.shifts.tarde.percentage, 25.0);
      assert.equal(res.shifts.noite.percentage, 25.0);
    });

    it('correctly handles single-shift monopoly (100% in one shift)', () => {
      const morningOnlyActivities = [
        { Id: 1, HoraInicio: '08:00', Duracao: 7200000 },
        { Id: 2, HoraInicio: '09:30', Duracao: 3600000 }
      ];

      const res = computeCircadianDistribution(morningOnlyActivities);

      assert.equal(res.dominantShift, 'manha');
      assert.equal(res.shifts.manha.percentage, 100.0);
      assert.equal(res.shifts.madrugada.percentage, 0.0);
      assert.equal(res.shifts.tarde.percentage, 0.0);
      assert.equal(res.shifts.noite.percentage, 0.0);
    });

    it('calculates hourly accuracy when questions are present and handles null when 0 questions', () => {
      const activitiesWithQ = [
        {
          Id: 1,
          HoraInicio: '09:00',
          Duracao: 3600000,
          ExercicioQuantidade: 40,
          ExercicioAcerto: 32 // 80% accuracy
        },
        {
          Id: 2,
          HoraInicio: '15:00',
          Duracao: 3600000,
          ExercicioQuantidade: 0,
          ExercicioAcerto: 0 // 0 questions
        }
      ];

      const res = computeCircadianDistribution(activitiesWithQ);

      assert.equal(res.hourly[9].questions, 40);
      assert.equal(res.hourly[9].accuracy, 80.0);

      assert.equal(res.hourly[15].questions, 0);
      assert.equal(res.hourly[15].accuracy, null);
    });
  });
});
