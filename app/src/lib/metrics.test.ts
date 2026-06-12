/**
 * Regresné testy pre výpočtové jadro (v5.1)
 * Spustenie: npm test
 */

import { describe, it, expect } from 'vitest'
import {
  calculateERBenchmark,
  calculateScore,
  calculateMarketValue,
  calculateValueBreakdown,
  calculateConversionPrediction,
  estimateDelivery,
  calculateViralPotential,
} from './metrics'

describe('calculateERBenchmark — size-adjusted rating', () => {
  it('2% ER je GOOD pre 1M followers (macro)', () => {
    expect(calculateERBenchmark(2, 1_000_000).rating).toBe('GOOD')
  })

  it('2% ER je BELOW_AVERAGE pre 5K followers (nano)', () => {
    expect(calculateERBenchmark(2, 5_000).rating).toBe('BELOW_AVERAGE')
  })

  it('10% ER je EXCELLENT pre nano účet', () => {
    expect(calculateERBenchmark(10, 5_000).rating).toBe('EXCELLENT')
  })

  it('0.3% ER je POOR pre 200K účet', () => {
    expect(calculateERBenchmark(0.3, 200_000).rating).toBe('POOR')
  })
})

describe('calculateScore — vážený priemer s ER ratingom', () => {
  it('perfektný profil → 10/10 STRONG BUY', () => {
    const s = calculateScore(3.0, 'EXCELLENT', 5, 10)
    expect(s.finalScore).toBe(10)
    expect(s.recommendation).toBe('STRONG BUY')
  })

  it('slabý profil → PASS', () => {
    const s = calculateScore(0.5, 'POOR', 0.3, 2)
    // price 3×0.4 + engagement 2×0.25 + reach 4×0.2 + safety 2×0.15 = 2.8
    expect(s.finalScore).toBeCloseTo(2.8, 2)
    expect(s.recommendation).toBe('PASS')
  })

  it('engagement score sa odvíja od ratingu, nie absolútneho ER', () => {
    const good = calculateScore(1.5, 'GOOD', 1, 7)
    const poor = calculateScore(1.5, 'POOR', 1, 7)
    expect(good.engagementScore).toBe(8)
    expect(poor.engagementScore).toBe(2)
    expect(good.finalScore).toBeGreaterThan(poor.finalScore)
  })
})

describe('calculateValueBreakdown — žiadne dvojité počítanie média', () => {
  const delivery = estimateDelivery(50_000, 120_000, 3_000, 100, {
    reelsPerMonth: 2,
    postsPerMonth: 1,
    storiesPerMonth: 4,
  }, 6)

  it('totalValue = max(reach, engagement) + content (nie súčet všetkých troch)', () => {
    const vb = calculateValueBreakdown(delivery, 15_000, 6, 'GOOD', 80_000)
    expect(vb.totalValue).toBe(Math.max(vb.reachValue, vb.engagementValue) + vb.contentValue)
    expect(vb.totalValue).toBeLessThan(vb.reachValue + vb.engagementValue + vb.contentValue)
  })

  it('valueRatio = totalValue / totalCost', () => {
    const vb = calculateValueBreakdown(delivery, 15_000, 6, 'GOOD', 80_000)
    expect(vb.totalCost).toBe(90_000)
    expect(vb.valueRatio).toBeCloseTo(vb.totalValue / 90_000, 2)
  })

  it('lepší ER rating → vyšší dynamický CPM aj CPE', () => {
    const excellent = calculateValueBreakdown(delivery, 15_000, 6, 'EXCELLENT', 80_000)
    const poor = calculateValueBreakdown(delivery, 15_000, 6, 'POOR', 80_000)
    expect(excellent.dynamicCPM).toBeGreaterThan(poor.dynamicCPM)
    expect(excellent.dynamicCPE).toBeGreaterThan(poor.dynamicCPE)
  })
})

describe('calculateConversionPrediction — realistické IG CTR', () => {
  it('CTR možnosti sú 0.5/1/2 % (nie 1/2/3)', () => {
    const p = calculateConversionPrediction(1_000_000, 500, 90_000, 'AVERAGE')
    expect(p.ctrOptions).toEqual([0.5, 1, 2])
  })

  it('matica je 3×3 a break-even sedí', () => {
    const p = calculateConversionPrediction(1_000_000, 500, 90_000, 'GOOD')
    expect(p.scenarioMatrix).toHaveLength(3)
    expect(p.scenarioMatrix![0]).toHaveLength(3)
    expect(p.breakEvenSales).toBe(Math.ceil(90_000 / 500))
    for (const row of p.scenarioMatrix!) {
      for (const s of row) {
        const expectedClicks = Math.round(1_000_000 * (s.ctr / 100))
        expect(s.clicks).toBe(expectedClicks)
        expect(s.conversions).toBe(Math.round(expectedClicks * (s.conversionRate / 100)))
        expect(s.isProfitable).toBe(s.roi > 0)
      }
    }
  })

  it('bez AOV nevracia maticu, ale clicks áno', () => {
    const p = calculateConversionPrediction(500_000, undefined, undefined, 'AVERAGE')
    expect(p.scenarioMatrix).toBeUndefined()
    expect(p.expectedClicks).toBeGreaterThan(0)
  })
})

describe('calculateMarketValue — celebrity premium', () => {
  it('celebrity bonus len pre verified účty 500K+', () => {
    const verified = calculateMarketValue(600_000, 1.5, 'GOOD', true)
    const unverified = calculateMarketValue(600_000, 1.5, 'GOOD', false)
    expect(verified.celebrityBonus).toBe(1.3)
    expect(unverified.celebrityBonus).toBe(1.0)
  })

  it('2M+ verified → 2× premium', () => {
    expect(calculateMarketValue(2_500_000, 1.5, 'GOOD', true).celebrityBonus).toBe(2.0)
  })
})

describe('estimateDelivery — 0 deliverables regression (v4.8 bug)', () => {
  it('0 reels/posts/stories → nulové totals, žiadne NaN', () => {
    const d = estimateDelivery(50_000, 100_000, 3_000, 100, {
      reelsPerMonth: 0,
      postsPerMonth: 0,
      storiesPerMonth: 0,
    }, 6)
    expect(d.totalContent).toBe(0)
    expect(d.totalReach).toBe(0)
    expect(d.totalEngagements).toBe(0)
    expect(Number.isNaN(d.monthlyReach)).toBe(false)
  })
})

describe('calculateViralPotential', () => {
  it('konzistentný profil → LOW viral rating', () => {
    const posts = Array.from({ length: 10 }, () => ({ type: 'Video', videoViewCount: 50_000 }))
    const vp = calculateViralPotential(posts)
    expect(vp.viralRating).toBe('LOW')
    expect(vp.consistency).toBe(1)
  })

  it('profil s virálnym outlierom → vysoký viral score', () => {
    const posts = [
      { type: 'Video', videoViewCount: 1_000_000 },
      ...Array.from({ length: 9 }, () => ({ type: 'Video', videoViewCount: 30_000 })),
    ]
    const vp = calculateViralPotential(posts)
    expect(vp.viralScore).toBeGreaterThanOrEqual(6)
    expect(vp.maxReelViews).toBe(1_000_000)
  })

  it('žiadne videá → nuly, žiadne NaN', () => {
    const vp = calculateViralPotential([{ type: 'Image' }])
    expect(vp.viralScore).toBe(0)
    expect(vp.prediction.realistic).toBe(0)
  })
})
