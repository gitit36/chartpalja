import json, hashlib
from pathlib import Path
R=Path(__file__).resolve().parent
m=json.load(open(R/"PUBLIC_LIFE_V1_STAGE1_MANIFEST.json",encoding="utf-8"))
seen=set()
for split,file in [("DEV","PUBLIC_LIFE_V1_DEV.json"),("CHECK","PUBLIC_LIFE_V1_CHECK.json")]:
    p=R/file
    assert hashlib.sha256(p.read_bytes()).hexdigest()==m[split]["sha256"]
    d=json.load(open(p,encoding="utf-8")); assert d["n"]==m[split]["n"]
    for s in d["subjects"]:
        assert s["name"] not in seen; seen.add(s["name"])
        ev=s["events"]; assert len(ev)==4 and len({x["year"] for x in ev})==4
        assert sum(x["valence"]=="positive" for x in ev)==2
        assert sum(x["valence"]=="negative" for x in ev)==2
print("PUBLIC_LIFE_V1_STAGE1_OK")
