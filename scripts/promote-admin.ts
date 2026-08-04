/**
 * 관리자 권한 부여/회수.
 *
 * 사용:
 *   npx tsx scripts/promote-admin.ts will36@naver.com
 *   npx tsx scripts/promote-admin.ts will36@naver.com --off
 */
import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim()
  const off = process.argv.includes('--off')
  if (!email || email.startsWith('--')) {
    console.error('사용: npx tsx scripts/promote-admin.ts <email> [--off]')
    process.exit(1)
  }

  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) {
    console.error(`[fail] 사용자 없음: ${email}`)
    process.exit(1)
  }

  const role = off ? UserRole.USER : UserRole.ADMIN
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role },
  })
  console.log('[ok]', {
    id: updated.id,
    email: updated.email,
    nickname: updated.nickname,
    role: updated.role,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
