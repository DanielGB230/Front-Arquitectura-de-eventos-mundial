import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { CardRequest, EndMatchRequest, GoalRequest, StartMatchRequest, SubstitutionRequest } from '../../models/match-events.models';
import { MatchService } from '../../services/match.service';
import { SignalRService } from '../../services/signalr.service';

@Component({
  selector: 'app-match-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './match-dashboard.html',
  styleUrl: './match-dashboard.css',
})
export class MatchDashboard implements OnInit, OnDestroy {
  currentMatchId: string | null = null;
  matchDetails: any = {};
  inProgressMatches: any[] = [];
  finishedMatches: any[] = [];
  eventsList: string[] = [];
  animationOverlayVisible = false;
  animationText = '';
  animationClass = '';

  currentOdds = {
    homeWin: 0,
    draw: 0,
    awayWin: 0
  };

  showCreateMatchModal = false;
  newMatchForm = {
    homeTeamName: '',
    awayTeamName: ''
  };

  showSubstitutionModal = false;
  substitutionForm = {
    teamId: null as number | null,
    playerInId: null as number | null,
    playerOutId: null as number | null,
    minute: null as number | null
  };

  showGoalModal = false;
  goalForm = {
    teamId: null as number | null,
    playerId: null as number | null,
    minute: null as number | null
  };

  showCardModal = false;
  isSubmittingCard = false;
  cardForm = {
    teamId: null as number | null,
    playerId: null as number | null,
    cardType: null as number | null,
    minute: null as number | null
  };

  showEndModal = false;

  get currentMatchData(): any {
    return this.currentMatchId ? this.matchDetails[this.currentMatchId] : null;
  }

  constructor(
    private matchService: MatchService,
    private signalRService: SignalRService,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.signalRService.startConnection();
    this.setupSignalRListeners();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.signalRService.stopConnection();
  }

