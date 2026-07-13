-- 누가 누굴 조회했는지
SELECT
  B.nickname,
  A.name,
  A."birthDate",
  A."updatedAt"
FROM "SajuEntry" AS A
JOIN "User" AS B
  ON A."userId" = B.id
WHERE B.nickname IS NOT NULL
  AND B.nickname <> '이상진'
order by A."updatedAt" DESC;

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


SELECT
  c.code,
  c.ju,
  c.active,
  c."maxRedemptions"                         AS max_limit,      -- NULL = 무제한
  c."redeemedCount"                          AS used_cached,    -- Coupon에 캐시된 사용 수
  COUNT(r.id)                                AS used_actual,    -- Redemption 실측
  CASE
    WHEN c."maxRedemptions" IS NULL THEN NULL
    ELSE GREATEST(c."maxRedemptions" - COUNT(r.id), 0)
  END                                        AS remaining,      -- 남은 수량 (무제한이면 NULL)
  c."expiresAt",
  c.note,
  c."createdAt"
FROM "Coupon" c
LEFT JOIN "CouponRedemption" r
  ON r."couponId" = c.id
GROUP BY
  c.id, c.code, c.ju, c.active, c."maxRedemptions",
  c."redeemedCount", c."expiresAt", c.note, c."createdAt"
ORDER BY c."createdAt" DESC;

-- 특정 코드만
SELECT
  c.code,
  c."maxRedemptions" AS max_limit,
  COUNT(r.id) AS used,
  CASE
    WHEN c."maxRedemptions" IS NULL THEN NULL
    ELSE GREATEST(c."maxRedemptions" - COUNT(r.id), 0)
  END AS remaining
FROM "Coupon" c
LEFT JOIN "CouponRedemption" r ON r."couponId" = c.id
WHERE c.code = 'EARLY15'   -- 원하는 코드
GROUP BY c.id, c.code, c."maxRedemptions";
