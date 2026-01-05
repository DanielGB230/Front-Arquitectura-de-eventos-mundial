export interface CreateMatchRequest {
    homeTeamName: string;
    awayTeamName: string;
}

export interface StartMatchRequest {
    homeTeamName: string;
    awayTeamName: string;
}

export interface EndMatchRequest {
    matchId: number;
    finalHomeScore: number;
    finalAwayScore: number;
}

export interface GoalRequest {
    matchId: number;
    teamId: number;
    playerId: number;
    minute: number;
    newHomeScore: number;
    newAwayScore: number;
}

export interface CardRequest {
    matchId: number;
    teamId: number;
    playerId: number;
    cardType: number; // 0 for Yellow, 1 for Red
    minute: number;
}

export interface SubstitutionRequest {
    matchId: number;
    teamId: number;
    playerInId: number;
    playerOutId: number;
    minute: number;
}

export interface MatchStatistics {
    matchId: number;
    totalGoals: number;
    totalYellowCards: number;
    totalRedCards: number;
    totalSubstitutions: number;
    totalEvents: number;
}

export interface Match {
    matchId: number;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    status: number; // 0 for NotStarted, 1 for InProgress, 2 for Finished
}