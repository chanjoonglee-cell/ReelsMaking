# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.font_manager import FontProperties

FP=FontProperties(fname='/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
def font(sz,bold=False):
    f=FP.copy(); f.set_size(sz)
    if bold: f.set_weight('bold')
    return f

fig,ax=plt.subplots(figsize=(13,8.5)); ax.set_xlim(0,13); ax.set_ylim(0,9); ax.axis('off')

def box(x,y,w,h,text,fc,ec,fs=12,bold=True,tc='black'):
    b=FancyBboxPatch((x-w/2,y-h/2),w,h,boxstyle='round,pad=0.08,rounding_size=0.12',
                     fc=fc,ec=ec,lw=2.0,zorder=3)
    ax.add_patch(b)
    ax.text(x,y,text,ha='center',va='center',fontproperties=font(fs,bold),color=tc,zorder=4)

def arrow(p1,p2,color='#333',style='-',lw=2.2,rad=0.0,label=None,lp=None,fs=10,lc='#c0392b'):
    a=FancyArrowPatch(p1,p2,arrowstyle='-|>',mutation_scale=20,lw=lw,color=color,
                      linestyle=style,connectionstyle=f'arc3,rad={rad}',zorder=2)
    ax.add_patch(a)
    if label:
        mx,my=lp if lp else ((p1[0]+p2[0])/2,(p1[1]+p2[1])/2)
        ax.text(mx,my,label,ha='center',va='center',fontproperties=font(fs,True),color=lc,zorder=5,
                bbox=dict(boxstyle='round,pad=0.18',fc='white',ec='none',alpha=0.9))

# colors
C_LEARN='#FFF3CD'; C1='#D6EAF8'; C2='#D5F5E3'; C3='#FADBD8'; C_HUB='#E8DAEF'; C_SOLAR='#FDEBD0'; C_OPS='#EAECEE'

# title
ax.text(6.5,8.6,'통합 학습 Agent — ①②③가 도는 하나의 폐루프(Closed Loop)',ha='center',
        fontproperties=font(16,True),color='#1b2631')

# nodes (clockwise loop): 학습자 -> ①진단 -> dossier -> ③RAG -> ②발문 -> 학습자
box(1.6,4.5,2.0,1.0,'학습자\n(Learner)',C_LEARN,'#B7950B',12)
box(4.3,7.2,2.6,1.2,'① 오개념 진단\n의도·오개념 분류\n(Solar · structured)',C1,'#2E86C1',11)
box(8.0,7.2,2.4,1.2,'학습자 프로파일\n(dossier)\n특성·오류이력·타임라인',C_HUB,'#7D3C98',11)
box(10.9,4.5,2.4,1.2,'③ 개인화 RAG\n검색 → 압축 주입',C3,'#CB4335',11)
box(6.4,1.6,2.8,1.2,'② 소크라틱 발문 엔진\n정답 노출 X · 단계적 유도\n실시간 멀티턴 (Solar)',C2,'#239B56',11)

# loop arrows
arrow((2.6,4.9),(3.4,6.6),rad=0.25,label='응답',lp=(2.6,6.0))
arrow((5.6,7.2),(6.7,7.2),label='진단결과 적재',lp=(6.15,7.55),fs=9)
arrow((8.6,6.6),(10.4,5.1),rad=0.25,label='이력 공급',lp=(10.2,6.2),fs=9)
arrow((10.6,3.9),(7.7,2.0),rad=0.25,label='dossier+지식 주입',lp=(10.0,2.5),fs=9)
arrow((5.2,1.7),(2.2,3.9),rad=0.25,label='발문(질문)',lp=(3.0,2.3))

# Solar engine (center, dashed to ① and ②)
box(6.4,4.5,2.0,0.8,'Solar\n핵심 추론 엔진',C_SOLAR,'#CA6F1E',11)
arrow((6.0,4.9),(4.7,6.6),style='--',color='#CA6F1E',lw=1.6)
arrow((6.4,4.1),(6.4,2.2),style='--',color='#CA6F1E',lw=1.6)

# Information Extract -> dossier (auto update)
box(8.0,5.0,2.2,0.7,'Information Extract\n학습신호 추출',C1,'#2E86C1',9.5)
arrow((8.0,5.35),(8.0,6.6),style='--',color='#2E86C1',lw=1.6,label='자동 갱신',lp=(8.9,6.0),fs=8.5)

# Document Parse -> 지식베이스 -> ③RAG
box(11.2,7.4,2.2,0.9,'학습 자료\n(Document Parse)\n→ 지식베이스',C3,'#CB4335',9.5)
arrow((11.1,6.95),(11.0,5.1),style='--',color='#CB4335',lw=1.6)

# SRS 복습 (dossier -> 학습자)
arrow((7.0,7.0),(2.0,5.0),style=':',color='#7D3C98',lw=1.7,rad=-0.30,
      label='SRS 복습 알림(망각곡선)',lp=(4.6,6.4),fs=8.5,lc='#7D3C98')

# 측정 LLMOps bar (bottom)
box(6.5,0.35,12.4,0.62,'측정 기반 LLMOps  —  계약 게이트(형식·정답누설·되묻기 차단) · 6축 품질 eval · 골든셋  |  모든 Solar 호출을 감싸 품질 보증',
    C_OPS,'#797D7F',10.5,tc='#2C3E50')

plt.tight_layout()
plt.savefig('/home/user/ReelsMaking/proposal/통합도식_학습Agent.png',dpi=170,bbox_inches='tight',facecolor='white')
print('SAVED png')
