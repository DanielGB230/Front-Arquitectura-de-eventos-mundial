import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
  currentMatchId: number | null = null;
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
    private signalRService: SignalRService
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
      const eventData = JSON.parse(message);
      this.logEvent(`🔔 INICIO: ${eventData.homeTeamName} vs ${eventData.awayTeamName}`, true);
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
      if (this.currentMatchId && eventData.matchId === this.currentMatchId) {
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
      const eventData = JSON.parse(message);
      this.logEvent(`🏁 FINAL: ${eventData.finalHomeScore} - ${eventData.finalAwayScore}`, true);
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
      if (this.currentMatchId && eventData.matchId === this.currentMatchId) {
        if (this.matchDetails[this.currentMatchId]) {
          this.matchDetails[this.currentMatchId].homeScore = eventData.finalHomeScore;
          this.matchDetails[this.currentMatchId].awayScore = eventData.finalAwayScore;
          this.matchDetails[this.currentMatchId].status = 2;
        }
        this.updateMatchInfoDisplay();
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onGoalEvent((message: any) => {
      const eventData = JSON.parse(message);
      this.logEvent(`⚽ GOL! (Min ${eventData.minute}) ${eventData.newHomeScore} - ${eventData.newAwayScore}`, true);
      Swal.fire({
        title: '¡GOL!',
        text: `Minuto ${eventData.minute}: ${eventData.newHomeScore} - ${eventData.newAwayScore}`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      if (this.currentMatchId && eventData.matchId === this.currentMatchId) {
        this.triggerVisualEffect('goal', 'GOL!!!!');
        this.animateScoreBoard();
        if (this.matchDetails[this.currentMatchId]) {
          this.matchDetails[this.currentMatchId].homeScore = eventData.newHomeScore;
          this.matchDetails[this.currentMatchId].awayScore = eventData.newAwayScore;
        }
        this.updateMatchInfoDisplay();
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onCardEvent((message: any) => {
      const eventData = JSON.parse(message);
      const cardType = eventData.cardType === 0 ? 'Amarilla' : 'Roja';
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
      if (this.currentMatchId && eventData.matchId === this.currentMatchId) {
        const visualType = eventData.cardType === 0 ? 'yellow' : 'red';
        const visualText = eventData.cardType === 0 ? 'AMARILLA' : 'ROJA';
        this.triggerVisualEffect(visualType, visualText);
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onSubstitutionEvent((message: any) => {
      const eventData = JSON.parse(message);
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
      if (this.currentMatchId && eventData.matchId === this.currentMatchId) {
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });

    this.signalRService.onOddsUpdate((message: any) => {
      const oddsData = JSON.parse(message);
      if (this.currentMatchId && oddsData.matchId === this.currentMatchId) {
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
      // Handle match stats updated event, perhaps refresh stats
      const statsData = message; // Already deserialized object
      if (this.currentMatchId && statsData.matchId === this.currentMatchId) {
        this.fetchMatchAndStats(this.currentMatchId);
      }
    });
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
        this.signalRService.joinMatchGroup(this.currentMatchId!.toString());

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
          homeTeamName: response.homeTeamName,
          awayTeamName: response.awayTeamName,
          homeTeamId: 1,
          awayTeamId: 2,
          homeScore: 0,
          awayScore: 0,
          status: 1
        };
        this.updateMatchInfoDisplay();
        this.loadMatchLists();
        this.signalRService.joinMatchGroup(this.currentMatchId!.toString());

        // Initialize odds in consumer
        const oddsBody = {
          matchId: this.currentMatchId,
          homeTeamId: 1,
          awayTeamId: 2,
          homeTeamName: response.homeTeamName,
          awayTeamName: response.awayTeamName
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

  private fetchMatchAndStats(matchId: number | null): void {
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
    // This will be handled in the template
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
    const match = this.inProgressMatches.find(m => m.matchId === matchId) || this.finishedMatches.find(m => m.matchId === matchId);
    if (match) {
      this.matchDetails[matchId] = { ...match, homeTeamId: 1, awayTeamId: 2 };
      this.updateMatchInfoDisplay();
      if (match.status === 1) {
        this.signalRService.joinMatchGroup(matchId.toString());
      }
    }
    this.currentMatchId = matchId;
    this.loadMatchBtn();
  }


  private setMatchDetails(matchId: number, stats: any, matchInfo: any, homeScore: number, awayScore: number, odds?: any): void {
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


