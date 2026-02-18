/**
 * Test script: run against Python Saju service.
 * Start Python service first: cd python_service && uvicorn main:app --reload
 * Then: npx tsx src/lib/saju/run.ts
 */
import { buildSajuReportViaPython } from './saju-report'

async function main() {
  const report = await buildSajuReportViaPython({
    birthDate: '1997-03-06',
    birthTime: '03:25',
    timeUnknown: false,
    gender: 'male',
    city: 'Seoul',
    useSolarTime: true,
    earlyZiTime: true,
    utcOffset: 9,
  })
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
