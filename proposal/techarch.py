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
fig,ax=plt.subplots(figsize=(17,11)); ax.set_xlim(0,17); ax.set_ylim(0,11.4); ax.axis('off')
ax.text(8.5,11.05,'Solar 기반 학습 Agent — 시스템 아키텍처',ha='center',fontproperties=Fn(19,True),color='#17202A')

def band(x0,y0,x1,y1,label,c):
    ax.add_patch(Rectangle((x0,y0),x1-x0,y1-y0,fc=c,ec='#BFC9CA',lw=1.3,zorder=1,alpha=0.55))
    ax.text(x0+0.12,y1-0.22,label,ha='left',va='top',fontproperties=Fn(10.5,True),color='#5D6D7E',zorder=2)

def sub(x0,y0,x1,y1,label,ec):
    ax.add_patch(Rectangle((x0,y0),x1-x0,y1-y0,fc='white',ec=ec,lw=1.4,ls='--',zorder=2,alpha=0.9))
    ax.text((x0+x1)/2,y1-0.18,label,ha='center',va='top',fontproperties=Fn(9.5,True),color=ec,zorder=3)

def box(cx,cy,w,h,title,sub2,fc,ec,badge=None,bc=None,ts=11):
    ax.add_patch(FancyBboxPatch((cx-w/2,cy-h/2),w,h,boxstyle='round,pad=0.03,rounding_size=0.07',fc=fc,ec=ec,lw=1.8,zorder=4))
    if sub2:
        ax.text(cx,cy+h/2-0.26,title,ha='center',va='center',fontproperties=Fn(ts,True),color='#17202A',zorder=6)
        ax.text(cx,cy-0.08,sub2,ha='center',va='center',fontproperties=Fn(8.6),color='#566573',zorder=6)
    else:
        ax.text(cx,cy,title,ha='center',va='center',fontproperties=Fn(ts,True),color='#17202A',zorder=6)
    if badge:
        ax.add_patch(FancyBboxPatch((cx+w/2-0.82,cy+h/2-0.30),0.74,0.26,boxstyle='round,pad=0.01,rounding_size=0.06',fc=bc,ec='none',zorder=7))
        ax.text(cx+w/2-0.45,cy+h/2-0.17,badge,ha='center',va='center',fontproperties=Fn(8.5,True),color='white',zorder=8)

def ar(p1,p2,lab=None,lp=None,c='#34495e',lw=1.9,st='-',fs=8.6,lc='#1F618D',rad=0.0):
    ax.add_patch(FancyArrowPatch(p1,p2,arrowstyle='-|>',mutation_scale=15,lw=lw,color=c,ls=st,zorder=3,
                 connectionstyle=f'arc3,rad={rad}'))
    if lab:
        mx,my=lp if lp else ((p1[0]+p2[0])/2,(p1[1]+p2[1])/2)
        ax.text(mx,my,lab,ha='center',va='center',fontproperties=Fn(fs,True),color=lc,zorder=9,
                bbox=dict(boxstyle='round,pad=0.13',fc='white',ec='#D5DBDB',lw=0.7))

# palette
AN='#EBF5FB'; ANe='#2E86C1'; DI='#E9F7EF'; DIe='#1E8449'; DBc='#F4ECF7'; DBe='#7D3C98'
SO='#FDF2E9'; SOe='#CA6F1E'; OP='#FDEDEC'; OPe='#CB4335'; RTc='#FEF9E7'; RTe='#B9770E'; SEc='#F2F4F4'; SEe='#566573'

# bands
band(0.3,9.35,11.9,10.55,'① 클라이언트 · 전송','#F8F9F9')
band(0.3,5.55,11.9,9.05,'② 오케스트레이션 · NestJS (프로바이더 비종속)','#FBFCFC')
band(0.3,3.25,11.9,5.25,'③ LLM 라우터 · 단일 진입점','#FCFBF7')
band(0.3,1.05,11.9,2.95,'④ 업스테이지 제공 (외부)','#FDF7F2')
band(12.2,5.55,16.7,9.05,'데이터 계층','#FBF7FC')
band(12.2,3.25,16.7,5.25,'LLMOps / CI 가드레일','#FDF4F3')

# L1 client
box(1.7,9.95,2.2,0.7,'모바일 앱','iOS · Android','#EAF2F8','#2471A3',ts=10.5)
box(4.4,9.95,2.0,0.7,'REST API','입력 이벤트','#EAF2F8','#2471A3',ts=10.5)
box(6.7,9.95,2.0,0.7,'SSE 스트리밍','실시간 토큰','#EAF2F8','#2471A3',ts=10.5)

