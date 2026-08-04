-- 누가 누굴 조회했는지
SELECT
  B.nickname as "고객명",
  A.name as "기입이름",
  A."birthDate",
  A."updatedAt",
  B.email
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

-- 카카오로그인 한 사람들만
SELECT
  A.id,
  A."kakaoId",
  A.email,
  A.nickname,
  B."birthDate",
  A."createdAt"
FROM "User" as A
left join "SajuEntry" AS B
	ON B."userId" = A.id 
WHERE A."kakaoId" <> 'test_reviewer_account'
ORDER BY A."createdAt" DESC;

-- 카카오로그인 몇명?
SELECT COUNT(*) AS kakao_users
FROM "User"
WHERE "kakaoId" <> 'test_reviewer_account';

-- 쿠폰 누가썼는지
SELECT
  B.nickname
FROM "CouponRedemption" AS A
JOIN "User" AS B
  ON A."userId" = B.id
WHERE B.nickname IS NOT NULL
  AND B.nickname <> '이상진';

-- 엔트리 몇개씩?
SELECT
  u.id,
  u.email,
  u.nickname,
  u."updatedAt",
  COUNT(e.id) AS entry_count
FROM "User" u
LEFT JOIN "SajuEntry" e 
	ON e."userId" = u.id
WHERE u."kakaoId" <> 'test_reviewer_account'
GROUP BY u.id
ORDER BY u."updatedAt" DESC;

-- 사람별 잔액
SELECT
  B.nickname,
  A.ju
FROM "UserBalance" AS A
JOIN "User" AS B
  ON A."userId" = B.id
JOIN "SajuEntry" as C
  ON C."userId" = B.id
where 1=1
	and B.nickname IS NOT NULL
    AND B.nickname <> '이상진'
order by C."updatedAt" DESC;


-- 게스트별 요약
SELECT
  "guestId",
  COUNT(*) AS entry_count,
  MIN("createdAt") AS first_entry_at,
  MAX("createdAt") AS last_entry_at,
  ARRAY_AGG(name ORDER BY "createdAt") AS names
FROM "SajuEntry"
WHERE "guestId" IS NOT NULL
  AND "userId" IS NULL
GROUP BY "guestId"
ORDER BY first_entry_at DESC;

-- 인원 수 (고유 게스트)
SELECT COUNT(DISTINCT "guestId") AS guest_users
FROM "SajuEntry"
WHERE "guestId" IS NOT NULL
  AND "userId" IS NULL;

-- 게스트 엔트리 목록
SELECT id, name, gender, "birthDate", "createdAt", "guestId"
FROM "SajuEntry"
WHERE "guestId" IS NOT NULL
  AND "userId" IS NULL
ORDER BY "createdAt" DESC;

-- 카카오 vs 비로그인 한눈에
SELECT
--  CASE
--    WHEN "userId" IS NOT NULL THEN 'logged_in'
--    WHEN "guestId" IS NOT NULL THEN 'guest'
--    ELSE 'orphan'
--  END AS owner_type,
  COUNT(*) AS entries,
  COUNT(DISTINCT COALESCE("userId", "guestId")) AS people
FROM "SajuEntry"
-- GROUP BY 1
;

-- 누가 초대 링크 생성했는지
SELECT DISTINCT
  B.nickname
FROM "CompatInvite" AS A
JOIN "User" AS B
  ON A."inviterUserId" = B.id
;


-- 쿠폰 캠페인 
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


-- 리스트 카드별로 누구랑 궁합 해설을 만들었는지
select
  u.nickname                                       AS owner_nickname,
  me.name                                          AS my_card,
  kv.value->>'partnerName'                         AS partner_name,
  me.id                                            AS my_entry_id,
  kv.key                                           AS compat_key,
  kv.value->>'partnerId'                           AS partner_entry_id,
  COALESCE(kv.value->>'relationship', 'romance')   AS relationship,
  kv.value->>'type'                                AS compat_type,
  kv.value->>'createdAt'                           AS created_at,
  LEFT(kv.value->>'text', 40)                      AS text_preview
FROM "SajuEntry" me
LEFT JOIN "User" u ON u.id = me."userId"
CROSS JOIN LATERAL jsonb_each(me."fortuneJson"::jsonb) AS kv(key, value)
WHERE me."fortuneJson" IS NOT NULL
  AND jsonb_typeof(me."fortuneJson"::jsonb) = 'object'   -- 배열/스칼라 제외
  AND kv.key LIKE 'compat_%'
  AND kv.key NOT LIKE 'compatShare_%'
  AND COALESCE(kv.value->>'text', '') <> ''
ORDER BY me."updatedAt" DESC, kv.value->>'createdAt' DESC;


-- 초대 수락으로 비교 가능하게 연결된 쌍
SELECT
  me.name          AS my_card,
  peer.name        AS partner_card,
  u.nickname       AS owner_nickname,
  cl.source,
  cl."createdAt"
FROM "CompatLink" cl
JOIN "SajuEntry" me   ON me.id = cl."entryId"
JOIN "SajuEntry" peer ON peer.id = cl."peerEntryId"
LEFT JOIN "User" u    ON u.id = cl."userId"
ORDER BY cl."createdAt" DESC;


-- 인생차트 공유중인가
select
  u.nickname,
  e.name,
  e.id,
  e."isShared",
  e."updatedAt"
FROM "SajuEntry" e
LEFT JOIN "User" u ON u.id = e."userId"
WHERE e."isShared" = true and e.name <> '이상진'
ORDER BY e."updatedAt" DESC;


-- 궁합해설 공유중인가
SELECT
  me.name                    AS my_card,
  u.nickname,
  kv.key,
  kv.value->>'partnerName'   AS partner_name,
  kv.value->>'relationship'  AS relationship,
  kv.value->>'sharedAt'      AS shared_at,   -- 스냅샷에 있으면
  kv.value->>'enabled'       AS enabled
FROM "SajuEntry" me
LEFT JOIN "User" u ON u.id = me."userId"
CROSS JOIN LATERAL jsonb_each(me."fortuneJson"::jsonb) AS kv(key, value)
WHERE me."fortuneJson" IS NOT NULL
  AND jsonb_typeof(me."fortuneJson"::jsonb) = 'object'
  AND kv.key LIKE 'compatShare_%'
  AND (kv.value->>'enabled') = 'true'
ORDER BY me."updatedAt" DESC;

-- 누가 결제했나?
SELECT
  u.nickname,
  u.email,
  u."kakaoId",
  po.id                AS order_id,
  po."productCode",
  po."productType",
  po.quantity,
  po.amount,
  po.currency,
  po."paymentMethod",
  po.provider,
  po."providerTxId",
  po."paidAt",
  po."createdAt",
  po."extraItems"
FROM "PaymentOrder" po
JOIN "User" u ON u.id = po."userId"
WHERE po.status = 'paid' and u.email <> 'will36@naver.com'
ORDER BY po."paidAt" DESC NULLS LAST, po."createdAt" DESC;


-- 사람별 결제 금액 합산 
SELECT
  u.nickname,
  COUNT(*)                         AS paid_orders,
  SUM(po.amount)                   AS total_amount_krw,  -- currency 섞이면 주의
  SUM(po.quantity)                 AS total_ju_qty,
  MIN(po."paidAt")                 AS first_paid_at,
  MAX(po."paidAt")                 AS last_paid_at
FROM "PaymentOrder" po
JOIN "User" u ON u.id = po."userId"
WHERE po.status = 'paid'
  AND po.currency = 'KRW'
  AND u.email <> 'will36@naver.com'
GROUP BY u.id, u.nickname
ORDER BY total_amount_krw DESC;
