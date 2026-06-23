# -*- coding: utf-8 -*-
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
from matplotlib.font_manager import FontProperties
FP=FontProperties(fname='/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
def Fn(s,b=False):
    f=FP.copy(); f.set_size(s)
    if b: f.set_weight('bold')
    return f
fig,ax=plt.subplots(figsize=(17,13)); ax.set_xlim(0,17); ax.set_ylim(0,13.2); ax.axis('off')
ax.text(8.5,12.85,'Solar 기반 학습 Agent — 시스템 아키텍처',ha='center',fontproperties=Fn(20,True),color='#17202A')

def band(x0,y0,x1,y1,label,c):
    ax.add_patch(Rectangle((x0,y0),x1-x0,y1-y0,fc=c,ec='#BFC9CA',lw=1.3,zorder=1,alpha=0.5))
    ax.text(x0+0.15,y1-0.22,label,ha='left',va='top',fontproperties=Fn(11,True),color='#566573',zorder=10)

def sub(x0,y0,x1,y1,label,ec):
    ax.add_patch(Rectangle((x0,y0),x1-x0,y1-y0,fc='white',ec=ec,lw=1.4,ls='--',zorder=2,alpha=0.95))
    ax.text((x0+x1)/2,y1-0.17,label,ha='center',va='top',fontproperties=Fn(9.5,True),color=ec,zorder=3)

def box(cx,cy,w,h,title,sub2,fc,ec,badge=None,bc=None,ts=11):
    ax.add_patch(FancyBboxPatch((cx-w/2,cy-h/2),w,h,boxstyle='round,pad=0.03,rounding_size=0.07',fc=fc,ec=ec,lw=1.8,zorder=4))
    if sub2:
        ax.text(cx,cy+h/2-0.255,title,ha='center',va='center',fontproperties=Fn(ts,True),color='#17202A',zorder=6)
        ax.text(cx,cy-0.04-(0.12 if title.count(chr(10)) else 0),sub2,ha='center',va='center',fontproperties=Fn(8.5),color='#5D6D7E',zorder=6)
    else:
        ax.text(cx,cy,title,ha='center',va='center',fontproperties=Fn(ts,True),color='#17202A',zorder=6)
    if badge:
        ax.add_patch(FancyBboxPatch((cx+w/2-0.82,cy+h/2-0.31),0.74,0.26,boxstyle='round,pad=0.01,rounding_size=0.06',fc=bc,ec='none',zorder=7))
        ax.text(cx+w/2-0.45,cy+h/2-0.18,badge,ha='center',va='center',fontproperties=Fn(8.5,True),color='white',zorder=8)

def ar(p1,p2,lab=None,lp=None,c='#34495e',lw=1.9,st='-',fs=8.6,lc='#1F618D',rad=0.0):
    ax.add_patch(FancyArrowPatch(p1,p2,arrowstyle='-|>',mutation_scale=15,lw=lw,color=c,ls=st,zorder=3,
                 connectionstyle=f'arc3,rad={rad}'))
    if lab:
        mx,my=lp if lp else ((p1[0]+p2[0])/2,(p1[1]+p2[1])/2)
        ax.text(mx,my,lab,ha='center',va='center',fontproperties=Fn(fs,True),color=lc,zorder=9,
                bbox=dict(boxstyle='round,pad=0.13',fc='white',ec='#D5DBDB',lw=0.7))

AN='#EBF5FB'; ANe='#2E86C1'; DI='#E9F7EF'; DIe='#1E8449'; DBc='#F4ECF7'; DBe='#7D3C98'
SO='#FDF2E9'; SOe='#CA6F1E'; OP='#FDEDEC'; OPe='#CB4335'; RTc='#FEF9E7'; RTe='#B9770E'; SEc='#F2F4F4'; SEe='#566573'

# bands (generous headroom for labels)
band(0.3,11.0,11.9,12.35,'①  클라이언트 · 전송','#F4F6F7')
band(0.3,6.5,11.9,10.55,'②  오케스트레이션 · NestJS (프로바이더 비종속)','#F7FBFD')
band(0.3,4.0,11.9,6.05,'③  LLM 라우터 · 단일 진입점','#FCFBF5')
band(0.3,1.4,11.9,3.5,'④  업스테이지 제공 (외부)','#FDF6F0')
band(12.2,6.5,16.7,10.55,'데이터 계층','#FAF6FC')
band(12.2,4.0,16.7,6.05,'LLMOps / CI 가드레일','#FDF3F2')

# L1
box(1.7,11.55,2.2,0.66,'모바일 앱','iOS · Android','#EAF2F8','#2471A3',ts=11)
box(4.4,11.55,2.0,0.66,'REST API','입력 이벤트','#EAF2F8','#2471A3',ts=11)
box(6.9,11.55,2.1,0.66,'SSE 스트리밍','실시간 토큰','#EAF2F8','#2471A3',ts=11)

# L2
sub(0.6,6.7,4.3,9.75,'비동기 분석 평면 (배치 · 저비용)',ANe)
box(2.45,8.85,3.3,0.95,'학습자 분석기','응답·이력 → 오개념·수준 진단',AN,ANe,'① 진단',ANe,ts=11)
box(2.45,7.55,3.3,0.85,'복습 스케줄러','SM-2 / FSRS · 결정론',AN,ANe,ts=11)
box(6.1,8.2,3.0,1.55,'세션·컨텍스트 조립\n+ 도구 카탈로그','압축 dossier 주입 · function-calling\nget/update_persona · log_error\nenqueue_srs · grade_answer',SEc,SEe,ts=10.5)
sub(7.9,6.7,11.6,9.75,'실시간 대화 평면 (세션 · 스트리밍)',DIe)
box(9.75,8.85,3.3,0.95,'소크라틱 튜터 (메인)','채점(temp 0~0.2) + 단계적 발문 · 되묻기 금지',DI,DIe,'② 발문',DIe,ts=11)
box(9.75,7.55,3.3,0.85,'문제 생성기','프로파일 기반 맞춤 문제',DI,DIe,ts=11)

# L3
box(1.9,4.95,2.5,0.95,'failover + 재시도','providerOrder · 429/5xx 백오프',RTc,RTe,ts=10.5)
box(4.7,4.95,2.5,0.95,'결정론 정책','temperature · structured output',RTc,RTe,ts=10.5)
box(7.4,4.95,2.4,0.95,'프롬프트 레지스트리','버전 태그',RTc,RTe,ts=10.5)
box(10.0,4.95,2.4,0.95,'모델 슬롯(티어)','강력추론·멀티모달·경량',RTc,RTe,ts=10.5)

# L4
box(2.6,2.35,3.2,0.9,'Solar LLM','Console API / 온프레미스',SO,SOe,ts=11.5)
box(6.3,2.35,2.6,0.9,'Document Parse','문서 구조화',SO,SOe,ts=11)
box(9.4,2.35,2.6,0.9,'Information Extract','신호 추출',SO,SOe,ts=11)

# Data
box(14.45,8.8,3.7,1.45,'학습 DB · dossier','persona · language_profile · error_log\ntimeline · 세션   (← IE로 갱신)',DBc,DBe,'③ RAG',DBe,ts=11)
box(14.45,7.2,3.7,1.0,'지식베이스','구조화 텍스트/JSON · (옵션)벡터\n(← Document Parse로 구축)',DBc,DBe,ts=11)

# Ops
box(13.5,5.0,2.3,1.1,'계약 테스트','형식·정답누설·되묻기\n= 블로킹 게이트',OP,OPe,ts=10)
box(15.7,5.25,1.9,0.62,'6축 eval','골든셋 · report-only',OP,OPe,ts=10)
box(15.7,4.48,1.9,0.62,'관측','p95 · usage · 로그',OP,OPe,ts=10)

# arrows
ar((2.8,11.55),(3.4,11.55))
ar((5.4,11.55),(5.85,11.55))
ar((4.2,11.22),(2.75,9.85),lab='입력 · 배치',lp=(3.0,10.6),fs=8.8)
ar((6.95,11.22),(9.5,9.85),lab='대화 · 실시간(SSE)',lp=(8.5,10.55),fs=8.8,c=DIe,lc=DIe)
ar((4.3,8.4),(4.6,8.4))
ar((7.6,8.5),(8.1,8.9))
ar((7.6,8.0),(12.55,8.95),lab='읽기 / 쓰기',lp=(10.5,8.15),fs=8.8,c=DBe,lc=DBe)
ar((12.6,8.55),(11.45,8.95),lab='프로파일 주입',lp=(12.05,9.25),fs=8.8,c=DBe,lc=DBe,rad=0.12)
ar((12.6,7.25),(11.45,8.55),lab='RAG 검색',lp=(12.1,7.45),fs=8.8,c=DBe,lc=DBe,rad=0.18)
ar((2.45,6.7),(2.0,5.45),c=RTe)
ar((9.75,6.7),(9.9,5.45),c=RTe)
ar((2.7,4.47),(2.6,3.05),lab='추론 요청',lp=(3.5,3.75),fs=8.8,c=SOe,lc=SOe)
ar((11.9,4.95),(12.4,5.0),c=OPe)

ax.text(8.5,0.55,'※ 비동기 분석(배치·저비용) ↔ 실시간 대화(스트리밍) 두 평면을 「학습 DB(dossier)」가 잇고, 모든 호출은 라우터를 거쳐 Solar로 — 측정(계약 게이트·eval)이 배포를 통제한다.',
        ha='center',fontproperties=Fn(10,True),color='#566573')
plt.savefig('/home/user/ReelsMaking/proposal/시스템아키텍처.png',dpi=160,bbox_inches='tight',facecolor='white')
print('SAVED')
