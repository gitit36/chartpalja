/**
 * 엔진(saju_engine) 점수 스케일과 맞추는 클라 상수.
 * `_SCORE_BIAS` / `SCORE_SCHEMA_VERSION` 기본값과 동기화 유지.
 */
export const SCORE_BIAS_DEFAULT = 10
export const SCORE_SCHEMA_VERSION = '7.1-domain-chain'

/** 엔진 도메인(0~10) → 종합과 같은 0~100 (SCORE_BIAS 포함) */
export function domain10To100(v: number, bias: number = SCORE_BIAS_DEFAULT): number {
  return Math.max(0, Math.min(100, Math.round(v * 10 + bias)))
}

/**
 * 일운 도메인(0~100, bias 포함) → ChartDatum 엔진 스케일(0~10).
 * ChartTab domainValue가 다시 ×10+bias 하므로 왕복 정합.
 */
export function domain100ToEngine10(v: number, bias: number = SCORE_BIAS_DEFAULT): number {
  return Math.max(0, Math.min(10, (v - bias) / 10))
}
