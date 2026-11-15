import { useState } from 'react'
import { BarChart } from '../charts/BarChart'
import { LineChart } from '../charts/LineChart'
import { Readout, Section } from '../components/bits'
import { formatClock, minuteOfDay, MISSION_DAYS } from '../sim/mission'
import { bodySeries, dayRecord, exerciseSoFar, eyeCheckDue, nextEyeCheck, vitalsAt, projectedBodySeries, projectBodyAtMissionEnd, projectedNoExerciseSeries, averageAdherence } from '../sim/model'
import { useCrew, useSnapshot, useTodayGlucose, useLatestGlucose, useNutritionTotals, useAddGlucose, useAddNutrition } from '../store/hooks'
import { dayKey, useStore } from '../store/store'

const ACTIVITY_NOTE = { sleep: 'asleep', cardio: 'during cardio', resistance: 'during resistance', awake: 'at rest' } as const

const GLUCOSE_CONTEXTS = [
  { value: 'fasting', label: 'Fasting (morning)' },
  { value: 'pre-meal', label: 'Pre-meal' },
  { value: 'post-meal', label: 'Post-meal (2hr)' },
  { value: 'bedtime', label: 'Bedtime' },
] as const

function glucoseStatus(value: number): 'urgent' | 'act' | 'watch' | 'nominal' {
  if (value >= 180) return 'urgent'
  if (value >= 140) return 'act'
  if (value >= 100) return 'watch'
  return 'nominal'
}

function glucoseStatusLabel(status: string) {
  switch (status) {
    case 'urgent': return 'High - Act now'
    case 'act': return 'Elevated - Monitor'
    case 'watch': return 'Above optimal'
    default: return 'Normal'
  }
}

