import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
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
            .withAutomaticReconnect()
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
        if (this.hubConnection && this.hubConnection.state === HubConnectionState.Connected) {
            this.hubConnection.invoke('JoinMatchGroup', matchId)
                .catch(err => console.error('Error joining match group:', err));
        }
    }

    leaveMatchGroup(matchId: string): void {
        if (this.hubConnection && this.hubConnection.state === HubConnectionState.Connected) {
            this.hubConnection.invoke('LeaveMatchGroup', matchId)
                .catch(err => console.error('Error leaving match group:', err));
        }
    }

    onMatchStarted(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('MatchStarted', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }

    onMatchEnded(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('MatchEnded', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }

    onGoalEvent(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('Goal', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }

    onCardEvent(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('Card', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }

    onSubstitutionEvent(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('Substitution', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }

    onOddsUpdate(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('OddsUpdate', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }

    onJoinedGroup(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('JoinedGroup', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }

    onMatchStatsUpdated(callback: (message: any) => void): void {
        if (this.hubConnection) {
            this.hubConnection.on('MatchStatsUpdated', (msg: any) => {
                let payload = msg;
                try { payload = JSON.parse(msg); } catch { }
                callback(payload);
            });
        }
    }
}