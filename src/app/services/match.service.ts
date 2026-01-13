import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CardRequest, EndMatchRequest, GoalRequest, Match, StartMatchRequest, SubstitutionRequest } from '../models/match-events.models';

@Injectable({
    providedIn: 'root'
})
export class MatchService {

    constructor(private http: HttpClient) { }

    startMatch(body: StartMatchRequest): Observable<any> {
        return this.http.post(`${environment.producerApiBaseUrl}/start`, body).pipe(
            catchError(error => {
                console.error(`Error en startMatch:`, error);
                return of(null);
            })
        );
    }

    startMatchWithOdds(body: any): Observable<any> {
        return this.http.post(`${environment.producerApiBaseUrl}/start`, body).pipe(
            catchError(error => {
                console.error(`Error en startMatchWithOdds:`, error);
                return of(null);
            })
        );
    }

    sendGoal(body: GoalRequest): Observable<any> {
        return this.http.post(`${environment.producerApiBaseUrl}/goal`, body).pipe(
            catchError(error => {
                console.error(`Error en sendGoal:`, error);
                return of(null);
            })
        );
    }

    sendCard(body: CardRequest): Observable<any> {
        return this.http.post(`${environment.producerApiBaseUrl}/card`, body).pipe(
            catchError(error => {
                console.error(`Error en sendCard:`, error);
                return of(null);
            })
        );
    }

    sendSubstitution(body: SubstitutionRequest): Observable<any> {
        return this.http.post(`${environment.producerApiBaseUrl}/substitution`, body).pipe(
            catchError(error => {
                console.error(`Error en sendSubstitution:`, error);
                return of(null);
            })
        );
    }

    endMatch(body: EndMatchRequest): Observable<any> {
        return this.http.post(`${environment.producerApiBaseUrl}/end`, body).pipe(
            catchError(error => {
                console.error(`Error en endMatch:`, error);
                return of(null);
            })
        );
    }

    endMatchExclusive(body: EndMatchRequest): Observable<any> {
        return this.http.post(`${environment.producerApiBaseUrl}/end`, body).pipe(
            catchError(error => {
                console.error(`Error en endMatchExclusive:`, error);
                return of(null);
            })
        );
    }

    getMatchStatistics(matchId: string): Observable<any | null> {
        return this.http.get<any>(`${environment.consumerApiBaseUrl}/api/match-statistics/${matchId}`).pipe(
            catchError(error => {
                console.error(`Error en getMatchStatistics:`, error);
                return of(null);
            })
        );
    }

    getMatchesByStatus(status: string): Observable<Match[] | null> {
        return this.http.get<Match[]>(`${environment.consumerApiBaseUrl}/api/matches/status/${status}`).pipe(
            catchError(error => {
                console.error(`Error en getMatchesByStatus:`, error);
                return of(null);
            })
        );
    }


    getOdds(matchId: string): Observable<any | null> {
        return this.http.get<any>(`${environment.consumerApiBaseUrl}/api/odds/${matchId}`).pipe(
            catchError(error => {
                console.error(`Error en getOdds:`, error);
                return of(null);
            })
        );
    }
}
