# -*- coding: utf-8 -*-
"""SRPT 이론 프레임워크 도식 생성 스크립트."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle
from matplotlib.patches import ArrowStyle

FONT = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
font_manager.fontManager.addfont(FONT)
plt.rcParams["font.family"] = "NanumGothic"
plt.rcParams["axes.unicode_minus"] = False

# 색상 팔레트
C_DESIGN = "#E8F0FE"; C_DESIGN_E = "#4285F4"   # 설계층 (파랑)
C_PSY    = "#FCE8E6"; C_PSY_E    = "#EA4335"   # 심리층 (빨강)
C_OUT    = "#E6F4EA"; C_OUT_E    = "#34A853"   # 결과층 (초록)
C_MECH   = "#FEF7E0"; C_MECH_E   = "#F9AB00"   # 기제층 (노랑)
C_GATE   = "#F3E8FD"; C_GATE_E   = "#9334E6"   # 게이트 (보라)
C_GREY   = "#F1F3F4"; C_GREY_E   = "#5F6368"


def box(ax, x, y, w, h, text, fc, ec, fs=11, bold=True, ls="-"):
    p = FancyBboxPatch((x - w / 2, y - h / 2), w, h,
                       boxstyle="round,pad=0.02,rounding_size=0.12",
                       linewidth=2, edgecolor=ec, facecolor=fc, linestyle=ls)
    ax.add_patch(p)
    ax.text(x, y, text, ha="center", va="center", fontsize=fs,
            fontweight="bold" if bold else "normal", color="#202124", zorder=5)


def arrow(ax, x1, y1, x2, y2, color="#202124", ls="-", lw=2.2,
          style="-|>", rad=0.0, mut=14):
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle="-|>",
                        connectionstyle=f"arc3,rad={rad}",
                        linewidth=lw, color=color, linestyle=ls,
                        mutation_scale=mut, zorder=3)
    ax.add_patch(a)


def label(ax, x, y, text, fs=9.5, color="#5F6368", style="italic", bg=None):
    bbox = dict(boxstyle="round,pad=0.2", fc=bg, ec="none") if bg else None
    ax.text(x, y, text, ha="center", va="center", fontsize=fs,
            color=color, fontstyle=style, zorder=6, bbox=bbox)


# ============================================================
# Figure 1 — 통합 기제: 예측오차 루프 + 환원가능성 분기
# ============================================================
fig, ax = plt.subplots(figsize=(11, 7.2))
ax.set_xlim(0, 11); ax.set_ylim(0, 7.2); ax.axis("off")

ax.text(5.5, 6.85, "[그림 1] 공유 기제 — 예측오차 루프와 환원가능성 분기",
        ha="center", fontsize=14, fontweight="bold", color="#202124")

# --- 상단: RPE 루프 (원형 배치) ---
cx, cy, r = 3.0, 4.5, 1.45
loop_nodes = [("행동", 90), ("예측", 18), ("결과", -54), ("예측오차 δ", -126), ("갱신·갈망", 162)]
import math
pts = {}
for name, ang in loop_nodes:
    a = math.radians(ang)
    px, py = cx + r * math.cos(a), cy + r * math.sin(a)
    pts[name] = (px, py)
    box(ax, px, py, 1.15, 0.5, name, C_MECH, C_MECH_E, fs=9.5)
order = ["행동", "예측", "결과", "예측오차 δ", "갱신·갈망", "행동"]
for i in range(len(order) - 1):
    p1, p2 = pts[order[i]], pts[order[i + 1]]
    arrow(ax, p1[0], p1[1], p2[0], p2[1], color=C_MECH_E, rad=-0.32, lw=2)
label(ax, cx, cy + 0.05, "보상예측오차\n루프", fs=10, color=C_MECH_E, style="normal")
label(ax, cx, cy - 2.25, "도파민 ∝ δ,  불확실성 ≈ 0.5에서 최대\n(Schultz 1997; Fiorillo 2003)",
      fs=8.5, color="#5F6368")

# --- 분기 화살표 ---
arrow(ax, 4.7, 4.5, 6.0, 4.5, color=C_GATE_E, lw=2.6)
box(ax, 6.7, 4.5, 1.3, 0.95, "환원\n가능성?", C_GATE, C_GATE_E, fs=11)
label(ax, 6.7, 3.85, "불확실성이 노력으로\n줄어드는가", fs=8.2, color=C_GATE_E)

# --- 두 갈래 결과 ---
arrow(ax, 7.35, 4.85, 8.3, 5.7, color=C_OUT_E, lw=2.4)
arrow(ax, 7.35, 4.15, 8.3, 3.0, color="#9AA0A6", lw=2.4)

box(ax, 9.45, 5.85, 2.7, 0.95, "성장 (학습)\n세계모형·기억 축적", C_OUT, C_OUT_E, fs=10)
label(ax, 9.45, 5.0, "[ 퍼즐 · 언어학습 ]", fs=9.5, color=C_OUT_E, style="normal")

box(ax, 9.45, 2.85, 2.7, 0.95, "중독 (공허)\n아무것도 안 쌓임", C_GREY, C_GREY_E, fs=10)
label(ax, 9.45, 2.0, "[ 도박 · 소개팅앱 ]", fs=9.5, color=C_GREY_E, style="normal")

label(ax, 5.5, 0.55,
      "동일한 루프라도 — 환원가능 불확실성 위에서 돌면 '학습', 환원불가 위에서 돌면 '중독'",
      fs=10, color="#202124", style="normal", bg="#FEF7E0")

plt.tight_layout()
fig.savefig("/home/user/ReelsMaking/docs/figures/fig1_mechanism.png", dpi=200,
            bbox_inches="tight", facecolor="white")
plt.close(fig)


# ============================================================
# Figure 2 — SRPT 인과 모형 (이론적 프레임워크)
# ============================================================
fig, ax = plt.subplots(figsize=(12.5, 8))
ax.set_xlim(0, 12.5); ax.set_ylim(0, 8); ax.axis("off")

ax.text(6.25, 7.65, "[그림 2] SRPT 인과 모형 — 자기참조 가치증폭을 통한 학습 지속",
        ha="center", fontsize=14, fontweight="bold", color="#202124")

# 층 구분 배경 라벨
for ty, tx, tt, tc in [(6.55, 0.15, "설계층", C_DESIGN_E),
                       (6.55, 0.15, "", C_DESIGN_E)]:
    pass
ax.text(0.35, 6.5, "설계요소", fontsize=10, color=C_DESIGN_E, rotation=90,
        va="center", fontweight="bold")
ax.text(0.35, 3.0, "설계요소", fontsize=10, color=C_DESIGN_E, rotation=90,
        va="center", fontweight="bold")

# --- 조절변수 C (상단) ---
box(ax, 4.2, 7.0, 2.2, 0.7, "C 데이터 누적", C_DESIGN, C_DESIGN_E, fs=10.5)

# --- 주 경로 (y≈5.4) ---
yA = 5.4
box(ax, 1.7, yA, 2.0, 0.8, "A\n자기참조 콘텐츠", C_DESIGN, C_DESIGN_E, fs=10)
box(ax, 4.6, yA, 2.0, 0.8, "V_self\n자기관련성", C_PSY, C_PSY_E, fs=10)
box(ax, 7.5, yA, 1.9, 0.8, "내재동기\n(자율성·관계성)", C_PSY, C_PSY_E, fs=9.5)
box(ax, 10.4, 5.4, 2.0, 1.0, "지속성 P\n(구성개념)", C_OUT, C_OUT_E, fs=11)

arrow(ax, 2.7, yA, 3.6, yA, color=C_PSY_E)
arrow(ax, 5.6, yA, 6.55, yA, color=C_PSY_E)
arrow(ax, 8.45, yA, 9.4, 5.55, color=C_OUT_E)
label(ax, 6.05, yA + 0.32, "강화 = V·δ", fs=9, color=C_PSY_E)
label(ax, 8.9, 5.75, "주경로", fs=8.5, color=C_OUT_E)

# 조절 화살표 C -> (A->V_self 경로)
arrow(ax, 4.2, 6.65, 4.2, 5.8, color=C_DESIGN_E, ls=(0, (4, 3)), lw=2)
label(ax, 5.3, 6.25, "조절(moderate)\n시간↑ → V_self 증폭", fs=8.3, color=C_DESIGN_E)

# --- 부차 경로 (y≈2.6) ---
yB = 2.6
box(ax, 1.7, yB, 2.0, 0.8, "B\n즉각 피드백", C_DESIGN, C_DESIGN_E, fs=10)
box(ax, 4.6, yB, 2.0, 0.8, "유능감\n(성취)", C_PSY, C_PSY_E, fs=10)
arrow(ax, 2.7, yB, 3.6, yB, color=C_PSY_E)
arrow(ax, 5.6, yB, 9.5, 5.0, color="#9AA0A6", rad=0.12)
label(ax, 3.15, yB + 0.32, "δ 결정", fs=9, color=C_PSY_E)
label(ax, 7.3, 3.25, "부차경로 (동기와 독립)", fs=8.5, color="#9AA0A6")

# --- 게이트: 환원가능성 ---
box(ax, 10.4, 3.3, 2.0, 0.8, "환원가능성\n게이트 g_red", C_GATE, C_GATE_E, fs=9.5)
arrow(ax, 10.4, 3.7, 10.4, 4.9, color=C_GATE_E, ls=(0, (4, 3)), lw=2, style="-|>")
label(ax, 11.75, 4.3, "활성조건\n(gating)", fs=8.3, color=C_GATE_E)

# --- 측정치 ---
box(ax, 10.4, 0.95, 2.6, 0.9, "재방문율 · 완주율\n(측정치)", "#FFFFFF", C_OUT_E, fs=9.5,
    bold=False, ls=(0, (3, 2)))
arrow(ax, 10.4, 4.9, 10.4, 1.4, color=C_OUT_E, ls=(0, (2, 2)), lw=1.8)
label(ax, 11.9, 3.0, "관측\n(수렴=타당도)", fs=8.2, color=C_OUT_E)

# --- 경계조건 박스 ---
box(ax, 3.0, 0.75, 5.4, 0.95,
    "경계조건: 수단=목적 일치 도메인(언어·작문)에서만 강하게 작동\n→ 자기표현 무관 도메인(수식·암기)에서는 약함",
    "#FEF7E0", C_MECH_E, fs=9, bold=False)

# 범례
lx = 0.5
for i, (txt, col) in enumerate([("설계요소", C_DESIGN_E), ("심리기제", C_PSY_E),
                                ("결과/측정", C_OUT_E), ("게이트/조절", C_GATE_E)]):
    ax.add_patch(plt.Rectangle((lx + i * 1.7, 7.05), 0.25, 0.18, color=col))
    ax.text(lx + 0.32 + i * 1.7, 7.14, txt, fontsize=8.2, va="center", color="#5F6368")

plt.tight_layout()
fig.savefig("/home/user/ReelsMaking/docs/figures/fig2_causal_model.png", dpi=200,
            bbox_inches="tight", facecolor="white")
plt.close(fig)

print("saved fig1_mechanism.png, fig2_causal_model.png")
