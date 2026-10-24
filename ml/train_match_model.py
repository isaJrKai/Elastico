#!/usr/bin/env python3
"""Time-ordered football 1X2 training and evaluation; no post-kickoff features."""
from __future__ import annotations
import argparse, json, math, re
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
from datasets import load_dataset
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.preprocessing import StandardScaler

DATASET_ID = "eatpizzanot/soccer-dataset"
FEATURES = ["elo_diff","home_elo","away_elo","home_points_last5","away_points_last5",
"home_goals_for_last5","away_goals_for_last5","home_goals_against_last5","away_goals_against_last5",
"home_matches_seen","away_matches_seen","home_rest_days","away_rest_days","league_home_goals_avg","league_away_goals_avg"]
K_FACTOR, HOME_ADVANTAGE, DEFAULT_GOALS = 24.0, 65.0, 1.35

def norm_name(value):
    value = str(value or "").strip().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value)).strip()

def load_frame(config):
    print(f"Loading Hugging Face config={config!r} ...", flush=True)
    return load_dataset(DATASET_ID, config, split="train").to_pandas()

def elo_expected(home, away):
    return 1.0 / (1.0 + 10.0 ** (-(home + HOME_ADVANTAGE - away) / 400.0))

def outcome(h, a):
    return "home" if h > a else "away" if h < a else "draw"

def make_rows(matches, teams, as_of):
    required = {"date_utc","league_id","home_team_id","away_team_id","goals_home","goals_away"}
    missing = required - set(matches.columns)
    if missing: raise ValueError(f"Missing fixture columns: {sorted(missing)}")
    df = matches.copy()
    df["date_utc"] = pd.to_datetime(df["date_utc"], utc=True, errors="coerce")
    df["goals_home"] = pd.to_numeric(df["goals_home"], errors="coerce")
    df["goals_away"] = pd.to_numeric(df["goals_away"], errors="coerce")
    df = df[df["date_utc"].notna() & (df["date_utc"] < as_of)]
    df = df[df["goals_home"].notna() & df["goals_away"].notna()]
    df = df[(df["goals_home"] >= 0) & (df["goals_away"] >= 0)]
    if "status_norm" in df: df = df[df["status_norm"].isin(["FT","AET","PEN"])]
    elif "is_played" in df: df = df[df["is_played"].astype(bool)]
    df = df.sort_values(["date_utc","id"] if "id" in df else ["date_utc"]).reset_index(drop=True)
    for col in ["home_team_id","away_team_id","league_id"]: df[col] = df[col].astype(str)
    tid = "id" if "id" in teams else "team_id" if "team_id" in teams else None
    tname = "name" if "name" in teams else "team_name" if "team_name" in teams else None
    if not tid or not tname: raise ValueError("Teams config needs id/team_id and name/team_name columns")
    team_names = {str(r[tid]): str(r[tname]) for _,r in teams[[tid,tname]].dropna().iterrows()}
    ratings = defaultdict(lambda: 1500.0)
    recent = defaultdict(lambda: deque(maxlen=5))
    last_date, league_goals, rows = {}, defaultdict(lambda: deque(maxlen=200)), []

    for r in df.itertuples(index=False):
        hid, aid, lid = str(r.home_team_id), str(r.away_team_id), str(r.league_id)
        date, hg, ag = pd.Timestamp(r.date_utc), int(r.goals_home), int(r.goals_away)
        he, ae = ratings[hid], ratings[aid]
        lg = league_goals[lid]
        lhg = float(np.mean([x[0] for x in lg])) if lg else DEFAULT_GOALS
        lag = float(np.mean([x[1] for x in lg])) if lg else DEFAULT_GOALS
        def rest(team):
            return float(np.clip((date-last_date[team]).total_seconds()/86400.0,0,60)) if team in last_date else 7.0
        def roll(team):
            hist = recent[team]
            if not hist: return 0.0, DEFAULT_GOALS, DEFAULT_GOALS, 0
            return float(np.mean([x[0] for x in hist])),float(np.mean([x[1] for x in hist])),float(np.mean([x[2] for x in hist])),len(hist)
        hp,hgf,hga,hn = roll(hid); ap,agf,aga,an = roll(aid)
        rows.append({"date":date,"league_id":lid,"home_team_id":hid,"away_team_id":aid,
          "home_team":team_names.get(hid,hid),"away_team":team_names.get(aid,aid),
          "home_goals":hg,"away_goals":ag,"target":outcome(hg,ag),
          "elo_diff":he-ae,"home_elo":he,"away_elo":ae,
          "home_points_last5":hp,"away_points_last5":ap,
          "home_goals_for_last5":hgf,"away_goals_for_last5":agf,
          "home_goals_against_last5":hga,"away_goals_against_last5":aga,
          "home_matches_seen":float(hn),"away_matches_seen":float(an),
          "home_rest_days":rest(hid),"away_rest_days":rest(aid),
          "league_home_goals_avg":lhg,"league_away_goals_avg":lag})
        eh = elo_expected(he,ae); actual = 1.0 if hg>ag else 0.5 if hg==ag else 0.0
        ratings[hid] = he + K_FACTOR*(actual-eh)
        ratings[aid] = ae + K_FACTOR*((1-actual)-(1-eh))
        recent[hid].append((3.0 if hg>ag else 1.0 if hg==ag else 0.0,hg,ag))
        recent[aid].append((3.0 if ag>hg else 1.0 if hg==ag else 0.0,ag,hg))
        last_date[hid]=date; last_date[aid]=date; lg.append((hg,ag))

    team_state = {}
    for team in set(df["home_team_id"]).union(set(df["away_team_id"])):
        p,gf,ga,n = roll(team)
        name = team_names.get(team,team)
        team_state[norm_name(name)]={"teamId":team,"teamName":name,"elo":round(float(ratings[team]),3),
          "pointsLast5":round(p,4),"goalsForLast5":round(gf,4),"goalsAgainstLast5":round(ga,4),
          "matchesInRecentWindow":n,"lastMatchDate":last_date[team].isoformat() if team in last_date else None}
    return pd.DataFrame(rows), team_state

