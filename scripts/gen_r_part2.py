# Part 2 — Continuation (body content, tables, status, data flows)

hp = lambda c,d: (c.saveState(), d.setFont('Helvetica',7, textColor=FGM), d.setFillColor(BG), d.rect(0,0,A4[0],A4[1],fill=1,stroke=0), d.showPage(), d.showPageRestore())
story.append(H2('3. A. Built (continued)'))

hp('A.6 Prediction Engine Null-Safe Odds')
story.append(P('The MatchInput.bookmakerOdds field was changed from required to optional. When no odds are provided, the engine no longer substitutes {2.10, 3.40, 3.50}. Kelly criterion, portfolio allocation, and market signal analysis are skipped entirely, and the recommendation honestly states: 