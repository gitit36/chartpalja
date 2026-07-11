-- 누가 누굴 조회했는지
SELECT
  B.nickname,
  A.name,
  A."birthDate"
FROM "SajuEntry" AS A
JOIN "User" AS B
  ON A."userId" = B.id
WHERE B.nickname IS NOT NULL
  AND B.nickname <> '이상진'
order by A."createdAt" DESC;

'''
select * from "SajuEntry" where name = '이상진';
"""
g_cw69mkc6vqvmlxmm08t
g_mj2y2itp0qmmaq29xz
g_erh99jd7k2mm3rp9mn
"""

select * from "SajuEntry" where "guestId" = 'g_erh99jd7k2mm3rp9mn';

select * from "SajuEntry" where id = 'cmm3rpnsz0004fdposlu6mquy';
'''

-- 쿠폰 누가썼는지
SELECT
  B.nickname
FROM "CouponRedemption" AS A
JOIN "User" AS B
  ON A."userId" = B.id
WHERE B.nickname IS NOT NULL
  AND B.nickname <> '이상진';

-- 사람별 잔액
SELECT
  B.nickname,
  A.ju
FROM "UserBalance" AS A
JOIN "User" AS B
  ON A."userId" = B.id
WHERE B.nickname IS NOT NULL
  AND B.nickname <> '이상진';

-- 누가 초대 링크 생성했는지
SELECT DISTINCT
  B.nickname
FROM "CompatInvite" AS A
JOIN "User" AS B
  ON A."inviterUserId" = B.id
;

select * from "SajuEntry" t order by "updatedAt" DESC;
