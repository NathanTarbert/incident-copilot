import { describe, it, expect } from 'vitest'
import { alertTemplates, pickAlertTemplate, type AlertScenario } from '../alertTemplates'

describe('alertTemplates pool', () => {
  it('contains at least one template per scenario', () => {
    const scenarios: AlertScenario[] = ['security', 'performance', 'availability', 'data']
    for (const scenario of scenarios) {
      expect(alertTemplates.some(t => t.scenario === scenario)).toBe(true)
    }
  })

  it('every template has the required fields filled in', () => {
    for (const t of alertTemplates) {
      expect(t.title.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
      expect(['P0', 'P1', 'P2', 'P3', 'P4']).toContain(t.severity)
      expect(t.affectedServices.length).toBeGreaterThan(0)
      expect(t.source.length).toBeGreaterThan(0)
    }
  })
})

describe('pickAlertTemplate', () => {
  it('returns a template from the requested scenario when filtered', () => {
    const scenarios: AlertScenario[] = ['security', 'performance', 'availability', 'data']
    for (const scenario of scenarios) {
      // Run several times since selection is random
      for (let i = 0; i < 10; i++) {
        const t = pickAlertTemplate(scenario)
        expect(t.scenario).toBe(scenario)
      }
    }
  })

  it('returns any template when no scenario provided', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      seen.add(pickAlertTemplate().title)
    }
    // With 50 random picks across 10 templates, we should see more than 1 distinct title
    expect(seen.size).toBeGreaterThan(1)
  })
})
