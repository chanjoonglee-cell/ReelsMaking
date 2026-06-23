# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle, Circle, Wedge
from matplotlib.font_manager import FontProperties

FP=FontProperties(fname='/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
def F(sz,bold=False):
    f=FP.copy(); f.set_size(sz)
    if bold: f.set_weight('bold')
    return f

fig,ax=plt.subplots(figsize=(12,9.2)); ax.set_xlim(0,12); ax.set_ylim(0,10); ax.axis('off')
ax.text(6,9.6,'Solar 기반 학습 Agent — 한눈에 보는 구조',ha='center',fontproperties=F(18,True),color='#1b2631')
ax.text(6,9.15,'4명의 AI 튜터가 「학습 DB」를 중심으로 협업한다',ha='center',fontproperties=F(11.5),color='#5D6D7E')

def person(x,y,col):
    ax.add_patch(Circle((x,y+0.16),0.085,fc=col,ec='white',lw=1.2,zorder=7))
    ax.add_patch(Wedge((x,y-0.02),0.17,0,180,fc=col,ec='white',lw=1.2,zorder=7))

def agent(cx,cy,title,sub,badge,bc,fc,ec):
    w,h=3.5,1.3
    ax.add_patch(FancyBboxPatch((cx-w/2,cy-h/2),w,h,boxstyle='round,pad=0.05,rounding_size=0.12',
                 fc=fc,ec=ec,lw=2.2,zorder=4))
    person(cx-1.35,cy,ec)
    ax.text(cx+0.25,cy+0.26,title,ha='center',va='center',fontproperties=F(12,True),color='#1b2631',zorder=6)
    ax.text(cx+0.25,cy-0.16,sub,ha='center',va='center',fontproperties=F(9.5),color='#566573',zorder=6)
    if badge:
        ax.add_patch(FancyBboxPatch((cx+w/2-0.95,cy+h/2-0.34),0.85,0.30,boxstyle='round,pad=0.02,rounding_size=0.08',
                     fc=bc,ec='none',zorder=6))
        ax.text(cx+w/2-0.525,cy+h/2-0.19,badge,ha='center',va='center',fontproperties=F(9.5,True),color='white',zorder=7)

def plain(cx,cy,title,sub,fc,ec,w=3.2,h=1.2,icon=None,badge=None,bc=None):
    ax.add_patch(FancyBboxPatch((cx-w/2,cy-h/2),w,h,boxstyle='round,pad=0.05,rounding_size=0.12',
                 fc=fc,ec=ec,lw=2.2,zorder=4))
    ax.text(cx,cy+0.2,title,ha='center',va='center',fontproperties=F(12,True),color='#1b2631',zorder=6)
    ax.text(cx,cy-0.2,sub,ha='center',va='center',fontproperties=F(9.5),color='#566573',zorder=6)
    if badge:
        ax.add_patch(FancyBboxPatch((cx+w/2-1.05,cy+h/2-0.34),0.95,0.30,boxstyle='round,pad=0.02,rounding_size=0.08',
                     fc=bc,ec='none',zorder=6))
        ax.text(cx+w/2-0.575,cy+h/2-0.19,badge,ha='center',va='center',fontproperties=F(9,True),color='white',zorder=7)

def arrow(p1,p2,label=None,lp=None,col='#34495e',lw=2.0,fs=9.5,lc='#1F618D'):
    ax.add_patch(FancyArrowPatch(p1,p2,arrowstyle='-|>',mutation_scale=17,lw=lw,color=col,zorder=3))
    if label:
        mx,my=lp if lp else ((p1[0]+p2[0])/2,(p1[1]+p2[1])/2)
        ax.text(mx,my,label,ha='center',va='center',fontproperties=F(fs,True),color=lc,zorder=8,
                bbox=dict(boxstyle='round,pad=0.16',fc='white',ec='#D5DBDB',lw=0.8))

# palette
B='#2E86C1'; G='#1E8449'; P='#7D3C98'; O='#CA6F1E'; GR='#566573'
C_AN='#EBF5FB'; C_TU='#E9F7EF'; C_DB='#F4ECF7'; C_APP='#FEF9E7'; C_SOLAR='#FDF2E9'

# planes (aligned columns)
ax.add_patch(Rectangle((0.5,5.3),5.0,2.85,fc='#FCFCFC',ec='#AEB6BF',lw=1.4,ls='--',zorder=1))
ax.text(3.0,8.0,'① 분석 평면  (배치·천천히)',ha='center',fontproperties=F(11,True),color='#7B7D7D',zorder=2)
ax.add_patch(Rectangle((6.5,5.3),5.0,2.85,fc='#FCFCFC',ec='#AEB6BF',lw=1.4,ls='--',zorder=1))
ax.text(9.0,8.0,'② 대화 평면  (실시간·스트리밍)',ha='center',fontproperties=F(11,True),color='#7B7D7D',zorder=2)

# top: app
plain(6,8.8,'학습 앱 (라이브 서비스)','학습자 입력 · 대화',C_APP,O,w=3.6,h=0.95)

# agents (aligned grid: left col x=3.0, right col x=9.0; rows y=7.3 / y=5.95)
agent(3.0,7.3,'학습자 분석기','응답·이력을 분석','① 진단',B,C_AN,B)
agent(3.0,5.95,'복습 스케줄러','망각곡선 타이밍',None,B,C_AN,B)
agent(9.0,7.3,'소크라틱 튜터','정답 대신 질문으로 유도','② 발문',G,C_TU,G)
agent(9.0,5.95,'문제 생성기','맞춤 문제 제시',None,G,C_TU,G)

# center: 학습 DB
plain(6,4.0,'학습 DB (학습자 프로파일)','이력 저장 · 검색 · 주입',C_DB,P,w=3.8,h=1.15,badge='③ RAG',bc=P)

# bottom: Solar router
plain(6,2.0,'LLM 라우터  →  Solar','핵심 추론 엔진 · 장애 대비(failover) · 품질측정(eval)',C_SOLAR,O,w=8.6,h=1.0)

# arrows  app->agents
arrow((5.0,8.55),(3.4,7.95),label='입력(배치)',lp=(3.7,8.5),fs=9)
arrow((7.0,8.55),(8.6,7.95),label='대화(실시간)',lp=(8.4,8.5),fs=9)
# analysis plane -> DB
arrow((3.6,6.7),(4.6,4.45),label='프로파일 저장',lp=(3.5,5.2),fs=9,lc=P)
arrow((3.7,5.55),(4.5,4.2),col=GR,lw=1.6)
# DB -> dialogue plane
arrow((7.4,4.45),(8.4,6.7),label='프로파일 주입',lp=(8.6,5.2),fs=9,lc=P)
arrow((7.5,4.2),(8.3,5.55),col=GR,lw=1.6)
# planes -> Solar
arrow((6,3.4),(6,2.55),label='모든 에이전트 = Solar로 추론',lp=(6,3.0),fs=9.5,lc=O)

ax.text(6,1.05,'※ 4개 기능을 따로 만드는 게 아니라, 「학습 DB」를 중심으로 도는 하나의 시스템 — 쓸수록 학습자를 더 잘 안다(개인화 루프).',
        ha='center',fontproperties=F(9.5,True),color='#566573')

plt.tight_layout()
plt.savefig('/home/user/ReelsMaking/proposal/통합도식_학습Agent_v2.png',dpi=170,bbox_inches='tight',facecolor='white')
print('SAVED')