export function Body() {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const logEyeCheck = useStore((s) => s.logEyeCheck)
  const snap = useSnapshot()
  const day = snap.day
  const eyeDone = useStore((s) => Boolean(s.eyeChecks[dayKey(s.crewId, day)]))
  const rec = dayRecord(crew, day, scenarios)
  const done = exerciseSoFar(crew, t, scenarios)

  // Glucose & Nutrition
  const todayGlucose = useTodayGlucose()
  const latestGlucose = useLatestGlucose()
  const nutritionTotals = useNutritionTotals()
  const addGlucose = useAddGlucose()
  const addNutrition = useAddNutrition()
  const [glucoseForm, setGlucoseForm] = useState({ value: '', context: 'fasting' as const })
  const [nutritionForm, setNutritionForm] = useState({ calories: '', protein: '', carbs: '', fat: '', water: '' })

  const body = bodySeries(crew, day, scenarios)
  const projected = projectedBodySeries(crew, day, scenarios)
  const projectedNoExercise = projectedNoExerciseSeries(crew, day)
  const last = body[body.length - 1]
  const projection = projectBodyAtMissionEnd(crew, day, scenarios)
  const adherence = averageAdherence(crew, day, scenarios)
  const noExerciseBone = body.map((p) => ({ x: p.day, y: (-1.25 / 30) * p.day }))
  const noExerciseProjected = projectedNoExercise.map((p) => ({ x: p.day, y: p.bone }))

  const exerciseBars = Array.from({ length: 14 }, (_, i) => {
    const d = day - 14 + i
    const r = dayRecord(crew, Math.max(1, d), scenarios)
    return { label: `Day ${d}`, value: r.cardioDone + r.resistanceDone, tick: i % 2 === 1 ? String(d) : undefined }
  })

  const heart = Array.from({ length: 30 }, (_, i) => {
    const d = Math.max(1, day - 29 + i)
    return { x: d, y: dayRecord(crew, d, scenarios).restingHr }
  })

  const liveHeart = Array.from({ length: 31 }, (_, i) => {
    const at = t - (30 - i)
    return { x: at, y: vitalsAt(crew, at, scenarios).heartRate }
  })

  const dueToday = eyeCheckDue(crew, day)
  const nextEye = dueToday && eyeDone ? nextEyeCheck(crew, day + 1) : nextEyeCheck(crew, day)

  const handleGlucoseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(glucoseForm.value)
    if (!value || value < 20 || value > 500) return
    addGlucose({ value, context: glucoseForm.context, timestamp: t })
    setGlucoseForm({ value: '', context: 'fasting' })
  }

  const handleNutritionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const calories = Number(nutritionForm.calories) || 0
    const protein = Number(nutritionForm.protein) || 0
    const carbs = Number(nutritionForm.carbs) || 0
    const fat = Number(nutritionForm.fat) || 0
    const water = Number(nutritionForm.water) || 0
    if (!calories && !protein && !carbs && !fat && !water) return
    addNutrition({ calories, protein, carbs, fat, water, timestamp: t })
    setNutritionForm({ calories: '', protein: '', carbs: '', fat: '', water: '' })
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Body</h1>
        <p className="page-intro">
          Without gravity, bones and muscles weaken and the heart works differently. Daily exercise is the main protection, so this page
          tracks what you have done and what it is saving.
        </p>
      </header>

      {/* Glucose Tracking */}
      <Section title="Blood glucose" note="Normal fasting: 70-99 mg/dL. Post-meal (2hr): under 140 mg/dL. Log readings throughout the day.">
        <div className="glucose-section">
          {/* Latest reading card */}
          {latestGlucose && (
            <div className="glucose-latest">
              <div className="glucose-value-row">
                <span className={`glucose-value ${glucoseStatus(latestGlucose.value)}`}>{latestGlucose.value}</span>
                <span className="glucose-unit">mg/dL</span>
                <span className={`glucose-status ${glucoseStatus(latestGlucose.value)}`}>{glucoseStatusLabel(glucoseStatus(latestGlucose.value))}</span>
              </div>
              <div className="glucose-meta">
                <span>Context: {GLUCOSE_CONTEXTS.find(c => c.value === latestGlucose.context)?.label}</span>
                <span>Logged: {formatClock(minuteOfDay(latestGlucose.timestamp))}</span>
              </div>
            </div>
          )}

          {/* Today's readings */}
          <div className="glucose-readings">
            {todayGlucose.length === 0 ? (
              <p className="muted">No readings today. Add your first below.</p>
            ) : (
              <div className="glucose-list">
                {todayGlucose.map((g) => (
                  <div key={g.timestamp} className={`glucose-item ${glucoseStatus(g.value)}`}>
                    <span className="glucose-item-value">{g.value} mg/dL</span>
                    <span className="glucose-item-context">{GLUCOSE_CONTEXTS.find(c => c.value === g.context)?.label}</span>
                    <span className="glucose-item-time">{formatClock(minuteOfDay(g.timestamp))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add glucose form */}
          <form onSubmit={handleGlucoseSubmit} className="glucose-form">
            <div className="glucose-form-row">
              <label>
                <span>Glucose (mg/dL)</span>
                <input
                  type="number"
                  min={20}
                  max={500}
                  placeholder="e.g., 95"
                  value={glucoseForm.value}
                  onChange={(e) => setGlucoseForm({ ...glucoseForm, value: e.target.value })}
                  required
                  inputMode="numeric"
                />
              </label>
              <label>
                <span>Context</span>
                <select value={glucoseForm.context} onChange={(e) => setGlucoseForm({ ...glucoseForm, context: e.target.value as typeof glucoseForm.context })}>
                  {GLUCOSE_CONTEXTS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="btn">Log reading</button>
          </form>
        </div>
      </Section>

      {/* Nutrition Tracking */}
      <Section title="Nutrition & Hydration" note="Target: 2,800 kcal; 100g protein; 3L water daily. Log meals and hydration throughout the day.">
        <div className="nutrition-section">
          {/* Totals cards */}
          <div className="nutrition-totals">
            <div className="nutrition-total">
              <span className="nutrition-total-value">{nutritionTotals.calories.toLocaleString()}</span>
              <span className="nutrition-total-label">kcal / 2,800</span>
              <div className="nutrition-total-bar">
                <div className="nutrition-total-fill" style={{ width: `${Math.min(100, (nutritionTotals.calories / 2800) * 100)}%` }} />
              </div>
            </div>
            <div className="nutrition-total">
              <span className="nutrition-total-value">{nutritionTotals.protein.toLocaleString()}</span>
              <span className="nutrition-total-label">g protein / 100</span>
              <div className="nutrition-total-bar">
                <div className="nutrition-total-fill" style={{ width: `${Math.min(100, (nutritionTotals.protein / 100) * 100)}%` }} />
              </div>
            </div>
            <div className="nutrition-total">
              <span className="nutrition-total-value">{nutritionTotals.water.toFixed(1)}</span>
              <span className="nutrition-total-label">L water / 3.0</span>
              <div className="nutrition-total-bar">
                <div className="nutrition-total-fill" style={{ width: `${Math.min(100, (nutritionTotals.water / 3) * 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Add nutrition form */}
          <form onSubmit={handleNutritionSubmit} className="nutrition-form">
            <div className="nutrition-form-grid">
              <label>
                <span>Calories (kcal)</span>
                <input type="number" min={0} max={5000} placeholder="e.g., 350" value={nutritionForm.calories} onChange={(e) => setNutritionForm({ ...nutritionForm, calories: e.target.value })} inputMode="numeric" />
              </label>
              <label>
                <span>Protein (g)</span>
                <input type="number" min={0} max={500} placeholder="e.g., 30" value={nutritionForm.protein} onChange={(e) => setNutritionForm({ ...nutritionForm, protein: e.target.value })} inputMode="numeric" />
              </label>
              <label>
                <span>Carbs (g)</span>
                <input type="number" min={0} max={500} placeholder="e.g., 40" value={nutritionForm.carbs} onChange={(e) => setNutritionForm({ ...nutritionForm, carbs: e.target.value })} inputMode="numeric" />
              </label>
              <label>
                <span>Fat (g)</span>
                <input type="number" min={0} max={200} placeholder="e.g., 15" value={nutritionForm.fat} onChange={(e) => setNutritionForm({ ...nutritionForm, fat: e.target.value })} inputMode="numeric" />
              </label>
              <label>
                <span>Water (L)</span>
                <input type="number" step="0.1" min={0} max={10} placeholder="e.g., 0.5" value={nutritionForm.water} onChange={(e) => setNutritionForm({ ...nutritionForm, water: e.target.value })} inputMode="numeric" />
              </label>
            </div>
            <button type="submit" className="btn">Log meal</button>
          </form>
        </div>
      </Section>

      <Section title="Exercise today">
        <div>
          <div className="progress-row">
            <div>
              <div className="progress-name">Cardio</div>
              <div className="muted">from {formatClock(rec.cardioStart)}</div>
            </div>
            <div className="progress-track" role="progressbar" aria-label="Cardio" aria-valuemin={0} aria-valuemax={done.cardioPlanned} aria-valuenow={Math.round(done.cardioDone)}>
              <div className="progress-fill" style={{ width: `${(done.cardioDone / done.cardioPlanned) * 100}%` }} />
            </div>
            <div className="progress-value">
              {Math.round(done.cardioDone)} of {done.cardioPlanned} min
            </div>
          </div>
          <div className="progress-row">
            <div>
              <div className="progress-name">Resistance</div>
              <div className="muted">from {formatClock(rec.resistanceStart)}</div>
            </div>
            <div className="progress-track" role="progressbar" aria-label="Resistance" aria-valuemin={0} aria-valuemax={done.resistancePlanned} aria-valuenow={Math.round(done.resistanceDone)}>
              <div className="progress-fill" style={{ width: `${(done.resistanceDone / done.resistancePlanned) * 100}%` }} />
            </div>
            <div className="progress-value">
              {Math.round(done.resistanceDone)} of {done.resistancePlanned} min
            </div>
          </div>
        </div>
      </Section>

      <Section title="Exercise, last 14 days" note="Minutes completed each day against the 100 minutes prescribed.">
        <BarChart
          label="Minutes of exercise completed on each of the last 14 days"
          bars={exerciseBars}
          yMax={120}
          yFormat={(v) => `${Math.round(v)} min`}
          xHeader="Mission day"
          yHeader="Exercise"
          refLine={{ y: 100, label: 'Prescribed 100 min' }}
        />
      </Section>

      <Section
        title="Bone and muscle since launch"
        note={`Estimated from your exercise record. Hip bone density is down ${Math.abs(last.bone).toFixed(1)}% and leg strength ${Math.abs(last.muscle).toFixed(1)}%. With no exercise, bone loss would be about ${Math.abs(noExerciseBone[noExerciseBone.length - 1].y).toFixed(1)}%.`}
      >
        <LineChart
          label="Estimated change in bone density and leg strength since launch, with projection to mission end"
          series={[
            { name: 'Hip bone density (actual)', points: body.map((p) => ({ x: p.day, y: p.bone })) },
            { name: 'Leg strength (actual)', points: body.map((p) => ({ x: p.day, y: p.muscle })), style: 'dashed' },
            { name: 'Hip bone density (projected)', points: projected.slice(day).map((p) => ({ x: p.day, y: p.bone })), style: 'dotted', tone: 1 },
            { name: 'Leg strength (projected)', points: projected.slice(day).map((p) => ({ x: p.day, y: p.muscle })), style: 'dotted', tone: 1 },
            { name: 'Bone, no exercise (actual)', points: noExerciseBone, style: 'dotted', tone: 2 },
            { name: 'Bone, no exercise (projected)', points: noExerciseProjected, style: 'dotted', tone: 2 },
          ]}
          xFormat={(x) => `Day ${Math.round(x)}`}
          yFormat={(y) => `${y.toFixed(1)}%`}
          xHeader="Mission day"
          directLabels
          height={280}
          refs={[
            { y: 0, label: 'Baseline', tone: 'neutral' },
            { y: projection.bone, label: `Projected: ${Math.abs(projection.bone).toFixed(1)}%`, tone: 'watch' },
            { y: projection.muscle, label: `Projected muscle: ${Math.abs(projection.muscle).toFixed(1)}%`, tone: 'watch' },
          ]}
        />
      </Section>

      <Section
        title={`Projection at mission end (Day ${MISSION_DAYS})`}
        note={`Current exercise adherence: ${(adherence * 100).toFixed(0)}%. Projected hip bone loss: ${Math.abs(projection.bone).toFixed(1)}%, leg strength loss: ${Math.abs(projection.muscle).toFixed(1)}%.`}
      >
        <div className="projection-cards">
          <div className="projection-card">
            <div className="projection-label">Hip bone density</div>
            <div className="projection-value">{Math.abs(projection.bone).toFixed(1)}% loss</div>
            <div className="projection-detail">
              At current adherence ({(adherence * 100).toFixed(0)}%), projected loss by Day {MISSION_DAYS}.
            </div>
          </div>
          <div className="projection-card">
            <div className="projection-label">Leg strength</div>
            <div className="projection-value">{Math.abs(projection.muscle).toFixed(1)}% loss</div>
            <div className="projection-detail">
              At current adherence ({(adherence * 100).toFixed(0)}%), projected loss by Day {MISSION_DAYS}.
            </div>
          </div>
          <div className="projection-card">
            <div className="projection-label">No-exercise scenario</div>
            <div className="projection-value">{Math.abs((-1.25 / 30) * MISSION_DAYS).toFixed(1)}% loss</div>
            <div className="projection-detail">If no exercise were performed at all.</div>
          </div>
          <div className="projection-card">
            <div className="projection-label">Target (with full exercise)</div>
            <div className="projection-value">{Math.abs(((1.25 - 0.9) / 30) * MISSION_DAYS).toFixed(1)}% loss</div>
            <div className="projection-detail">If 100% exercise adherence were maintained.</div>
          </div>
        </div>
      </Section>

      <Section title="Heart rate now" note="The last 30 minutes, one reading a minute.">
        <div className="split split-narrow">
          <div className="readouts">
            <Readout
              big
              label="Heart rate"
              value={snap.vitals.heartRate}
              unit="beats/min"
              note={snap.vitals.irregular ? 'Irregular rhythm' : ACTIVITY_NOTE[snap.vitals.activity]}
              level={snap.vitals.irregular ? 'urgent' : null}
            />
          </div>
          <LineChart
            label="Heart rate over the last 30 minutes"
            series={[{ name: 'Heart rate', points: liveHeart }]}
            xFormat={(x) => formatClock(minuteOfDay(x))}
            yFormat={(y) => `${Math.round(y)}`}
            xHeader="Ship time"
            yDomain={[40, Math.max(120, ...liveHeart.map((p) => p.y)) + 10]}
            xTicks={[t - 30, t - 20, t - 10, t]}
            refs={[{ y: 110, label: 'Act above 110 at rest', tone: 'watch' }]}
            height={220}
          />
        </div>
      </Section>

      <div className="split">
        <Section title="Resting heart rate" note="Each morning for the last 30 days.">
          <LineChart
            label="Resting heart rate each morning over the last 30 days"
            series={[{ name: 'Resting heart rate', points: heart }]}
            xFormat={(x) => `Day ${Math.round(x)}`}
            yFormat={(y) => `${Math.round(y)}`}
            xHeader="Mission day"
            refs={[{ y: crew.restingHr, label: `Before launch ${crew.restingHr}` }]}
            height={200}
          />
          <dl className="facts" style={{ marginTop: 24 }}>
            <div>
              <dt>Blood pressure, this morning</dt>
              <dd>
                {rec.systolic}/{rec.diastolic} <small>mmHg</small>
              </dd>
            </div>
          </dl>
        </Section>

        <Section
          title="Eyes"
          note="Fluid shifts towards the head in weightlessness and can change the shape of the eye. A check every 14 days catches it early."
        >
          <dl className="facts">
            <div>
              <dt>Next eye check</dt>
              <dd>{dueToday && !eyeDone ? 'Due today' : `Day ${nextEye}`}</dd>
            </div>
          </dl>
          <p style={{ marginTop: 16 }}>
            {dueToday && !eyeDone ? (
              <button className="btn" onClick={logEyeCheck}>
                Log eye check as done
              </button>
            ) : dueToday ? (
              <span className="muted">Eye check logged today.</span>
            ) : (
              <span className="muted">Nothing to do until then.</span>
            )}
          </p>
        </Section>
      </div>
    </>
  )
}