def fit_model(frame):
    scaler=StandardScaler()
    x=scaler.fit_transform(frame[FEATURES].astype(float).to_numpy())
    model=LogisticRegression(C=0.5,max_iter=500,solver="lbfgs")
    model.fit(x,frame["target"].astype(str).to_numpy())
    return scaler,model

def evaluate(frame,scaler,model):
    x=scaler.transform(frame[FEATURES].astype(float).to_numpy())
    prob=model.predict_proba(x); classes=list(model.classes_); y=frame["target"].astype(str).to_numpy()
    pred=np.asarray(classes)[np.argmax(prob,axis=1)]
    prior=frame["target"].value_counts(normalize=True)
    onehot=np.column_stack([y==c for c in classes]).astype(float)
    constant=np.tile([float(prior.get(c,0)) for c in classes],(len(frame),1))
    return {"matches":int(len(frame)),"dateStart":frame.date.min().isoformat(),"dateEnd":frame.date.max().isoformat(),
      "accuracy":float(accuracy_score(y,pred)),"logLoss":float(log_loss(y,prob,labels=classes)),
      "multiclassBrier":float(np.mean(np.sum((prob-onehot)**2,axis=1))),
      "majorityClassAccuracy":float(prior.max()),"historicalClassRates":{str(k):float(v) for k,v in prior.items()},
      "constantClassPriorLogLoss":float(log_loss(y,constant,labels=classes)),"classes":classes}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--as-of",default=datetime.now(timezone.utc).date().isoformat())
    p.add_argument("--holdout-days",type=int,default=730)
    p.add_argument("--min-train-matches",type=int,default=10000)
    p.add_argument("--out",default="artifacts/football-1x2")
    a=p.parse_args()
    as_of=pd.Timestamp(a.as_of,tz="UTC")
    if a.holdout_days<90: raise SystemExit("--holdout-days must be at least 90")
    fixtures,teams=load_frame("fixtures"),load_frame("teams")
    frame,team_state=make_rows(fixtures,teams,as_of)
    if len(frame)<a.min_train_matches: raise SystemExit(f"Only {len(frame)} usable matches; refusing to train.")
    cutoff=frame.date.max()-pd.Timedelta(days=a.holdout_days)
    train,test=frame[frame.date<cutoff].copy(),frame[frame.date>=cutoff].copy()
    if len(train)<a.min_train_matches or len(test)<1000:
        raise SystemExit(f"Insufficient time split: train={len(train)}, test={len(test)}")
    eval_scaler,eval_model=fit_model(train)
    report={"dataset":DATASET_ID,"license":"CC-BY-4.0","asOfExclusiveUtc":as_of.isoformat(),
      "split":{"strategy":"chronological","cutoffUtc":cutoff.isoformat(),"trainMatches":len(train),"testMatches":len(test)},
      "heldOut":evaluate(test,eval_scaler,eval_model),
      "warning":"Research model only. Historical performance does not guarantee future performance or profit."}
    scaler,model=fit_model(frame)
    artifact={"schemaVersion":1,"modelType":"standardized-multinomial-logistic-regression",
      "modelVersion":"football-1x2-2026-10","dataset":DATASET_ID,"datasetLicense":"CC-BY-4.0",
      "attribution":"Global Football (Soccer) Data Lake; sources API-Football and football-data.co.uk.",
      "asOfExclusiveUtc":as_of.isoformat(),"features":FEATURES,"classes":list(model.classes_),
      "scalerMean":scaler.mean_.tolist(),"scalerScale":scaler.scale_.tolist(),
      "coefficients":model.coef_.tolist(),"intercepts":model.intercept_.tolist(),
      "teamStateByNormalizedName":team_state,"evaluation":report,
      "limitations":["Team-name aliases must be explicitly mapped before serving live fixtures.",
      "Coverage differs by league; unknown teams must not receive fabricated ratings.",
      "Features use prior results only; no live lineup/injury data is included.",
      "This model does not guarantee betting edge or profit."]}
    out=Path(a.out); out.mkdir(parents=True,exist_ok=True)
    (out/"model.json").write_text(json.dumps(artifact,indent=2),encoding="utf-8")
    (out/"evaluation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"artifact":str(out/"model.json"),"report":str(out/"evaluation.json"),
      "rows":len(frame),"train":len(train),"test":len(test),"heldOut":report["heldOut"],
      "asOfExclusiveUtc":as_of.isoformat()},indent=2))
if __name__=="__main__": main()