  setupSignalRListeners(): void {
    this.signalRService.onMatchStarted((message: any) => {
      const eventData = message;
      this.logEvent(`🔔 INICIO: ${eventData.homeTeamName || eventData.HomeTeamName} vs ${eventData.awayTeamName || eventData.AwayTeamName}`, true);
      Swal.fire({
        title: 'Partido Iniciado',
        text: `${eventData.homeTeamName} vs ${eventData.awayTeamName}`,
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      this.loadMatchLists();
      const payloadId = this.getMatchIdFromPayload(eventData);
      if (this.currentMatchId && payloadId === this.currentMatchId) {
        this.matchDetails[this.currentMatchId] = {
          homeTeamName: eventData.homeTeamName,
          awayTeamName: eventData.awayTeamName,
          homeScore: 0,
          awayScore: 0,
          status: 1
        };
        this.updateMatchInfoDisplay();
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onMatchEnded((message: any) => {
      const eventData = message;
      this.logEvent(`🏁 FINAL: ${eventData.finalHomeScore ?? eventData.FinalHomeScore} - ${eventData.finalAwayScore ?? eventData.FinalAwayScore}`, true);
      Swal.fire({
        title: 'Partido Finalizado',
        text: `Resultado: ${eventData.finalHomeScore} - ${eventData.finalAwayScore}`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      this.loadMatchLists();
      const payloadIdEnd = this.getMatchIdFromPayload(eventData);
      if (this.currentMatchId && payloadIdEnd === this.currentMatchId) {
        if (this.matchDetails[this.currentMatchId]) {
          this.matchDetails[this.currentMatchId].homeScore = eventData.finalHomeScore;
          this.matchDetails[this.currentMatchId].awayScore = eventData.finalAwayScore;
          this.matchDetails[this.currentMatchId].status = 2;
        }
        this.updateMatchInfoDisplay();
        // Mueve el partido de inProgress a finished localmente
        const index = this.inProgressMatches.findIndex(m => m.matchId === eventData.matchId);
        if (index !== -1) {
          const match = this.inProgressMatches.splice(index, 1)[0];
          match.homeScore = eventData.finalHomeScore;
          match.awayScore = eventData.finalAwayScore;
          match.status = 2;
          this.finishedMatches.unshift(match);
        }
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onGoalEvent((message: any) => {
      const eventData = message;
      const minute = eventData.minute ?? eventData.Minute;
      const newHome = eventData.newHomeScore ?? eventData.NewHomeScore ?? eventData.HomeScore ?? eventData.HomeScore;
      const newAway = eventData.newAwayScore ?? eventData.NewAwayScore ?? eventData.AwayScore ?? eventData.AwayScore;
      this.logEvent(`⚽ GOL! (Min ${minute}) ${newHome} - ${newAway}`, true);
      Swal.fire({
        title: '¡GOL!',
        text: `Minuto ${eventData.minute}: ${eventData.newHomeScore} - ${eventData.newAwayScore}`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      const payloadIdGoal = this.getMatchIdFromPayload(eventData);
      if (this.currentMatchId && payloadIdGoal === this.currentMatchId) {
        this.triggerVisualEffect('goal', 'GOL!!!!');
        this.animateScoreBoard();
        if (this.matchDetails[this.currentMatchId]) {
          this.matchDetails[this.currentMatchId].homeScore = newHome;
          this.matchDetails[this.currentMatchId].awayScore = newAway;
          this.matchDetails[this.currentMatchId].totalGoals = (this.matchDetails[this.currentMatchId].totalGoals || 0) + 1;
          this.matchDetails[this.currentMatchId].totalEvents = (this.matchDetails[this.currentMatchId].totalEvents || 0) + 1;
        }
        this.updateMatchInfoDisplay();
        this.fetchMatchAndStats(this.currentMatchId);
      }
      // Actualiza el score en la lista lateral para todos los usuarios
      const payloadIdForList = this.getMatchIdFromPayload(eventData);
      const matchInList = this.inProgressMatches.find(m => m.matchId === payloadIdForList);
      if (matchInList) {
        matchInList.homeScore = newHome;
        matchInList.awayScore = newAway;
      }
    });

    this.signalRService.onCardEvent((message: any) => {
      const eventData = message;
      const cardTypeVal = eventData.cardType ?? eventData.CardType;
      const cardType = cardTypeVal === 0 ? 'Amarilla' : 'Roja';
      this.logEvent(`🃏 Tarjeta ${cardType} (Min ${eventData.minute})`, true);
      Swal.fire({
        title: 'Tarjeta',
        text: `Tarjeta ${cardType} en el minuto ${eventData.minute}`,
        icon: 'warning',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      const payloadIdCard = this.getMatchIdFromPayload(eventData);
      if (this.currentMatchId && payloadIdCard === this.currentMatchId) {
        const visualType = eventData.cardType === 0 ? 'yellow' : 'red';
        const visualText = eventData.cardType === 0 ? 'AMARILLA' : 'ROJA';
        this.triggerVisualEffect(visualType, visualText);
        // Actualiza localmente las estadísticas para tiempo real
        if (this.matchDetails[this.currentMatchId]) {
          if (cardTypeVal === 0) {
            this.matchDetails[this.currentMatchId].totalYellowCards = (this.matchDetails[this.currentMatchId].totalYellowCards || 0) + 1;
          } else {
            this.matchDetails[this.currentMatchId].totalRedCards = (this.matchDetails[this.currentMatchId].totalRedCards || 0) + 1;
          }
          this.matchDetails[this.currentMatchId].totalEvents = (this.matchDetails[this.currentMatchId].totalEvents || 0) + 1;
        }
        this.updateMatchInfoDisplay();
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onSubstitutionEvent((message: any) => {
      const eventData = message;
      this.logEvent(`🔄 Cambio (Min ${eventData.minute})`, true);
      Swal.fire({
        title: 'Cambio',
        text: `Sustitución en el minuto ${eventData.minute}`,
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      const payloadIdSub = this.getMatchIdFromPayload(eventData);
      if (this.currentMatchId && payloadIdSub === this.currentMatchId) {
        // Actualiza localmente las estadísticas para tiempo real
        if (this.matchDetails[this.currentMatchId]) {
          this.matchDetails[this.currentMatchId].totalSubstitutions = (this.matchDetails[this.currentMatchId].totalSubstitutions || 0) + 1;
          this.matchDetails[this.currentMatchId].totalEvents = (this.matchDetails[this.currentMatchId].totalEvents || 0) + 1;
        }
        this.updateMatchInfoDisplay();
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onOddsUpdate((message: any) => {
      const oddsData = message;
      const payloadIdOdds = this.getMatchIdFromPayload(oddsData);
      if (this.currentMatchId && payloadIdOdds === this.currentMatchId) {
        this.currentOdds = {
          homeWin: oddsData.homeWin,
          draw: oddsData.draw,
          awayWin: oddsData.awayWin
        };
      }
    });

    this.signalRService.onJoinedGroup((message: any) => {
      // Handle joined group event, perhaps log it
      console.log('Joined group:', message);
    });

    this.signalRService.onMatchStatsUpdated((message: any) => {
      // Handle match stats updated event, update stats locally for real-time
      console.log('MatchStatsUpdated received:', message);
      const statsData = message; // service deserializa
      const payloadIdStats = this.getMatchIdFromPayload(statsData);
      if (this.currentMatchId && payloadIdStats === this.currentMatchId) {
        // Actualiza las estadísticas y scores con los datos del payload
        if (this.matchDetails[this.currentMatchId]) {
          this.matchDetails[this.currentMatchId] = {
            ...this.matchDetails[this.currentMatchId],
            homeScore: statsData.HomeScore ?? statsData.homeScore,
            awayScore: statsData.AwayScore ?? statsData.awayScore,
            totalGoals: statsData.TotalGoals ?? statsData.totalGoals,
            totalYellowCards: statsData.TotalYellowCards ?? statsData.totalYellowCards,
            totalRedCards: statsData.TotalRedCards ?? statsData.totalRedCards,
            totalSubstitutions: statsData.TotalSubstitutions ?? statsData.totalSubstitutions,
            totalEvents: statsData.TotalEvents ?? statsData.totalEvents
          };
        }
        // Nuevo: procesar LatestEvent para mostrar detalle de la jugada
        const latest = statsData.LatestEvent ?? statsData.latestEvent;
        if (latest) {
          const evType = latest.EventType ?? latest.eventType;
          const minute = latest.Minute ?? latest.minute;
          if (evType === 'Card') {
            const playerId = latest.PlayerId ?? latest.playerId;
            const cardTypeVal = latest.CardType ?? latest.cardType;
            const cardLabel = cardTypeVal === 0 ? 'AMARILLA' : 'ROJA';
            this.logEvent(`🃏 Tarjeta ${cardLabel} - Jugador ${playerId} (Min ${minute})`, true);
            Swal.fire({
              title: 'Tarjeta',
              text: `Jugador ${playerId} - ${cardLabel} (Min ${minute})`,
              icon: 'warning',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
            this.triggerVisualEffect(cardTypeVal === 0 ? 'yellow' : 'red', cardLabel);
          } else if (evType === 'Substitution') {
            const pin = latest.PlayerInId ?? latest.playerInId;
            const pout = latest.PlayerOutId ?? latest.playerOutId;
            this.logEvent(`🔄 Cambio - In:${pin} Out:${pout} (Min ${minute})`, true);
            Swal.fire({
              title: 'Cambio',
              text: `In: ${pin} - Out: ${pout} (Min ${minute})`,
              icon: 'info',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
          } else if (evType === 'Goal') {
            const scorerId = latest.PlayerId ?? latest.playerId;
            this.logEvent(`⚽ GOL - Jugador ${scorerId} (Min ${minute})`, true);
            Swal.fire({
              title: '¡GOL!',
              text: `Jugador ${scorerId} (Min ${minute})`,
              icon: 'success',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
            this.triggerVisualEffect('goal', 'GOL!!!!');
          }
          // Asegurar que la lista lateral refleje el score actualizado
          const matchInListAfter = this.inProgressMatches.find(m => m.matchId === payloadIdStats);
          if (matchInListAfter) {
            matchInListAfter.homeScore = statsData.HomeScore ?? statsData.homeScore ?? matchInListAfter.homeScore;
            matchInListAfter.awayScore = statsData.AwayScore ?? statsData.awayScore ?? matchInListAfter.awayScore;
          }
        }
        // Actualiza en la lista lateral
        const matchInList = this.inProgressMatches.find(m => m.matchId === payloadIdStats);
        if (matchInList) {
          matchInList.homeScore = statsData.HomeScore ?? statsData.homeScore;
          matchInList.awayScore = statsData.AwayScore ?? statsData.awayScore;
        }
        this.updateMatchInfoDisplay();
        // No need to fetch again since we updated locally
      }
    });
  }

  private getMatchIdFromPayload(payload: any): string | null {
    if (!payload) return null;
    return payload.matchId ?? payload.MatchId ?? null;
  }

  loadInitialData(): void {
    this.updateMatchInfoDisplay();
    if (this.currentMatchId) {
      this.fetchMatchAndStats(this.currentMatchId);
    }
    this.loadMatchLists();
  }

  loadMatchBtn(): void {
    if (!this.currentMatchId) return;
    this.fetchMatchAndStats(this.currentMatchId);
    this.loadMatchLists();
  }

  startMatch(): void {
    if (!this.currentMatchId) {
      Swal.fire('Error', 'Debe ingresar un ID de partido', 'error');
      return;
    }
    if (this.currentMatchData && this.currentMatchData.status === 1) {
      Swal.fire('Advertencia', 'Este partido ya está en curso', 'warning');
      return;
    }
    const teamIdHome = 1;
    const teamIdAway = 2;
    const homeTeamName = `Local ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    const awayTeamName = `Visita ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;

    const body: StartMatchRequest = {
      homeTeamName: homeTeamName,
      awayTeamName: awayTeamName
    };
    this.matchService.startMatch(body).subscribe(response => {
      if (response) {
        this.logEvent(`Comando enviado: Iniciar Partido`);
        // Set match details immediately
        this.matchDetails[this.currentMatchId!] = {
          matchId: this.currentMatchId,
          homeTeamName: homeTeamName,
          awayTeamName: awayTeamName,
          homeTeamId: teamIdHome,
          awayTeamId: teamIdAway,
          homeScore: 0,
          awayScore: 0,
          status: 1
        };
        this.updateMatchInfoDisplay();
        this.loadMatchLists();
        this.signalRService.joinMatchGroup(this.currentMatchId!);

        // Initialize odds in consumer
        const oddsBody = {
          matchId: this.currentMatchId,
          homeTeamId: teamIdHome,
          awayTeamId: teamIdAway,
          homeTeamName: homeTeamName,
          awayTeamName: awayTeamName
        };
        this.matchService.startMatchWithOdds(oddsBody).subscribe();
      }
    });
  }

  sendGoal(): void {
    if (!this.currentMatchId) return;
    this.showGoalModal = true;
  }

  submitGoal(): void {
    if (!this.currentMatchId || !this.goalForm.teamId || !this.goalForm.playerId || !this.goalForm.minute) return;
    const newHomeScore = this.currentMatchData!.homeScore + (this.goalForm.teamId === this.currentMatchData!.homeTeamId ? 1 : 0);
    const newAwayScore = this.currentMatchData!.awayScore + (this.goalForm.teamId === this.currentMatchData!.awayTeamId ? 1 : 0);
    const body: GoalRequest = {
      matchId: this.currentMatchId,
      teamId: this.goalForm.teamId,
      playerId: this.goalForm.playerId,
      minute: this.goalForm.minute,
      newHomeScore,
      newAwayScore
    };
    this.matchService.sendGoal(body).subscribe(() => {
      this.showGoalModal = false;
      this.goalForm = { teamId: null, playerId: null, minute: null };
    });
  }

  sendCard(): void {
    if (!this.currentMatchId) return;
    this.showCardModal = true;
  }

  submitCard(): void {
    console.log('submitCard called', this.currentMatchId, this.cardForm);
    if (!this.currentMatchId || !this.cardForm.teamId || !this.cardForm.playerId || this.cardForm.cardType === null || !this.cardForm.minute) {
      console.log('Validation failed');
      return;
    }
    this.isSubmittingCard = true;
    const body: CardRequest = {
      matchId: this.currentMatchId,
      teamId: this.cardForm.teamId,
      playerId: this.cardForm.playerId,
      cardType: this.cardForm.cardType,
      minute: this.cardForm.minute
    };
    console.log('Sending body', body);
    this.matchService.sendCard(body).subscribe(() => {
      console.log('Card sent successfully');
      this.isSubmittingCard = false;
      this.showCardModal = false;
      this.cardForm = { teamId: null, playerId: null, cardType: null, minute: null };
    }, (error) => {
      console.log('Error sending card', error);
      this.isSubmittingCard = false;
    });
  }

  sendSubstitution(): void {
    if (!this.currentMatchId) return;
    if (!this.currentMatchData || this.currentMatchData.status !== 1) return;
    const teamId = this.currentMatchData.homeTeamName.includes('Local') ? this.currentMatchData.homeTeamId : this.currentMatchData.awayTeamId;
    const body = {
      matchId: this.currentMatchId,
      teamId: teamId,
      playerInId: Math.floor(Math.random() * 50) + 1,
      playerOutId: Math.floor(Math.random() * 50) + 1,
      minute: Math.floor(Math.random() * 90) + 1
    };
    this.matchService.sendSubstitution(body).subscribe();
  }

  endMatch(): void {
    if (!this.currentMatchId) return;
    this.showEndModal = true;
  }

  submitEnd(): void {
    if (!this.currentMatchId) return;
    const body: EndMatchRequest = {
      matchId: this.currentMatchId,
      finalHomeScore: this.currentMatchData?.homeScore || 0,
      finalAwayScore: this.currentMatchData?.awayScore || 0
    };
    this.matchService.endMatchExclusive(body).subscribe(() => {
      this.showEndModal = false;
    });
  }

  createNewMatch(): void {
    this.showCreateMatchModal = true;
  }

  submitCreateMatch(): void {
    if (!this.newMatchForm.homeTeamName || !this.newMatchForm.awayTeamName) return;
    const body: StartMatchRequest = {
      homeTeamName: this.newMatchForm.homeTeamName,
      awayTeamName: this.newMatchForm.awayTeamName
    };
    this.matchService.startMatch(body).subscribe(response => {
      if (response) {
        this.logEvent(`Comando enviado: Crear Nuevo Partido`);
        this.currentMatchId = response.matchId;
        this.matchDetails[this.currentMatchId!] = {
          matchId: response.matchId,
          homeTeamName: body.homeTeamName,
          awayTeamName: body.awayTeamName,
          homeTeamId: 1,
          awayTeamId: 2,
          homeScore: 0,
          awayScore: 0,
          status: 1
        };
        this.updateMatchInfoDisplay();

        // Agrega el partido localmente a la lista en vivo para actualización inmediata
        this.inProgressMatches.push({
          matchId: response.matchId,
          homeTeamName: body.homeTeamName,
          awayTeamName: body.awayTeamName,
          homeScore: 0,
          awayScore: 0,
          status: 1
        });

        this.loadMatchLists();
        this.signalRService.joinMatchGroup(this.currentMatchId!);

        // Initialize odds in consumer
        const oddsBody = {
          matchId: this.currentMatchId,
          homeTeamId: 1,
          awayTeamId: 2,
          homeTeamName: body.homeTeamName,
          awayTeamName: body.awayTeamName
        };
        this.matchService.startMatchWithOdds(oddsBody).subscribe();

        this.showCreateMatchModal = false;
        this.newMatchForm = { homeTeamName: '', awayTeamName: '' };
      }
    });
  }

  submitSubstitution(): void {
    if (!this.currentMatchId || !this.substitutionForm.teamId || !this.substitutionForm.playerInId || !this.substitutionForm.playerOutId || !this.substitutionForm.minute) return;
    const body: SubstitutionRequest = {
      matchId: this.currentMatchId,
      teamId: this.substitutionForm.teamId,
      playerInId: this.substitutionForm.playerInId,
      playerOutId: this.substitutionForm.playerOutId,
      minute: this.substitutionForm.minute
    };
    this.matchService.sendSubstitution(body).subscribe(() => {
      this.showSubstitutionModal = false;
      this.substitutionForm = { teamId: null, playerInId: null, playerOutId: null, minute: null };
    });
  }

  refreshStats(): void {
    this.fetchMatchAndStats(this.currentMatchId);
    this.loadMatchLists();
    if (this.currentMatchId) {
      this.matchService.getOdds(this.currentMatchId).subscribe(odds => {
        if (odds) {
          this.currentOdds = {
            homeWin: odds.homeWinOdds,
            draw: odds.drawOdds,
            awayWin: odds.awayWinOdds
          };
        }
      });
    }
  }

  private fetchMatchAndStats(matchId: string | null): void {
    if (!matchId) return;
    let matchInfo = this.inProgressMatches.find(m => m.matchId === matchId) ||
      this.finishedMatches.find(m => m.matchId === matchId);

    forkJoin([
      this.matchService.getMatchStatistics(matchId),
      this.matchService.getOdds(matchId)
    ]).subscribe(([stats, odds]) => {
      if (stats) {
        const existing = this.matchDetails[matchId];
        let homeScore = stats.homeScore ?? existing?.homeScore ?? 0;
        let awayScore = stats.awayScore ?? existing?.awayScore ?? 0;

        this.setMatchDetails(matchId, stats, matchInfo, homeScore, awayScore, odds);
      } else {
        if (matchInfo) {
          this.matchDetails[matchId] = { ...matchInfo, homeTeamId: 1, awayTeamId: 2 };
          this.updateMatchInfoDisplay();
          this.updateButtonsState();
        } else {
          this.logEvent(`Sin datos para MatchId ${matchId}.`);
          this.matchDetails[matchId] = null;
          this.updateMatchInfoDisplay();
          this.updateButtonsState();
        }
      }
    });
  }

  private loadMatchLists(): void {
    this.matchService.getMatchesByStatus('InProgress').subscribe(matches => {
      this.inProgressMatches = matches || [];
    });

    this.matchService.getMatchesByStatus('Finished').subscribe(matches => {
      this.finishedMatches = matches || [];
    });
  }

  private updateMatchInfoDisplay(): void {
    // Forzar detección de cambios para actualizaciones provenientes de SignalR
    try { this.cd.detectChanges(); } catch { }
  }

  private updateButtonsState(): void {
    // This will be handled in the template with disabled conditions
  }

  private logEvent(message: string, isHighlight = false): void {
    const li = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${message}`;
    this.eventsList.unshift(li);
    if (this.eventsList.length > 50) {
      this.eventsList.pop();
    }
  }

  private triggerVisualEffect(type: string, text: string): void {
    this.animationText = text;
    this.animationClass = `overlay-${type}`;
    this.animationOverlayVisible = true;
    setTimeout(() => {
      this.animationOverlayVisible = false;
      this.animationClass = '';
    }, 2000);
  }

  private animateScoreBoard(): void {
    // This will be handled in the template with CSS classes
  }

  viewMatch(matchId: number): void {
    const id = String(matchId);
    const match = this.inProgressMatches.find(m => m.matchId === id) || this.finishedMatches.find(m => m.matchId === id);
    if (match) {
      this.matchDetails[id] = { ...match, homeTeamId: 1, awayTeamId: 2 };
      this.updateMatchInfoDisplay();
      if (match.status === 1) {
        this.signalRService.joinMatchGroup(id);
      }
    }
    this.currentMatchId = id;
    this.loadMatchBtn();
  }


  private setMatchDetails(matchId: string, stats: any, matchInfo: any, homeScore: number, awayScore: number, odds?: any): void {
    this.matchDetails[matchId] = {
      homeTeamName: stats.homeTeamName || matchInfo?.homeTeamName || 'Desconocido',
      awayTeamName: stats.awayTeamName || matchInfo?.awayTeamName || 'Desconocido',
      homeTeamId: stats.homeTeamId,
      awayTeamId: stats.awayTeamId,
      homeScore,
      awayScore,
      status: stats.status ?? matchInfo?.status ?? 0,
      ...stats
    };
    this.updateMatchInfoDisplay();
    this.updateButtonsState();

    // Update odds if this is the current match
    if (matchId === this.currentMatchId) {
      if (odds) {
        this.currentOdds = {
          homeWin: odds.homeWinOdds,
          draw: odds.drawOdds,
          awayWin: odds.awayWinOdds
        };
      } else {
        this.matchService.getOdds(matchId).subscribe(odds => {
          if (odds) {
            this.currentOdds = {
              homeWin: odds.homeWinOdds,
              draw: odds.drawOdds,
              awayWin: odds.awayWinOdds
            };
          }
        });
      }
    }
  }

  getCardBody(): any {
    return {
      matchId: this.currentMatchId,
      teamId: this.cardForm.teamId,
      playerId: this.cardForm.playerId,
      cardType: this.cardForm.cardType,
      minute: this.cardForm.minute
    };
  }
}


