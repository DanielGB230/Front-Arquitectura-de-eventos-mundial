import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SignalRService {
    private hubConnection: HubConnection | null = null;
    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    public connectionStatus$ = this.connectionStatusSubject.asObservable();

    constructor() { }

    startConnection(): void {
        this.hubConnection = new HubConnectionBuilder()
            .withUrl(`${environment.consumerApiBaseUrl}/notificationsHub`)
            .configureLogging(LogLevel.Information)
            .build();

        this.hubConnection.start()
            .then(() => {
                console.log('SignalR connection started');
                this.connectionStatusSubject.next(true);
            })
            .catch(err => {
                console.error('Error while starting SignalR connection: ' + err);
                this.connectionStatusSubject.next(false);
            });

        this.hubConnection.onclose(() => {
            console.log('SignalR connection closed');
            this.connectionStatusSubject.next(false);
            setTimeout(() => this.startConnection(), 5000);
        });
    }

    stopConnection(): void {
        if (this.hubConnection) {
            this.hubConnection.stop()
                .then(() => {
                    console.log('SignalR connection stopped');
                    this.connectionStatusSubject.next(false);
                })
                .catch(err => console.error('Error while stopping SignalR connection: ' + err));
        }
    }

    joinMatchGroup(matchId: string): void {
        if (this.hubConnection && this.hubConnection.state === 'Connected') {
            this.hubConnection.invoke('JoinMatchGroup', matchId)
                .catch(err => console.error('Error joining match group:', err));
        }
    }

    leaveMatchGroup(matchId: string): void {
        if (this.hubConnection && this.hubConnection.state === 'Connected') {
            this.hubConnection.invoke('LeaveMatchGroup', matchId)
                .catch(err => console.error('Error leaving match group:', err));
        }
    }

    onMatchStarted(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('MatchStarted', callback);
        }
    }

    onMatchEnded(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('MatchEnded', callback);
        }
    }

    onGoalEvent(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('Goal', callback);
        }
    }

    onCardEvent(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('Card', callback);
        }
    }

    onSubstitutionEvent(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('Substitution', callback);
        }
    }

    onOddsUpdate(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('OddsUpdate', callback);
        }
    }

    onJoinedGroup(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('joinedgroup', callback);
        }
    }

    onMatchStatsUpdated(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('matchstatsupdated', callback);
        }
    }
}