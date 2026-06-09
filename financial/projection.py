import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

ROAS = 3.0
INFRA = 100.0        # 만원/월
LABOR = 1100.0       # 만원/월, 2027.1부터
BASE_MKT = 100.0     # 기본 마케팅 (시작점)

# 2026.8 시작, 4스텝(8->12월)에 매출 300 -> 10000
start_rev = BASE_MKT * ROAS   # 300
target_dec = 10000.0
ramp = (target_dec/start_rev) ** (1/4)   # 2026 월 성장배수

# 월 시퀀스 생성: (year, month)
months = []
y, m = 2026, 8
for _ in range(36):
    months.append((y, m))
    m += 1
    if m == 13:
        m = 1; y += 1

rev = []
prev = None
for i,(y,m) in enumerate(months):
    if y == 2026:
        r = start_rev if i == 0 else prev * ramp
    else:
        g = {2027:1.08, 2028:1.04, 2029:1.02}[y]
        r = prev * g
    rev.append(r)
    prev = r

mkt   = [r/ROAS for r in rev]
labor = [0.0 if y == 2026 else LABOR for (y,m) in months]
op    = [rev[i] - mkt[i] - INFRA - labor[i] for i in range(36)]

# 연도별 집계
from collections import defaultdict
agg = defaultdict(lambda: [0,0,0,0,0,0])  # rev, mkt, labor, infra, op, n
for i,(y,m) in enumerate(months):
    a = agg[y]
    a[0]+=rev[i]; a[1]+=mkt[i]; a[2]+=labor[i]; a[3]+=INFRA; a[4]+=op[i]; a[5]+=1

print(f"2026 월 성장률: {(ramp-1)*100:.1f}%/월  (8->12월, 4개월)")
print(f"{'연도':<6}{'개월':>4}{'매출(억)':>10}{'마케팅(억)':>11}{'인건비(억)':>11}{'영업이익(억)':>12}{'영업이익률':>9}")
tot=[0,0,0,0,0]
for y in sorted(agg):
    a=agg[y]
    print(f"{y:<6}{a[5]:>4}{a[0]/10000:>10.2f}{a[1]/10000:>11.2f}{a[2]/10000:>11.2f}{a[4]/10000:>12.2f}{a[4]/a[0]*100:>8.0f}%")
    for k in range(5): tot[k]+=a[k]
print(f"{'누계':<6}{36:>4}{tot[0]/10000:>10.2f}{tot[1]/10000:>11.2f}{tot[2]/10000:>11.2f}{tot[4]/10000:>12.2f}")

# ---- 그래프 ----
labels = [f"{str(y)[2:]}.{m:02d}" for (y,m) in months]
x = range(36)
fig, ax = plt.subplots(figsize=(13,6.5))
ax.bar(x, [v/10000 for v in op], color="#4C9A2A", alpha=0.55, label="Operating Profit (월, 억원)")
ax.plot(x, [v/10000 for v in rev], color="#1f4e79", marker="o", ms=3, lw=1.8, label="Revenue (월, 억원)")
ax.plot(x, [v/10000 for v in mkt], color="#d97706", marker="", lw=1.4, ls="--", label="Marketing (월, 억원)")

# 인건비 시작 표시 (2027.1 = index 5)
ax.axvline(5, color="grey", ls=":", lw=1)
ax.text(5.1, ax.get_ylim()[1]*0.92, "2027.1\nLabor starts\n(11M/mo)", fontsize=8, color="grey")
# Dec 2026 1억 마일스톤 (index 4)
ax.annotate("Dec 2026\nRevenue = 1.0B (1억)", xy=(4, 1.0), xytext=(7, 6),
            fontsize=8, color="#1f4e79",
            arrowprops=dict(arrowstyle="->", color="#1f4e79"))

ax.set_title("Reels Generator — 36-Month Financial Projection (Aug 2026 ~ Jul 2029)\nBase Mkt 100M / ROAS 300% / Growth taper 8%→4%→2%", fontsize=11)
ax.set_xlabel("Month (YY.MM)")
ax.set_ylabel("Amount (100M KRW = 1억)")
ax.set_xticks(list(x))
ax.set_xticklabels(labels, rotation=90, fontsize=7)
ax.grid(axis="y", alpha=0.3)
ax.legend(loc="upper left", fontsize=9)
ax.yaxis.set_major_formatter(mticker.FormatStrFormatter("%.0f"))
plt.tight_layout()
out="financial/financial_projection_36m.png"
plt.savefig(out, dpi=130)
print("SAVED", out)
