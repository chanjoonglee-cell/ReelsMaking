# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
from matplotlib.font_manager import FontProperties

FP=FontProperties(fname='/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
def font(sz,bold=False):
    f=FP.copy(); f.set_size(sz)
    if bold: f.set_weight('bold')
    return f

fig,ax=plt.subplots(figsize=(13.5,11)); ax.set_xlim(0,14); ax.set_ylim(0,12); ax.axis('off')
ax.text(7,11.6,'통합 학습 Agent 아키텍처 (M3 에이전트) — ①②③ 매핑',ha='center',fontproperties=font(16,True),color='#1b2631')

def box(x,y,w,h,text,fc,ec,fs=11,bold=True,tc='black'):
    ax.add_patch(FancyBboxPatch((x-w/2,y-h/2),w,h,boxstyle='round,pad=0.06,rounding_size=0.10',
                 fc=fc,ec=ec,lw=2.0,zorder=4))
    ax.text(x,y,text,ha='center',va='center',fontproperties=font(fs,bold),color=tc,zorder=5)

def plane(x0,y0,x1,y1,label,lx):
    ax.add_patch(Rectangle((x0,y0),x1-x0,y1-y0,fc='#FCF3CF',ec='#D4AC0D',lw=1.6,ls='--',alpha=0.5,zorder=1))
    ax.text(lx,y1-0.28,label,ha='center',fontproperties=font(11,True),color='#9A7D0A',zorder=2)

def arrow(p1,p2,color='#34495e',style='-',lw=2.0,rad=0.0,label=None,lp=None,fs=9.5,lc='#c0392b'):
    ax.add_patch(FancyArrowPatch(p1,p2,arrowstyle='-|>',mutation_scale=18,lw=lw,color=color,
                 linestyle=style,connectionstyle=f'arc3,rad={rad}',zorder=3))
    if label:
        mx,my=lp if lp else ((p1[0]+p2[0])/2,(p1[1]+p2[1])/2)
        ax.text(mx,my,label,ha='center',va='center',fontproperties=font(fs,True),color=lc,zorder=6,
                bbox=dict(boxstyle='round,pad=0.16',fc='white',ec='none',alpha=0.92))

C_APP='#FADBD8'; C_AN='#D6EAF8'; C_DB='#E8DAEF'; C_GEN='#E8DAF0'; C_TUT='#D5F5E3'; C_ORCH='#D6DBDF'; C_SOLAR='#FDEBD0'

# planes
plane(2.0,8.2,13.6,10.1,'① 비동기 분석 평면 (배치·이벤트)',7.8)
plane(1.2,3.1,10.8,5.0,'② 실시간 대화 평면 (세션·스트리밍)',6.0)

# nodes
box(6.0,11.0,3.2,0.85,'학습 앱 (라이브) · 학습자 입력',C_APP,'#CB4335',11.5)
box(4.6,9.15,3.2,1.35,'학습자 분석기\n응답·이력 분석\n〔① 오개념 진단〕',C_AN,'#2E86C1',10.5)
box(10.6,9.15,3.0,1.15,'복습 스케줄러\n망각곡선 SRS\n(SM-2/FSRS)',C_AN,'#2E86C1',10)
box(7.0,6.5,3.6,1.5,'학습 DB\ndossier · 세션 · 학습기록\n〔③ 개인화 RAG: 검색·압축 주입〕',C_DB,'#7D3C98',10.5)
box(3.2,4.0,2.8,1.15,'문제 생성기\n맞춤 문제·과제',C_GEN,'#8E44AD',10.5)
box(7.6,4.0,3.4,1.35,'소크라틱 튜터 (메인)\n채점 + 소크라틱 발문\n〔② 소크라틱 발문〕',C_TUT,'#239B56',10.5)
box(6.0,1.85,5.6,0.95,'프로바이더 비종속 오케스트레이션 (NestJS)',C_ORCH,'#566573',11)
box(6.0,0.6,5.6,0.85,'LLM 라우터  →  Solar (핵심 추론 엔진)',C_SOLAR,'#CA6F1E',11)

# arrows: app -> analyzer, app -> tutor(stream)
arrow((5.4,10.6),(4.8,9.85),label='입력(응답·기록)',lp=(4.0,10.5),fs=9)
arrow((4.8,10.6),(6.6,4.7),rad=0.32,label='대화(스트리밍)',lp=(1.9,7.2),fs=9,color='#1F618D')
# analyzer -> DB, analyzer -> SRS, SRS -> DB
arrow((5.2,8.45),(6.4,7.25),label='dossier 갱신',lp=(5.2,7.7),fs=9)
arrow((6.2,9.15),(9.1,9.15),label='오류패턴→SRS',lp=(7.6,9.4),fs=9)
arrow((10.0,8.55),(7.9,7.25),rad=0.15)
# DB -> gen, DB -> tutor, tutor -> DB
arrow((5.6,6.1),(3.6,4.6),label='dossier',lp=(4.2,5.5),fs=9)
arrow((7.2,5.75),(7.6,4.7),label='dossier(연료)',lp=(8.6,5.4),fs=9)
arrow((8.6,4.6),(8.4,5.75),rad=-0.3,label='오류·채점 기록',lp=(10.0,5.2),fs=9,lc='#7D3C98')
# all agents -> orchestration
arrow((3.4,8.5),(4.2,2.35),rad=0.30,color='#7F8C8D')
arrow((11.2,8.55),(8.2,2.35),rad=-0.28,color='#7F8C8D')
arrow((3.2,3.42),(4.8,2.3),color='#7F8C8D')
arrow((7.6,3.32),(6.6,2.35),color='#7F8C8D')
# orch -> router
arrow((6.0,1.37),(6.0,1.05))

ax.text(7,-0.15,'※ ①②③ 요구사항은 분리된 모듈이 아니라, 학습 DB(dossier)를 중심으로 분석 평면·대화 평면이 도는 하나의 시스템으로 통합된다.',
        ha='center',fontproperties=font(10,True),color='#566573')

plt.tight_layout()
plt.savefig('/home/user/ReelsMaking/proposal/통합도식_M3_아키텍처.png',dpi=165,bbox_inches='tight',facecolor='white')
print('SAVED')