# L2 orchestration
sub(0.6,5.75,4.3,8.75,'비동기 분석 평면 (배치·저비용)',ANe)
box(2.45,7.85,3.3,0.95,'학습자 분석기','응답·이력 → 오개념·수준 진단',AN,ANe,'① 진단',ANe,ts=10.5)
box(2.45,6.55,3.3,0.8,'복습 스케줄러','SM-2 / FSRS · 결정론',AN,ANe,ts=10.5)
box(6.1,7.2,3.0,1.5,'세션·컨텍스트 조립\n+ 도구 카탈로그','압축 dossier 주입 · function-calling\nget/update_persona · log_error\nenqueue_srs · grade_answer',SEc,SEe,ts=10)
sub(7.9,5.75,11.6,8.75,'실시간 대화 평면 (세션·스트리밍)',DIe)
box(9.75,7.85,3.3,0.95,'소크라틱 튜터 (메인)','채점(temp 0~0.2)+단계적 발문·되묻기 금지',DI,DIe,'② 발문',DIe,ts=10.5)
box(9.75,6.55,3.3,0.8,'문제 생성기','프로파일 기반 맞춤 문제',DI,DIe,ts=10.5)

# L3 router (4 boxes)
box(1.9,4.2,2.5,0.95,'failover + 재시도','providerOrder · 429/5xx 백오프',RTc,RTe,ts=10)
box(4.7,4.2,2.5,0.95,'결정론 정책','temperature · structured output',RTc,RTe,ts=10)
box(7.4,4.2,2.4,0.95,'프롬프트 레지스트리','버전 태그',RTc,RTe,ts=10)
box(10.0,4.2,2.4,0.95,'모델 슬롯(티어)','강력추론·멀티모달·경량',RTc,RTe,ts=10)

# L4 upstage
box(2.6,1.95,3.2,0.9,'Solar LLM','Console API / 온프레미스',SO,SOe,ts=11)
box(6.3,1.95,2.6,0.9,'Document Parse','문서 구조화',SO,SOe,ts=10.5)
box(9.4,1.95,2.6,0.9,'Information Extract','신호 추출',SO,SOe,ts=10.5)

# Data band (right)
box(14.45,7.7,3.7,1.3,'학습 DB · dossier','persona · language_profile\nerror_log · timeline · 세션',DBc,DBe,'③ RAG',DBe,ts=10.5)
box(14.45,6.2,3.7,0.95,'지식베이스','구조화 텍스트/JSON · (옵션)벡터',DBc,DBe,ts=10.5)

# Ops band (right)
box(13.55,4.45,2.4,0.95,'계약 테스트','형식·정답누설·되묻기\n= 블로킹 게이트',OP,OPe,ts=9.5)
box(15.55,4.55,1.9,0.7,'6축 eval','골든셋·report-only',OP,OPe,ts=9.5)
box(15.55,3.75,1.9,0.6,'관측','p95·usage·로그',OP,OPe,ts=9.5)

# arrows
ar((2.8,9.95),(3.4,9.95))                                  # app->rest
ar((5.4,9.95),(5.7,9.95))                                  # rest->sse(visual chain)
ar((4.4,9.6),(2.7,8.4),lab='입력·배치',lp=(3.1,9.15),fs=8.5)   # rest->analysis
ar((1.7,9.6),(1.7,8.55),rad=0.0)                           # app down
ar((6.7,9.6),(9.6,8.4),lab='대화·실시간(SSE)',lp=(8.3,9.15),fs=8.5,c=DIe,lc=DIe)  # sse->tutor
ar((4.3,7.1),(4.6,7.2))                                    # analysis->sess
ar((7.6,7.2),(8.1,7.4))                                    # sess->dialog
ar((7.6,7.0),(12.55,7.7),lab='읽기/쓰기',lp=(10.6,7.05),fs=8.5,c=DBe,lc=DBe)  # sess<->DB
ar((12.6,7.5),(11.45,7.85),lab='프로파일 주입',lp=(12.1,8.15),fs=8.5,c=DBe,lc=DBe,rad=0.1) # DB->tutor
ar((12.6,6.2),(11.45,7.55),lab='RAG 검색',lp=(12.2,6.5),fs=8.5,c=DBe,lc=DBe,rad=0.15)      # KB->tutor
ar((2.45,5.75),(2.0,4.7),c=RTe)                            # analysis->router
ar((9.75,5.75),(9.9,4.7),c=RTe)                            # dialog->router
ar((6.0,3.72),(3.0,2.4),lab='추론 요청',lp=(4.2,3.05),fs=8.6,c=SOe,lc=SOe)  # router->solar
ar((11.9,4.2),(12.3,4.45),c=OPe,st='-')                    # router--ops
ar((9.4,2.4),(13.4,5.8),lab='IE: 신호→DB',lp=(11.6,3.4),fs=8.2,c=SOe,st=':',lc=SOe,rad=-0.2) # IE->DB
ar((6.3,2.4),(13.4,5.85),lab='DP: 문서→지식베이스',lp=(10.0,2.75),fs=8.2,c=SOe,st=':',lc=SOe,rad=-0.12) # DP->KB

ax.text(8.5,0.45,'※ 비동기 분석(배치·저비용) ↔ 실시간 대화(스트리밍) 두 평면을 「학습 DB(dossier)」가 잇고, 모든 호출은 라우터를 거쳐 Solar로 — 측정(계약 게이트·eval)이 배포를 통제한다.',
        ha='center',fontproperties=Fn(9.5,True),color='#566573')
plt.savefig('/home/user/ReelsMaking/proposal/시스템아키텍처.png',dpi=160,bbox_inches='tight',facecolor='white')
print('SAVED')
