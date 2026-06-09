import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

# ---------- 가정 (만원 단위) ----------
ROAS      = 3.0
INFRA     = 100.0      # 인프라 /월
LABOR     = 1100.0     # 인건비 /월 (2027.1~)
BASE_MKT  = 100.0      # 기본 마케팅 (시작점)
LOAN      = 10000.0    # 융자 1억
LOAN_RATE = 0.03       # 연 3%
GRACE_M   = 24         # 2년 거치(이자만)
REPAY_M   = 36         # 거치 후 원금균등분할 36개월

# 2026.8 시작, 4스텝(8->12월)에 매출 300 -> 10000 역산
start_rev  = BASE_MKT * ROAS
target_dec = 10000.0
ramp = (target_dec / start_rev) ** (1/4)

# 월 시퀀스
months = []
y, m = 2026, 8
for _ in range(36):
    months.append((y, m)); m += 1
    if m == 13: m = 1; y += 1

# 매출/마케팅/영업이익
rev, prev = [], None
for i, (y, m) in enumerate(months):
    if y == 2026:
        r = start_rev if i == 0 else prev * ramp
    else:
        r = prev * {2027:1.08, 2028:1.04, 2029:1.02}[y]
    rev.append(r); prev = r
mkt   = [r/ROAS for r in rev]
labor = [0.0 if y == 2026 else LABOR for (y, m) in months]
op    = [rev[i]-mkt[i]-INFRA-labor[i] for i in range(36)]

# 현금흐름 (영업현금≈영업이익, +융자유입, -이자, -원금)
bal = LOAN                       # 대출잔액
prin_each = LOAN / REPAY_M
interest, principal, net_cf, cash = [], [], [], []
running = 0.0
for i in range(36):
    intr = bal * LOAN_RATE / 12
    prin = prin_each if i >= GRACE_M else 0.0
    bal -= prin
    inflow = LOAN if i == 0 else 0.0     # 융자 유입 (첫 달)
    ncf = op[i] - intr - prin + inflow
    running += ncf
    interest.append(intr); principal.append(prin); net_cf.append(ncf); cash.append(running)

labels = [f"{str(y)[2:]}.{m:02d}" for (y, m) in months]
x = list(range(36))
BLUE, GREEN, ORANGE, GREY = "#1f4e79", "#4C9A2A", "#d97706", "grey"

def style(ax):
    ax.set_xticks(x); ax.set_xticklabels(labels, rotation=90, fontsize=7)
    ax.grid(axis="y", alpha=0.3)
    ax.axvline(5, color=GREY, ls=":", lw=1)
    ax.set_xlabel("Month (YY.MM)")

# ===== 그래프 1: 영업이익 =====
fig, ax = plt.subplots(figsize=(13, 6.5))
ax.bar(x, [v/10000 for v in op], color=GREEN, alpha=0.6, label="Operating Profit (monthly)")
ax.set_ylabel("Monthly (100M KRW = 1억)")
ax2 = ax.twinx()
cum_op = []
s = 0
for v in op: s += v; cum_op.append(s/10000)
ax2.plot(x, cum_op, color=BLUE, marker="o", ms=3, lw=1.8, label="Cumulative Operating Profit")
ax2.set_ylabel("Cumulative (100M KRW = 1억)")
ax.text(5.1, ax.get_ylim()[1]*0.9, "2027.1\nLabor starts", fontsize=8, color=GREY)
ax.set_title("Operating Profit — 36 Months (Aug 2026 ~ Jul 2029)\nBase Mkt 100M / ROAS 300% / Growth taper 8%->4%->2%", fontsize=11)
style(ax)
l1,la1 = ax.get_legend_handles_labels(); l2,la2 = ax2.get_legend_handles_labels()
ax.legend(l1+l2, la1+la2, loc="upper left", fontsize=9)
plt.tight_layout(); plt.savefig("financial/op_profit_36m.png", dpi=130); plt.close()

# ===== 그래프 2: 현금흐름 =====
fig, ax = plt.subplots(figsize=(13, 6.5))
colors = [GREEN if v >= 0 else "#c0392b" for v in net_cf]
ax.bar(x, [v/10000 for v in net_cf], color=colors, alpha=0.6, label="Net Cash Flow (monthly)")
ax.set_ylabel("Monthly (100M KRW = 1억)")
ax2 = ax.twinx()
ax2.plot(x, [v/10000 for v in cash], color=BLUE, marker="o", ms=3, lw=1.8, label="Cumulative Cash Balance")
ax2.set_ylabel("Cumulative (100M KRW = 1억)")
ax.annotate("Loan +1.0B (1억)", xy=(0, net_cf[0]/10000), xytext=(2, net_cf[0]/10000+0.5),
            fontsize=8, color=ORANGE, arrowprops=dict(arrowstyle="->", color=ORANGE))
ax.axvline(24, color=ORANGE, ls=":", lw=1)
ax.text(24.1, ax.get_ylim()[1]*0.9, "2028.8\nRepay starts", fontsize=8, color=ORANGE)
ax.text(5.1, ax.get_ylim()[1]*0.9, "2027.1\nLabor starts", fontsize=8, color=GREY)
ax.set_title("Cash Flow — 36 Months (Aug 2026 ~ Jul 2029)\nLoan 1억 @3% / 2yr grace -> principal installments", fontsize=11)
style(ax)
l1,la1 = ax.get_legend_handles_labels(); l2,la2 = ax2.get_legend_handles_labels()
ax.legend(l1+l2, la1+la2, loc="upper left", fontsize=9)
plt.tight_layout(); plt.savefig("financial/cashflow_36m.png", dpi=130); plt.close()

# ---------- 표 ----------
from collections import defaultdict
agg = defaultdict(lambda:[0]*6)
for i,(y,m) in enumerate(months):
    a=agg[y]; a[0]+=rev[i]; a[1]+=op[i]; a[2]+=interest[i]; a[3]+=principal[i]; a[4]+=net_cf[i]; a[5]+=1
print(f"{'연도':<6}{'개월':>4}{'매출(억)':>9}{'영업이익(억)':>11}{'이자(만)':>9}{'원금(만)':>9}{'순현금(억)':>10}{'기말현금(억)':>11}")
for y in sorted(agg):
    a=agg[y]
    end = max(i for i,(yy,mm) in enumerate(months) if yy==y)
    print(f"{y:<6}{a[5]:>4}{a[0]/10000:>9.2f}{a[1]/10000:>11.2f}{a[2]:>9.0f}{a[3]:>9.0f}{a[4]/10000:>10.2f}{cash[end]/10000:>11.2f}")
print(f"기말(2029.7) 누적현금: {cash[-1]/10000:.2f}억 / 대출잔액: {bal:.0f}만원")
print("SAVED financial/op_profit_36m.png , financial/cashflow_36m.png")
