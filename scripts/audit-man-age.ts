import { PrismaClient } from '@prisma/client'
import { calcManAge, parseBirthYmd } from '../src/lib/saju/man-age'

const prisma = new PrismaClient()

function yearDiff(birthDate: string, now = new Date()) {
  const y = parseInt(birthDate.slice(0, 4), 10)
  if (!Number.isFinite(y)) return null
  return now.getFullYear() - y
}

function normalizeDate(s: string) {
  return s.trim().replace(/\./g, '-').slice(0, 10)
}

async function main() {
  const rows = await prisma.sajuEntry.findMany({
    select: {
      id: true,
      name: true,
      birthDate: true,
      isLunar: true,
      sajuReportJson: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()
  console.log(`total entries: ${rows.length}`)
  console.log(`as of: ${now.toISOString()}`)
  console.log('---')

  const badParse: Array<{ id: string; name: string; birthDate: string }> = []
  const ageWouldBeWrong: Array<{
    id: string
    name: string
    birthDate: string
    oldYearDiff: number
    manAge: number
  }> = []
  const reportMismatch: Array<{
    id: string
    name: string
    birthDate: string
    reportBirth: string
  }> = []
  const formats = new Map<string, number>()

  for (const r of rows) {
    const fmt =
      /^\d{4}-\d{2}-\d{2}/.test(r.birthDate)
        ? 'YYYY-MM-DD'
        : /^\d{4}\.\d{2}\.\d{2}/.test(r.birthDate)
          ? 'YYYY.MM.DD'
          : /^\d{8}$/.test(r.birthDate)
            ? 'YYYYMMDD'
            : 'other'
    formats.set(fmt, (formats.get(fmt) ?? 0) + 1)

    const parsed = parseBirthYmd(r.birthDate)
    const man = calcManAge(r.birthDate, now)
    const old = yearDiff(r.birthDate, now)

    if (!parsed || man == null) {
      badParse.push({ id: r.id, name: r.name, birthDate: r.birthDate })
    }

    if (old != null && man != null && old !== man) {
      ageWouldBeWrong.push({
        id: r.id,
        name: r.name,
        birthDate: r.birthDate,
        oldYearDiff: old,
        manAge: man,
      })
    }

    const report = r.sajuReportJson as Record<string, unknown> | null
    const inp = (report?.['입력정보'] ?? null) as Record<string, unknown> | null
    const reportBirth =
      typeof inp?.birth_date === 'string'
        ? inp.birth_date
        : typeof inp?.birthDate === 'string'
          ? (inp.birthDate as string)
          : null

    if (reportBirth && normalizeDate(reportBirth) !== normalizeDate(r.birthDate)) {
      reportMismatch.push({
        id: r.id,
        name: r.name,
        birthDate: r.birthDate,
        reportBirth,
      })
    }
  }

  console.log('birthDate formats:', Object.fromEntries(formats))
  console.log('unparseable birthDate:', badParse.length)
  for (const r of badParse) {
    console.log(`  BAD ${r.name} birthDate=${JSON.stringify(r.birthDate)} id=${r.id}`)
  }

  console.log(`\nwould show wrong age under old yearDiff (birthday not yet): ${ageWouldBeWrong.length}`)
  for (const m of ageWouldBeWrong) {
    console.log(
      `  ${m.name.padEnd(14)} ${m.birthDate}  displayed(old)=${m.oldYearDiff} → man=${m.manAge}`,
    )
  }

  console.log(`\nentry.birthDate ≠ report 입력정보.birth_date: ${reportMismatch.length}`)
  for (const m of reportMismatch.slice(0, 40)) {
    console.log(`  ${m.name} entry=${m.birthDate} report=${m.reportBirth}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
